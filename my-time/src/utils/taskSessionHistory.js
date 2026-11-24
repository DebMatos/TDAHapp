import {
  getSessionDurationMs,
  getTaskDurationMs,
  roundTimestampToMinuteMs,
} from '../domain/taskSessionModel';

export const formatTrackingMinutes = (minutes) => {
  const safeMinutes = Math.round(Math.max(0, Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (!hours) return `${remaining} min`;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
};

export const getTrackingComparisonLabel = (recordedMinutes, estimatedMinutes) => {
  const difference = recordedMinutes - estimatedMinutes;
  if (difference === 0) return 'Dentro do previsto';
  const duration = formatTrackingMinutes(Math.abs(difference));
  return difference < 0
    ? `${duration} abaixo do previsto`
    : `${duration} acima do previsto`;
};

const getLocalDateKey = (value) => {
  const date = new Date(roundTimestampToMinuteMs(value));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatTime = (value) => new Intl.DateTimeFormat('pt-PT', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(new Date(roundTimestampToMinuteMs(value)));

const formatDate = (value) => new Intl.DateTimeFormat('pt-PT', {
  day: 'numeric',
  month: 'long',
}).format(new Date(roundTimestampToMinuteMs(value)));

export const buildTaskSessionHistory = (sessions, taskId, now = new Date().toISOString()) => {
  const unique = [...new Map(
    sessions.filter((session) => session.taskId === taskId).map((session) => [session.id, session]),
  ).values()].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));

  const groups = [];
  for (const session of unique) {
    const key = getLocalDateKey(session.startedAt);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: formatDate(session.startedAt), sessions: [] };
      groups.push(group);
    }
    group.sessions.push({
      ...session,
      startLabel: formatTime(session.startedAt),
      endLabel: session.endedAt === null ? 'Em curso' : formatTime(session.endedAt),
      durationMinutes: Math.round(getSessionDurationMs(session, now) / 60000),
    });
  }

  return {
    sessions: unique,
    groups,
    totalMinutes: Math.round(getTaskDurationMs(unique, taskId, now) / 60000),
  };
};
