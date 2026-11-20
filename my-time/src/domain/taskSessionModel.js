// Uma sessão representa um intervalo de execução real de uma tarefa.
// O horário planeado continua a pertencer ao modelo Task.

const parseTimestamp = (value, field) => {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} deve ser uma data ISO válida.`);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    throw new TypeError(`${field} deve ser uma data ISO válida.`);
  }

  return timestamp;
};

export const roundTimestampToMinuteMs = (value, field = 'timestamp') =>
  Math.round(parseTimestamp(value, field) / 60000) * 60000;

export const normalizeTaskSession = (session) => {
  if (!session || typeof session !== 'object') {
    throw new TypeError('Sessão inválida.');
  }

  if (typeof session.id !== 'string' || !session.id.trim()) {
    throw new TypeError('A sessão precisa de um id.');
  }

  if (typeof session.taskId !== 'string' || !session.taskId.trim()) {
    throw new TypeError('A sessão precisa de um taskId.');
  }

  const startedAtMs = parseTimestamp(session.startedAt, 'startedAt');
  const endedAt = session.endedAt ?? null;

  if (endedAt !== null) {
    const endedAtMs = parseTimestamp(endedAt, 'endedAt');
    if (endedAtMs < startedAtMs) {
      throw new RangeError('endedAt não pode ser anterior a startedAt.');
    }
  }

  return {
    id: session.id,
    taskId: session.taskId,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: endedAt === null ? null : new Date(Date.parse(endedAt)).toISOString(),
  };
};

export const createTaskSession = ({ id, taskId, startedAt = new Date().toISOString() }) =>
  normalizeTaskSession({ id, taskId, startedAt, endedAt: null });

export const stopTaskSession = (session, endedAt = new Date().toISOString()) => {
  const current = normalizeTaskSession(session);
  if (current.endedAt !== null) {
    throw new Error('A sessão já terminou.');
  }
  return normalizeTaskSession({ ...current, endedAt });
};

export const getSessionDurationMs = (session, now = new Date().toISOString()) => {
  const current = normalizeTaskSession(session);
  const start = roundTimestampToMinuteMs(current.startedAt, 'startedAt');
  const end = current.endedAt === null
    ? roundTimestampToMinuteMs(now, 'now')
    : roundTimestampToMinuteMs(current.endedAt, 'endedAt');

  return Math.max(0, end - start);
};

export const getTaskDurationMs = (sessions, taskId, now = new Date().toISOString()) => {
  if (!Array.isArray(sessions)) {
    throw new TypeError('sessions deve ser uma lista.');
  }

  return sessions
    .filter((session) => session.taskId === taskId)
    .reduce((total, session) => total + getSessionDurationMs(session, now), 0);
};
