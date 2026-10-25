
import {
  normalizeTask,
  normalizeTasks,
  updateTask as updateTaskModel,
  toggleTaskCompletion,
} from '../domain/taskModel';

import {
  loadState,
  saveState as persistState,
} from '../repositories/localTaskRepository';

import {
  loadTasks as loadRemoteTasks,
} from '../repositories/supabaseTaskRepository';

import { supabase } from '../lib/supabase';
import { syncOperation } from '../services/taskSyncService';
import { updateTaskSyncStatus } from './taskSyncStatus';

// Serializa operações para evitar gravações concorrentes.
let writeQueue = Promise.resolve();

const enqueueWrite = (operation) => {
  const result = writeQueue.then(operation);

  // Uma falha não deve bloquear as próximas operações.
  writeQueue = result.catch(() => { });

  return result;
};

const getState = async () => {
  const state = await loadState();

  return state ?? {
    tasks: [],
    pendingOps: [],
  };
};

// Revisions order snapshots within this repository instance.
let tasksRevision = 0;
const taskListeners = new Set();

export const subscribeTasks = (listener) => {
  taskListeners.add(listener);
  return () => taskListeners.delete(listener);
};

const saveState = async (state) => {
  const savedState = await persistState(state);
  updateTaskSyncStatus({ pending: savedState.pendingOps.length });
  const snapshot = { tasks: savedState.tasks, revision: ++tasksRevision };
  for (const listener of taskListeners) {
    try {
      listener(snapshot);
    } catch (error) {
      // A presentation failure must not turn a committed write into a failure.
      console.warn('[Tasks] Falha ao atualizar interface:', error);
    }
  }
  return savedState;
};

export const loadTasksSnapshot = () => enqueueWrite(async () => {
  const state = await getState();
  updateTaskSyncStatus({ pending: state.pendingOps.length });
  return { tasks: state.tasks, revision: tasksRevision };
});

const getAuthenticatedUserId = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.user?.id) {
    throw new Error('Sessão indisponível');
  }

  return session.user.id;
};

const makeOperation = (type, data) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  type,
  ...data,
});

// Guarda tarefas e operação pendente no mesmo registo.
const commit = async (buildNextState) => {

  const savedState = await enqueueWrite(async () => {
    const state = await getState();
    const nextState = buildNextState(state);

    return saveState(nextState);
  });
  // A gravação local já terminou.
  // Sincronizar em segundo plano, sem bloquear a aplicação.
  syncPendingTasks().catch((error) => {
    console.warn('[Sync] Falha na sincronização:', error);
  });

  return savedState;
};

/* READ */

export const loadTasks = async () => {
  // Aguarda alterações locais ainda em curso.
  await writeQueue;

  const state = await getState();
    console.log('[Debug] Operações pendentes:', state.pendingOps);

  return state.tasks;
};

let pullPromise = null;

const recoverRemoteTasks = async () => {
  const userId = await getAuthenticatedUserId();

  // A changed local revision invalidates the remote response, including when
  // a pending delete was confirmed and removed while the request was in flight.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const revision = await enqueueWrite(() => tasksRevision);
    const remoteTasks = await loadRemoteTasks(userId);

    const result = await enqueueWrite(async () => {
      if (await getAuthenticatedUserId() !== userId) {
        throw new Error('Sessão alterada durante a recuperação de tarefas');
      }
      if (revision !== tasksRevision) return null;

      const state = await getState();
      const knownIds = new Set(state.tasks.map(task => task.id));
      const pendingIds = new Set(
        state.pendingOps.map(op => op.task?.id ?? op.taskId).filter(Boolean),
      );
      const missingTasks = remoteTasks.filter(task => {
        if (knownIds.has(task.id) || pendingIds.has(task.id)) return false;
        knownIds.add(task.id);
        return true;
      });

      if (missingTasks.length === 0) return state.tasks;
      const savedState = await saveState({
        ...state,
        tasks: [...state.tasks, ...missingTasks],
      });
      return savedState.tasks;
    });

    if (result !== null) return result;
  }

  // Keep local data intact rather than applying a stale response under load.
  throw new Error('Recuperação adiada devido a alterações locais concorrentes');
};

export const pullRemoteTasks = () => {
  if (pullPromise) return pullPromise;
  updateTaskSyncStatus({ pulling: true, pullFailed: false });
  pullPromise = recoverRemoteTasks().catch(error => {
    updateTaskSyncStatus({ pullFailed: true });
    throw error;
  }).finally(() => {
    updateTaskSyncStatus({ pulling: false });
    pullPromise = null;
  });
  return pullPromise;
};

/* CREATE */

const commitTaskCreation = async (task, assignPosition = false) => {
  return commit((state) => {
    const position = assignPosition
      ? state.tasks.reduce(
          (max, item) => Math.max(max, Number(item.position) || 0),
          -1,
        ) + 1
      : task.position;
    const canonicalTask = normalizeTask({ ...task, position });

    return {
      ...state,
      tasks: [...state.tasks, canonicalTask],
      pendingOps: [
        ...state.pendingOps,
        makeOperation('create', { task: canonicalTask }),
      ],
    };
  });
};

