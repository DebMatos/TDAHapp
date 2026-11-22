const MINUTE_MS = 60_000;

const getLocalDateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const getTaskWindow = (task, now) => {
  const date = task.date || getLocalDateKey(now);
  const startTime = task.startTime || '07:00';
  const start = new Date(`${date}T${startTime}:00`);

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const durationMinutes = Math.max(1, Number(task.durationMinutes) || 30);

  return {
    task,
    start,
    end: new Date(start.getTime() + durationMinutes * MINUTE_MS),
  };
};

export const formatTaskCountdown = (minutes, phase) => {
  const safeMinutes = Math.max(1, Math.ceil(minutes));

  if (phase === 'current') {
    return safeMinutes === 1 ? 'falta 1 min' : `faltam ${safeMinutes} min`;
  }

  if (safeMinutes < 60) {
    return `em ${safeMinutes} min`;
  }

  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  return remainingMinutes
    ? `daqui a ${hours}h ${remainingMinutes}m`
    : `daqui a ${hours}h`;
};

export const getContextualTaskCountdown = (tasks, nowValue = new Date()) => {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);

  if (Number.isNaN(now.getTime())) {
    return null;
  }

  const relevant = tasks
    .filter((task) => (task.status ?? 'pending') === 'pending')
    .map((task) => getTaskWindow(task, now))
    .filter((window) => window && window.end.getTime() > now.getTime())
    .sort((left, right) =>
      left.start.getTime() - right.start.getTime() ||
      String(left.task.id).localeCompare(String(right.task.id)),
    )[0];

  if (!relevant) {
    return null;
  }

  const isCurrent = relevant.start.getTime() <= now.getTime();
  const target = isCurrent ? relevant.end : relevant.start;
  const minutes = (target.getTime() - now.getTime()) / MINUTE_MS;
  const phase = isCurrent ? 'current' : 'upcoming';

  return {
    taskId: relevant.task.id,
    phase,
    minutes: Math.max(1, Math.ceil(minutes)),
    label: formatTaskCountdown(minutes, phase),
  };
};
