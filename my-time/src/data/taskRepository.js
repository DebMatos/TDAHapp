
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

import { supabase, getSessionIdentity } from '../lib/supabase';
import { syncOperation } from '../services/taskSyncService';
import { classifyTaskSyncError } from '../services/taskSyncErrors';
import { updateTaskSyncStatus } from './taskSyncStatus';
import {
  getDiagnosticOperationId,
  recordTaskSyncTransition,
  taskSyncDiagnosticsEnabled,
  traceTaskSyncDiagnostic,
} from './taskSyncDiagnostics';

// Serializa operações para evitar gravações concorrentes.
let writeQueue = Promise.resolve();
let syncOnline = null;
let syncSessionReady = false;

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
  recordQueueState(savedState);
  updateTaskSyncStatus({
    pending: savedState.pendingOps.length,
    failureCategory: savedState.pendingOps[0]?.sync?.category ?? null,
  });
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
  recordQueueState(state);
  updateTaskSyncStatus({
    pending: state.pendingOps.length,
    failureCategory: state.pendingOps[0]?.sync?.category ?? null,
  });
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
    const unavailable = new Error('Sessão indisponível');
    unavailable.code = 'SESSION_UNAVAILABLE';
    throw unavailable;
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
  syncPendingTasks({ automatic: true }).catch((error) => {
    console.warn('[Sync] Falha na sincronização:', error);
  });

  return savedState;
};

/* READ */

export const loadTasks = async () => {
  // Aguarda alterações locais ainda em curso.
  await writeQueue;

  const state = await getState();

  return state.tasks;
};

let pullPromise = null;
let activePullController = null;

const recoverRemoteTasks = async (signal, identityRevision) => {
  const userId = await traceSync('pull-session', () =>
    runSyncStep(getAuthenticatedUserId, signal));
  const assertSameIdentity = () => {
    assertSyncIdentity(signal, identityRevision, userId);
  };
  assertSameIdentity();

  // A changed local revision invalidates the remote response, including when
  // a pending delete was confirmed and removed while the request was in flight.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const revision = await enqueueWrite(() => tasksRevision);
    const remoteTasks = await traceSync('pull', reportHttp => runSyncStep(
      requestSignal => loadRemoteTasks(userId, requestSignal, reportHttp), signal,
    ), { attempt: attempt + 1 });
    // Session refresh may use the network: never await it inside writeQueue.
    if (await traceSync('pull-revalidate', () =>
      runSyncStep(getAuthenticatedUserId, signal), { attempt: attempt + 1 }) !== userId) {
      recordSyncTransition('pull-identity-changed');
      throw syncAbortError('session');
    }
    assertSameIdentity();

    const result = await traceSync('reconcile', () => enqueueWrite(async () => {
      assertSameIdentity();
      if (revision !== tasksRevision) return null;

      const state = await getState();
      assertSameIdentity();
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
    }), { attempt: attempt + 1 });

    if (result !== null) return result;
    recordSyncTransition('pull-revision-changed');
  }

  // Keep local data intact rather than applying a stale response under load.
  throw new Error('Recuperação adiada devido a alterações locais concorrentes');
};

