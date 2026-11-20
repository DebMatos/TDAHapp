const parseTimestamp = (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const getChronometerDurationMs = (sessions, taskId, now = new Date().toISOString()) => {
  const nowMs = parseTimestamp(now);
  if (!Array.isArray(sessions) || nowMs === null) return 0;

  return sessions
    .filter((session) => session.taskId === taskId)
    .reduce((total, session) => {
      const startMs = parseTimestamp(session.startedAt);
      const endMs = session.endedAt === null ? nowMs : parseTimestamp(session.endedAt);
      if (startMs === null || endMs === null) return total;
      return total + Math.max(0, endMs - startMs);
    }, 0);
};

export const formatChronometerDuration = (milliseconds) => {
  const totalSeconds = Math.floor(Math.max(0, Number(milliseconds) || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
