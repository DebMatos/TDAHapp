import {
  createTaskSession,
  stopTaskSession,
  getTaskDurationMs,
} from '../domain/taskSessionModel';
import {
  loadSessions,
  saveSessions,
} from '../repositories/localTaskSessionRepository';

// Serializa operações para evitar duas sessões simultâneas no dispositivo.
// A sincronização entre dispositivos será tratada numa fase posterior.
export const createTaskExecutionService = ({
  load = loadSessions,
  save = saveSessions,
  now = () => new Date().toISOString(),
  makeId = () => `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
} = {}) => {
  let writeQueue = Promise.resolve();

  const enqueue = (operation) => {
    const result = writeQueue.then(operation);
    writeQueue = result.catch(() => {});
    return result;
  };

  const findActive = (sessions) =>
    sessions.find((session) => session.endedAt === null) ?? null;

  const startTask = (taskId) => enqueue(async () => {
    if (typeof taskId !== 'string' || !taskId.trim()) {
      throw new TypeError('É necessário identificar a tarefa.');
    }

    const sessions = await load();
    const active = findActive(sessions);
    if (active) {
      throw new Error(`Já existe uma tarefa em execução: ${active.taskId}`);
    }

    const session = createTaskSession({
      id: makeId(),
      taskId,
      startedAt: now(),
    });
    await save([...sessions, session]);
    return session;
  });

  const pauseTask = (taskId) => enqueue(async () => {
    const sessions = await load();
    const active = findActive(sessions);
    if (!active || active.taskId !== taskId) {
      throw new Error('A tarefa não tem uma sessão em execução.');
    }

    const stopped = stopTaskSession(active, now());
    await save(sessions.map((session) =>
      session.id === active.id ? stopped : session
    ));
    return stopped;
  });

  // Termina a execução sem alterar o estado da tarefa.
  // É seguro chamar quando a tarefa já está pausada ou não tem sessão aberta.
  const finishTask = (taskId) => enqueue(async () => {
    const sessions = await load();
    const active = findActive(sessions);
    if (!active || active.taskId !== taskId) return null;
    const finished = stopTaskSession(active, now());
    await save(sessions.map((session) =>
      session.id === active.id ? finished : session
    ));
    return finished;
  });

  const getActiveSession = async () => {
    await writeQueue;
    return findActive(await load());
  };

  const getTrackedDurationMs = async (taskId, timestamp = now()) => {
    await writeQueue;
    return getTaskDurationMs(await load(), taskId, timestamp);
  };

  // null significa que nunca foi iniciada uma medição para esta tarefa.
  const getRecordedDurationMs = async (taskId, timestamp = now()) => {
    await writeQueue;
    const sessions = await load();
    if (!sessions.some((session) => session.taskId === taskId)) return null;
    return getTaskDurationMs(sessions, taskId, timestamp);
  };

  return {
    startTask,
    resumeTask: startTask,
    pauseTask,
    finishTask,
    getActiveSession,
    getTrackedDurationMs,
    getRecordedDurationMs,
  };
};

const taskExecutionService = createTaskExecutionService();
export const startTask = taskExecutionService.startTask;
export const resumeTask = taskExecutionService.resumeTask;
export const pauseTask = taskExecutionService.pauseTask;
export const finishTask = taskExecutionService.finishTask;
export const getActiveSession = taskExecutionService.getActiveSession;
export const getTrackedDurationMs = taskExecutionService.getTrackedDurationMs;

export const getRecordedDurationMs = taskExecutionService.getRecordedDurationMs;
