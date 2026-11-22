import { classifyTaskSyncError } from '../services/taskSyncErrors';

export const taskSyncDiagnosticsEnabled = typeof __DEV__ !== 'undefined' && __DEV__;

const HISTORY_LIMIT = 40;
const listeners = new Set();
const payloadFields = [
  'id', 'title', 'notes', 'projectId', 'categoryId', 'priority', 'date',
  'startTime', 'durationMinutes', 'dueDate', 'dueTime', 'status', 'repeat',
  'subtasks', 'position', 'source', 'createdAt', 'updatedAt', 'completedAt', 'abandonedAt',
];
let history = [];
let sequence = 0;

export const getDiagnosticOperationId = (operation) => {
  const id = operation?.id;
  return typeof id === 'string' && /^\d{13}-[a-z0-9]{1,16}$/.test(id) ? id : null;
};

export const subscribeTaskSyncDiagnostics = (listener) => {
  if (!taskSyncDiagnosticsEnabled) return () => {};
  listeners.add(listener);
  listener(history);
  return () => listeners.delete(listener);
};

const publish = (nextHistory) => {
  history = nextHistory;
  for (const listener of listeners) {
    try {
      listener(history);
    } catch {
      // Diagnostics cannot interfere with synchronization.
    }
  }
};

const addEntry = (entry) => {
  const id = ++sequence;
  const nextHistory = [{ ...entry, id, startedAt: Date.now() }, ...history];
  if (nextHistory.length > HISTORY_LIMIT) {
    const oldestFinished = nextHistory.findLastIndex(item => item.outcome !== 'pending');
    nextHistory.splice(oldestFinished, 1);
  }
  publish(nextHistory);
  return id;
};

export const recordTaskSyncTransition = (phase, state, details) => {
  if (taskSyncDiagnosticsEnabled) addEntry({ phase, state, ...details });
};

export const traceTaskSyncDiagnostic = (phase, readState, run, { operation, attempt } = {}) => {
  if (!taskSyncDiagnosticsEnabled) return run();

  const started = Date.now();
  const operationId = getDiagnosticOperationId(operation);
  const id = addEntry({
    phase,
    attempt,
    operationId,
    operationType: ['create', 'update', 'delete'].includes(operation?.type) ? operation.type : null,
    payload: operation?.type === 'delete'
      ? ['taskId']
      : payloadFields.filter(field => Object.hasOwn(operation?.task ?? {}, field)),
    outcome: 'pending',
    state: readState(),
  });
  let status;
  let finished = false;
  const reportHttp = (value) => {
    if (!Number.isInteger(value) || value !== 0 && (value < 100 || value > 599)) return;
    status = value;
    if (finished) {
      recordTaskSyncTransition('late-response', readState(), {
        attempt, operationId, status, durationMs: Math.max(0, Date.now() - started),
      });
    }
  };
  const finish = (outcome, error) => {
    if (status === undefined) reportHttp(error?.status);
    finished = true;
    if (!history.some(entry => entry.id === id)) return;
    const failure = outcome === 'failed'
      ? classifyTaskSyncError({ code: error?.code, name: error?.name, status })
      : null;
    publish(history.map(entry => entry.id === id ? {
      ...entry,
      outcome,
      status,
      durationMs: Math.max(0, Date.now() - started),
      failureCategory: failure?.category,
      errorCode: failure?.lastErrorCode,
      stateAfter: readState(),
    } : entry));
  };

  try {
    const result = run(reportHttp);
    result.then(
      () => finish('complete'),
      error => finish('failed', error),
    );
    return result;
  } catch (error) {
    finish('failed', error);
    throw error;
  }
};