export const createTask = async (task) => {
  const savedState = await commitTaskCreation(task);
  return savedState.tasks[savedState.tasks.length - 1];
};

export const createTaskAndLoadTasks = async (task) => {
  const savedState = await commitTaskCreation(task, true);
  return savedState.tasks;
};

/* UPDATE */
const commitTaskUpdate = async (taskId, buildUpdatedTask) => {
  return commit((state) => {
    const currentTask = state.tasks.find(
      task => task.id === taskId
    );

    if (!currentTask) {
      const error = new Error(`Tarefa não encontrada: ${taskId}`);
      error.code = 'TASK_NOT_FOUND';
      throw error;
    }

    const updatedTask = buildUpdatedTask(currentTask);

    return {
      ...state,
      tasks: state.tasks.map(task =>
        task.id === taskId ? updatedTask : task
      ),
      pendingOps: [
        ...state.pendingOps,
        makeOperation('update', { task: updatedTask }),
      ],
    };
  });

};

export const updateTask = async (taskId, changes) => {
  const savedState = await commitTaskUpdate(
    taskId,
    task => updateTaskModel(task, changes),
  );
  return savedState.tasks.find(task => task.id === taskId);
};

export const updateTaskAndLoadTasks = async (taskId, changes) => {
  const savedState = await commitTaskUpdate(
    taskId,
    task => updateTaskModel(task, changes),
  );
  return savedState.tasks;
};

export const toggleCompletionAndLoadTasks = async (taskId) => {
  const savedState = await commitTaskUpdate(taskId, toggleTaskCompletion);
  return savedState.tasks;
};

/* DELETE */

export const deleteTask = async (taskId) => {
  const savedState = await commit((state) => ({
    tasks: state.tasks.filter(
      (task) => task.id !== taskId,
    ),
    pendingOps: [
      ...state.pendingOps,
      makeOperation('delete', { taskId }),
    ],
  }));

  return savedState.tasks;
};

/* CLEAR */

export const clearTasks = async () => {
  await commit((state) => ({
    tasks: [],
    pendingOps: [
      ...state.pendingOps,
      ...state.tasks.map((task) =>
        makeOperation('delete', { taskId: task.id }),
      ),
    ],
  }));
};

/* SNAPSHOT SAVE - COMPATIBILIDADE */

export const saveTasks = async (tasks) => {
  const canonicalTasks = normalizeTasks(tasks);

  await commit((state) => {
    const previous = new Map(
      state.tasks.map((task) => [task.id, task]),
    );

    const next = new Map(
      canonicalTasks.map((task) => [task.id, task]),
    );

    const operations = [];

    for (const task of canonicalTasks) {
      const oldTask = previous.get(task.id);

      if (!oldTask) {
        operations.push(
          makeOperation('create', { task }),
        );
      } else if (
        JSON.stringify(oldTask) !== JSON.stringify(task)
      ) {
        operations.push(
          makeOperation('update', { task }),
        );
      }
    }

    for (const task of state.tasks) {
      if (!next.has(task.id)) {
        operations.push(
          makeOperation('delete', { taskId: task.id }),
        );
      }
    }

    return {
      tasks: canonicalTasks,
      pendingOps: [
        ...state.pendingOps,
        ...operations,
      ],
    };
  });

  return canonicalTasks;
};


/* SYNC */

let syncPromise = null;
let syncRequested = false;

export const syncPendingTasks = () => {
  if (syncPromise) {
    syncRequested = true;
    return syncPromise;
  }

  updateTaskSyncStatus({ sending: true, sendFailed: false });
  syncPromise = (async () => {
    const userId = await getAuthenticatedUserId();
    let synced = 0;

    while (true) {
      // Ler a próxima operação sem interferir
      // com gravações locais em curso.
      const operation = await enqueueWrite(async () => {
        const state = await getState();
        return state.pendingOps[0] ?? null;
      });

      if (!operation) {
        break;
      }

      // Se falhar, a operação permanece na fila.
      await syncOperation(userId, operation);

      // Remover apenas a operação confirmada.
      await enqueueWrite(async () => {
        const state = await getState();

        const nextState = {
          ...state,
          pendingOps: state.pendingOps.filter(
            (item) => item.id !== operation.id,
          ),
        };

        await saveState(nextState);
      });

      synced += 1;
    }

    return synced;
  })();

  // Libertar o bloqueio após sucesso ou erro.
  const currentPromise = syncPromise;

  currentPromise.then(
    () => {
      if (syncPromise !== currentPromise) return;

      syncPromise = null;
      updateTaskSyncStatus({ sending: false, sendFailed: false });

      if (syncRequested) {
        syncRequested = false;

        syncPendingTasks().catch((error) => {
          console.warn('[Sync] Falha na nova tentativa:', error);
        });
      }
    },
    () => {
      if (syncPromise !== currentPromise) return;

      syncPromise = null;
      updateTaskSyncStatus({ sending: false, sendFailed: true });
      syncRequested = false;
    },
  );

  return currentPromise;
};

export const TASK_STORAGE_INFO = {
  schemaVersion: 1,
  key: '@my_time_tasks_local_v1',
};
