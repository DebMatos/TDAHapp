const VALID_STATUSES = new Set([
  'pending',
  'completed',
  'abandoned',
]);

const VALID_PRIORITIES = new Set([
  'low',
  'normal',
  'high',
]);

const VALID_REPEATS = new Set([
  'never',
  'daily',
  'weekdays',
  'weekly',
]);

const VALID_SOURCES = new Set([
  'app',
  'api',
  'alexa',
  'dashboard',
  'ai',
  'import',
]);

const pad2 = (value) => String(value).padStart(2, '0');

/* -------------------------------------------------------
   DATA E TEMPO
------------------------------------------------------- */

export const normalizeDate = (value) => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  return value;
};

export const minutesToTime = (value) => {
  const minutes = Number(value);

  if (!Number.isFinite(minutes)) {
    return null;
  }

  const dayMinutes = 24 * 60;
  const normalized =
    ((Math.round(minutes) % dayMinutes) + dayMinutes) %
    dayMinutes;

  return `${pad2(Math.floor(normalized / 60))}:${pad2(
    normalized % 60
  )}`;
};

export const normalizeTime = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return `${pad2(hours)}:${pad2(minutes)}`;
};

/* -------------------------------------------------------
   CAMPOS
------------------------------------------------------- */

const normalizeDuration = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const duration = Number(value);

  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return Math.round(duration);
};

const normalizeStatus = (value) =>
  VALID_STATUSES.has(value) ? value : 'pending';

const normalizePriority = (value) =>
  VALID_PRIORITIES.has(value) ? value : 'normal';

const normalizeRepeat = (value) =>
  VALID_REPEATS.has(value) ? value : 'never';

const normalizeSource = (value) =>
  VALID_SOURCES.has(value) ? value : 'app';

const normalizePosition = (value, fallback = 0) => {
  const position = Number(value);

  return Number.isFinite(position) ? position : fallback;
};

const normalizeSubtasks = (subtasks) => {
  if (!Array.isArray(subtasks)) {
    return [];
  }

  return subtasks
    .filter(
      (subtask) =>
        subtask &&
        typeof subtask === 'object'
    )
    .map((subtask, index) => ({
      id: subtask.id ?? `subtask-${index}`,
      title: String(subtask.title ?? '').trim(),
      status:
        subtask.status === 'completed'
          ? 'completed'
          : 'pending',
      position: normalizePosition(
        subtask.position,
        index
      ),
    }));
};

/* -------------------------------------------------------
   TASK CANÓNICA
------------------------------------------------------- */

export const normalizeTask = (
  task,
  options = {}
) => {
  if (!task || typeof task !== 'object') {
    return null;
  }

  const now =
    options.now ??
    new Date().toISOString();

  const status = normalizeStatus(task.status);
  const createdAt = task.createdAt ?? now;

  return {
    id: task.id,

    title: String(task.title ?? '').trim(),
    notes: String(task.notes ?? '').trim(),

    projectId: task.projectId ?? null,
    categoryId: task.categoryId ?? 'inbox',
    priority: normalizePriority(task.priority),

    date:
      normalizeDate(task.date) ??
      options.fallbackDate ??
      null,
    startTime: normalizeTime(task.startTime),
    durationMinutes: normalizeDuration(
      task.durationMinutes
    ),

    dueDate: normalizeDate(task.dueDate),
    dueTime: normalizeTime(task.dueTime),

    status,
    repeat: normalizeRepeat(task.repeat),
    subtasks: normalizeSubtasks(task.subtasks),

    position: normalizePosition(
      task.position,
      options.position ?? 0
    ),

    source: normalizeSource(task.source),

    createdAt,
    updatedAt: task.updatedAt ?? createdAt,

    completedAt:
      status === 'completed'
        ? task.completedAt ?? null
        : null,

    abandonedAt:
      status === 'abandoned'
        ? task.abandonedAt ?? null
        : null,
  };
};

export const normalizeTasks = (
  tasks,
  options = {}
) => {
  if (!Array.isArray(tasks)) {
    return [];
  }

  const now =
    options.now ??
    new Date().toISOString();

  return tasks
    .map((task, index) =>
      normalizeTask(task, {
        ...options,
        now,
        position: index,
      })
    )
    .filter(Boolean);
};

/* -------------------------------------------------------
   OPERAÇÕES
------------------------------------------------------- */

export const createTask = (
  values = {},
  options = {}
) =>
  normalizeTask(
    {
      ...values,
      status: values.status ?? 'pending',
      priority: values.priority ?? 'normal',
      repeat: values.repeat ?? 'never',
      source: values.source ?? 'app',
      subtasks: values.subtasks ?? [],
    },
    options
  );

export const updateTask = (
  task,
  changes = {},
  options = {}
) => {
  const now =
    options.now ??
    new Date().toISOString();

  const previous = normalizeTask(task, {
    ...options,
    now,
  });

  const status = changes.status ?? previous.status;

  return normalizeTask(
    {
      ...previous,
      ...changes,

      id: previous.id,
      createdAt: previous.createdAt,
      updatedAt: now,

      status,

      completedAt:
        status === 'completed'
          ? changes.completedAt ??
            previous.completedAt ??
            now
          : null,

      abandonedAt:
        status === 'abandoned'
          ? changes.abandonedAt ??
            previous.abandonedAt ??
            now
          : null,
    },
    {
      ...options,
      now,
    }
  );
};

export const toggleTaskCompletion = (
  task,
  options = {}
) => {
  const now =
    options.now ??
    new Date().toISOString();

  const canonical = normalizeTask(task, {
    ...options,
    now,
  });

  if (canonical.status === 'abandoned') {
    return canonical;
  }

  const isCompleted =
    canonical.status === 'completed';

  return updateTask(
    canonical,
    {
      status: isCompleted
        ? 'pending'
        : 'completed',
    },
    {
      ...options,
      now,
    }
  );
};