export const pullRemoteTasks = ({ automatic = false } = {}) => {
  if (!syncOnline || !syncSessionReady) return loadTasks();
  if (pullPromise) {
    if (activePullController.signal.aborted) {
      return pullPromise.catch(() => {}).then(() => pullRemoteTasks({ automatic }));
    }
    return pullPromise;
  }
  if (automatic && pullRetry.scheduled) return loadTasks();
  pullRetry.clear();
  const controller = new AbortController();
  const attemptedSessionVersion = sessionVersion;
  const identityRevision = getSessionIdentity().revision;
  activePullController = controller;
  pullPromise = recoverRemoteTasks(controller.signal, identityRevision).then(tasks => {
    assertSyncIdentity(controller.signal, identityRevision);
    pullRetry.reset();
    updateTaskSyncStatus({ pullConfirmed: true });
    return tasks;
  }).catch(error => {
    if (error?.code !== 'SYNC_CANCELLED') {
      updateTaskSyncStatus({ pullFailed: true });
      recordSyncTransition('pull-failed');
      if (shouldRetry(error) || sessionRenewedAfterAuthError(error, attemptedSessionVersion)) {
        pullRetry.schedule();
      }
    }
    throw error;
  }).finally(() => {
    activePullController = null;
    pullPromise = null;
    updateTaskSyncStatus({ pulling: false });
    recordSyncTransition('pull-released');
  });
  updateTaskSyncStatus({ pulling: true, pullFailed: false });
  recordSyncTransition('pull-started');
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
let syncRequested = null;
let activeSyncController = null;
let sessionVersion = 0;

const syncDiagnosticState = () => ({
  syncPromise: syncPromise !== null,
  syncRequested: syncRequested !== null,
  retryTimer: sendRetry.scheduled,
  syncOnline,
  syncSessionReady,
  pullPromise: pullPromise !== null,
  pullRetryTimer: pullRetry.scheduled,
});

const recordSyncTransition = (phase, details) => {
  if (taskSyncDiagnosticsEnabled) recordTaskSyncTransition(phase, syncDiagnosticState(), details);
};

const recordQueueState = ({ pendingOps }) => {
  if (!taskSyncDiagnosticsEnabled) return;
  recordSyncTransition('queue', {
    pending: pendingOps.length,
    operationId: getDiagnosticOperationId(pendingOps[0]),
  });
};

const traceSync = (phase, run, details) =>
  traceTaskSyncDiagnostic(phase, syncDiagnosticState, run, details);

const SYNC_OPERATION_TIMEOUT_MS = 15_000;
const SYNC_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];

const createRetry = (source, retry) => {
  let timer = null;
  let attempt = 0;
  const clear = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    recordSyncTransition('retry-cleared', { source });
  };
  return {
    get scheduled() {
      return timer !== null;
    },
    clear,
    reset() {
      clear();
      attempt = 0;
    },
    schedule() {
      if (!syncOnline || !syncSessionReady || timer !== null) return;
      const delay = SYNC_RETRY_DELAYS_MS[Math.min(attempt, SYNC_RETRY_DELAYS_MS.length - 1)];
      attempt += 1;
      timer = setTimeout(() => {
        timer = null;
        recordSyncTransition('retry-triggered', { source, attempt });
        retry().catch(error => console.warn('[Sync] Nova tentativa adiada:', error));
      }, delay);
      recordSyncTransition('retry-scheduled', { source, attempt, durationMs: delay });
      timer?.unref?.();
    },
  };
};

const sendRetry = createRetry('Envio', () => syncPendingTasks({ automatic: true, retryAuth: true }));
const pullRetry = createRetry('Leitura', () => pullRemoteTasks({ automatic: true }));

const shouldRetry = (error) => {
  if (error?.code === 'SYNC_CANCELLED') return false;
  const { category } = classifyTaskSyncError(error);
  return category === 'transient' || category === 'unknown' || error?.code === 'SESSION_UNAVAILABLE';
};

const sessionRenewedAfterAuthError = (error, version) =>
  syncSessionReady && sessionVersion !== version && classifyTaskSyncError(error).category === 'auth';

const syncAbortError = (reason) => {
  const message = reason === 'timeout' ? 'Tempo limite da sincronização excedido'
    : reason === 'session' ? 'Sessão alterada durante a sincronização'
      : 'Sincronização interrompida por falta de ligação';
  const error = new Error(message);
  error.name = 'AbortError';
  error.code = reason === 'timeout' ? 'SYNC_TIMEOUT' : 'SYNC_CANCELLED';
  return error;
};

const assertSyncActive = (signal) => {
  if (signal?.aborted) throw syncAbortError(signal.reason);
};

const assertSyncIdentity = (signal, revision, userId) => {
  assertSyncActive(signal);
  const identity = getSessionIdentity();
  if (identity.revision !== revision ||
      userId !== undefined && identity.userId !== undefined && identity.userId !== userId) {
    throw syncAbortError('session');
  }
};

