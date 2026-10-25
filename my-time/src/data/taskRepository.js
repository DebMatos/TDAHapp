
import {
  normalizeTask,
  normalizeTasks,
} from '../domain/taskModel';

import {
  loadState,
  saveState,
} from '../repositories/localTaskRepository';

import {
  loadTasks as loadRemoteTasks,
} from '../repositories/supabaseTaskRepository';

import { supabase } from '../lib/supabase';
import { syncOperation } from '../services/taskSyncService';

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
  });pendingOps
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

export const pullRemoteTasks = async () => {
  const userId = await getAuthenticatedUserId();
  const remoteTasks = await loadRemoteTasks(userId);

  return enqueueWrite(async () => {
    const state = await getState();

    const localIds = new Set(
      state.tasks.map((task) => task.id),
    );

    // Tarefas com alterações locais ainda por sincronizar.
    const pendingIds = new Set(
      state.pendingOps
        .map((op) => op.task?.id ?? op.taskId)
        .filter(Boolean),
    );

    const missingTasks = remoteTasks.filter(
      (task) =>
        !localIds.has(task.id) &&
        !pendingIds.has(task.id),
    );

    if (missingTasks.length === 0) {
      return state.tasks;
    }

    const savedState = await saveState({
      ...state,
      tasks: [...state.tasks, ...missingTasks],
    });

    return savedState.tasks;
  });
};

/* CREATE */

export const createTask = async (task) => {
  const canonicalTask = normalizeTask(task);

  console.log('[Debug] A criar tarefa:', canonicalTask.id);

  await commit((state) => ({
    tasks: [...state.tasks, canonicalTask],
    pendingOps: [
      ...state.pendingOps,
      makeOperation('create', { task: canonicalTask }),
    ],
  }));

  console.log('[Debug] Tarefa guardada localmente:', canonicalTask.id);

  return canonicalTask;
};

/* UPDATE */

export const updateTask = async (task) => {
  const canonicalTask = normalizeTask(task);
  await commit((state) => ({
    tasks: state.tasks.map((item) =>
      item.id === canonicalTask.id
        ? canonicalTask
        : item,
    ),
    pendingOps: [
      ...state.pendingOps,
      makeOperation('update', { task: canonicalTask }),
    ],
  }));

  return canonicalTask;
};

/* DELETE */

export const deleteTask = async (taskId) => {
  await commit((state) => ({
    tasks: state.tasks.filter(
      (task) => task.id !== taskId,
    ),
    pendingOps: [
      ...state.pendingOps,
      makeOperation('delete', { taskId }),
    ],
  }));
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
      syncRequested = false;
    },
  );

  return currentPromise;
};

export const TASK_STORAGE_INFO = {
  schemaVersion: 1,
  key: '@my_time_tasks_local_v1',
};
