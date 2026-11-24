const MINUTE_MS = 60_000;

export const truncateToMinute = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS);
};

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
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  const duration = hours
    ? `${hours}h${remainingMinutes ? ` ${remainingMinutes} min` : ''}`
    : `${remainingMinutes} min`;

  return phase === 'current' ? duration : `daqui a ${duration}`;
};

export const getContextualTaskCountdowns = (tasks, nowValue = new Date()) => {
  const now = truncateToMinute(nowValue);

  if (!now) {
    return [];
  }

  const windows = tasks
    .filter((task) => (task.status ?? 'pending') === 'pending')
    .map((task) => getTaskWindow(task, now))
    .filter((window) => window && window.end.getTime() > now.getTime())
    .sort((left, right) =>
      left.start.getTime() - right.start.getTime() ||
      String(left.task.id).localeCompare(String(right.task.id)),
    );

  const current = windows
    .filter((window) => window.start.getTime() <= now.getTime())
    .at(-1);
  const upcoming = windows.find((window) => window.start.getTime() > now.getTime());

  return [
    current && { window: current, phase: 'current', target: current.end },
    upcoming && { window: upcoming, phase: 'upcoming', target: upcoming.start },
  ]
    .filter(Boolean)
    .map(({ window, phase, target }) => {
      const targetMinute = truncateToMinute(target);
      const minutes = (targetMinute.getTime() - now.getTime()) / MINUTE_MS;

      return {
        taskId: window.task.id,
        phase,
        minutes: Math.max(1, Math.ceil(minutes)),
        label: formatTaskCountdown(minutes, phase),
      };
    });
};