const runSyncStep = async (run, parentSignal, timeoutMs = SYNC_OPERATION_TIMEOUT_MS) => {
  assertSyncActive(parentSignal);
  const controller = new AbortController();
  let rejectStopped;
  const stopped = new Promise((_, reject) => { rejectStopped = reject; });
  const stop = (reason) => {
    rejectStopped(syncAbortError(reason));
    controller.abort(reason);
  };
  const cancel = () => stop(parentSignal.reason);
  parentSignal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => stop('timeout'), timeoutMs);
  try {
    return await Promise.race([stopped, run(controller.signal)]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', cancel);
  }
};

export const syncOperationWithTimeout = (userId, operation, timeoutMs, reportHttp, signal) =>
  runSyncStep(requestSignal =>
    syncOperation(userId, operation, { signal: requestSignal, reportHttp }), signal, timeoutMs);

export const resumeTaskSync = () => {
  if (!syncOnline || !syncSessionReady) return;
  syncPendingTasks({ automatic: true, retryAuth: true }).catch(error => {
    console.warn('[Sync] Falha ao retomar envio:', error);
  });
  pullRemoteTasks({ automatic: true }).catch(error => {
    console.warn('[Sync] Falha ao retomar leitura:', error);
  });
};

const stopTaskSync = (reason) => {
  sendRetry.clear();
  pullRetry.clear();
  activeSyncController?.abort(reason);
  activePullController?.abort(reason);
  updateTaskSyncStatus({ sending: false, pulling: false, sendConfirmed: false, pullConfirmed: false });
};

export const setTaskSyncOnline = (online, source, network) => {
  const wasOnline = syncOnline === true;
  syncOnline = online === true;
  recordSyncTransition('connectivity', {
    source,
    reachable: network?.isInternetReachable ?? null,
    connected: network?.isConnected ?? null,
  });
  if (!syncOnline) {
    stopTaskSync('offline');
    return;
  }
  if (wasOnline) return;
  resumeTaskSync();
};

export const setTaskSyncSessionReady = (ready) => {
  syncSessionReady = ready === true;
  sessionVersion += 1;
  recordSyncTransition('session-readiness');
  if (!syncSessionReady) {
    stopTaskSync('session');
    return;
  }
  resumeTaskSync();
};

export const syncPendingTasks = ({ automatic = false, retryAuth = false } = {}) => {
  if (syncOnline !== true || !syncSessionReady) {
    recordSyncTransition('send-waiting');
    return Promise.resolve(0);
  }
  if (syncPromise) {
    if (activeSyncController.signal.aborted) {
      return syncPromise.catch(() => {}).then(() => syncPendingTasks({ automatic, retryAuth }));
    }
    syncRequested = {
      automatic: automatic && (syncRequested?.automatic ?? true),
      retryAuth: retryAuth || (syncRequested?.retryAuth ?? false),
    };
    recordSyncTransition('send-requested');
    return syncPromise;
  }
  if (automatic && sendRetry.scheduled) return Promise.resolve(0);
  sendRetry.clear();

  const controller = new AbortController();
  const { signal } = controller;
  activeSyncController = controller;
  const identityRevision = getSessionIdentity().revision;
  let attemptedSessionVersion = sessionVersion;
  let userId;
  let queueConfirmed = false;
  const assertSameIdentity = () => assertSyncIdentity(signal, identityRevision, userId);
  syncPromise = (async () => {
    let synced = 0;

    while (true) {
      assertSameIdentity();
      // Ler a próxima operação sem interferir
      // com gravações locais em curso.
      const operation = await enqueueWrite(async () => {
        const state = await getState();
        recordQueueState(state);
        updateTaskSyncStatus({
          pending: state.pendingOps.length,
          failureCategory: state.pendingOps[0]?.sync?.category ?? null,
        });
        return state.pendingOps[0] ?? null;
      });

      assertSameIdentity();
      if (!operation) {
        queueConfirmed = true;
        break;
      }
      const headFailure = operation.sync?.category;
      if (automatic && (headFailure === 'validation' || headFailure === 'conflict' ||
          headFailure === 'auth' && !retryAuth)) break;

      if (userId === undefined) {
        attemptedSessionVersion = sessionVersion;
        userId = await traceSync('send-session', () => runSyncStep(getAuthenticatedUserId, signal));
        assertSameIdentity();
      }

      // Preserve the operation and record only safe, actionable metadata.
      try {
        attemptedSessionVersion = sessionVersion;
        await traceSync('send', reportHttp =>
          syncOperationWithTimeout(userId, operation, SYNC_OPERATION_TIMEOUT_MS, reportHttp, signal), {
          operation,
          attempt: (Number.isSafeInteger(operation.sync?.attempts) && operation.sync.attempts >= 0
            ? operation.sync.attempts : 0) + 1,
        });
      } catch (error) {
        const failure = classifyTaskSyncError(error);
        assertSameIdentity();
        if (error?.code === 'SYNC_CANCELLED') throw error;
        try {
          await enqueueWrite(async () => {
            assertSameIdentity();
            const state = await getState();
            assertSameIdentity();
            await saveState({
              ...state,
              pendingOps: state.pendingOps.map(item => item.id === operation.id
                ? {
                    ...item,
                    sync: {
                      ...failure,
                      attempts: (Number.isSafeInteger(item.sync?.attempts) && item.sync.attempts >= 0
                        ? item.sync.attempts : 0) + 1,
                      lastAttemptAt: new Date().toISOString(),
                    },
                  }
                : item),
            });
          });
        } catch {
          // Metadata persistence must not remove work or hide the send error.
          console.warn('[Sync] Não foi possível guardar o diagnóstico da operação.');
        }
        assertSameIdentity();
        throw error;
      }

      // Remover apenas a operação confirmada.
      await traceSync('acknowledge', () => enqueueWrite(async () => {
        assertSameIdentity();
        const state = await getState();
        assertSameIdentity();

        const nextState = {
          ...state,
          pendingOps: state.pendingOps.filter(
            (item) => item.id !== operation.id,
          ),
        };

        await saveState(nextState);
      }), { operation });

      sendRetry.reset();
      synced += 1;
    }

    return synced;
  })();
  updateTaskSyncStatus({ sending: true, sendFailed: false });
  recordSyncTransition('send-started');

  const currentPromise = syncPromise;
  const release = () => {
    const requested = syncRequested;
    activeSyncController = null;
    syncPromise = null;
    syncRequested = null;
    recordSyncTransition('send-released');
    if (requested) recordSyncTransition('send-request-consumed');
    return requested;
  };
  const tryAgain = (options) => syncPendingTasks(options).catch(error => {
    console.warn('[Sync] Falha na nova tentativa:', error);
  });

  currentPromise.then(
    () => {
      const requested = release();
      if (queueConfirmed) sendRetry.reset();
      updateTaskSyncStatus({ sending: false, sendFailed: false, sendConfirmed: queueConfirmed && !signal.aborted });
      if (requested) tryAgain(requested);
    },
    (error) => {
      const requested = release();
      if (error?.code === 'SYNC_CANCELLED' || signal.aborted) {
        updateTaskSyncStatus({ sending: false });
        if (requested) tryAgain(requested);
        return;
      }
      const failure = classifyTaskSyncError(error);
      updateTaskSyncStatus({
        sending: false,
        sendFailed: true,
        failureCategory: failure.category,
      });
      if (sessionRenewedAfterAuthError(error, attemptedSessionVersion)) {
        tryAgain({ automatic: true, retryAuth: true });
      } else if (shouldRetry(error)) {
        sendRetry.schedule();
      }
    },
  );

  return currentPromise;
};

export const TASK_STORAGE_INFO = {
  schemaVersion: 1,
  key: '@my_time_tasks_local_v1',
};
