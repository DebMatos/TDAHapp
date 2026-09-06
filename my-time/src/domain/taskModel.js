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

const REPEAT_ALIASES = {
  Nunca: 'never',
  'Todos os dias': 'daily',
  'Dias úteis': 'weekdays',
  'Todas as semanas': 'weekly',
};

const pad2 = (value) =>
  String(value).padStart(2, '0');

/* -------------------------------------------------------
   DATA
------------------------------------------------------- */

export const normalizeDate = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  // Formato canónico
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Compatibilidade com DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');

    return `${year}-${month}-${day}`;
  }

  return null;
};

/* -------------------------------------------------------
   TEMPO
------------------------------------------------------- */

export const minutesToTime = (value) => {
  const minutes = Number(value);

  if (!Number.isFinite(minutes)) {
    return null;
  }

  const dayMinutes = 24 * 60;

  const normalized =
    ((Math.round(minutes) % dayMinutes) +
      dayMinutes) %
    dayMinutes;

  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return `${pad2(hours)}:${pad2(mins)}`;
};

export const normalizeTime = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const match = value.match(
    /^(\d{1,2}):(\d{2})$/
  );

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

const normalizeDuration = (task) => {
  const raw =
    task.durationMinutes ??
    task.timeMinutes ??
    task.duration;

  if (
    raw === null ||
    raw === undefined ||
    raw === ''
  ) {
    return null;
  }

  const duration = Number(raw);

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return null;
  }

  return Math.round(duration);
};

const normalizeStatus = (task) => {
  if (VALID_STATUSES.has(task.status)) {
    return task.status;
  }

  return task.completed
    ? 'completed'
    : 'pending';
};

const normalizePriority = (value) =>
  VALID_PRIORITIES.has(value)
    ? value
    : 'normal';

const normalizeRepeat = (value) => {
  const normalized =
    REPEAT_ALIASES[value] || value;

  return VALID_REPEATS.has(normalized)
    ? normalized
    : 'never';
};

const normalizeSource = (value) =>
  VALID_SOURCES.has(value)
    ? value
    : 'app';

const normalizePosition = (
  value,
  fallback = 0
) => {
  const position = Number(value);

  return Number.isFinite(position)
    ? position
    : fallback;
};

/* -------------------------------------------------------
   SUBTASKS
------------------------------------------------------- */

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
      id:
        subtask.id ??
        `legacy-subtask-${index}`,

      title: String(
        subtask.title ?? ''
      ).trim(),

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
   COMPATIBILIDADE COM MODELO ANTIGO
------------------------------------------------------- */

const getLegacyStartTime = (task) => {
  const canonical =
    normalizeTime(task.startTime);

  if (canonical) {
    return canonical;
  }

  const legacyTime =
    normalizeTime(task.timeOfDay);

  if (legacyTime) {
    return legacyTime;
  }

  if (
    task.startMinsPlanned !== null &&
    task.startMinsPlanned !== undefined
  ) {
    return minutesToTime(
      task.startMinsPlanned
    );
  }

  return null;
};

/* -------------------------------------------------------
   TASK CANÓNICA
------------------------------------------------------- */

export const normalizeTask = (
  task,
  options = {}
) => {
  if (
    !task ||
    typeof task !== 'object'
  ) {
    return null;
  }

  const now =
    options.now ||
    new Date().toISOString();

  const status =
    normalizeStatus(task);

  const createdAt =
    task.createdAt || now;

  const updatedAt =
    task.updatedAt || createdAt;

  return {
    id: task.id,

    // Conteúdo
    title: String(
      task.title ?? ''
    ).trim(),

    notes: String(
      task.notes ??
        task.description ??
        ''
    ).trim(),

    // Organização
    projectId:
      task.projectId ?? null,

    categoryId:
      task.categoryId ?? 'inbox',

    priority:
      normalizePriority(
        task.priority
      ),

    // Planeamento
    date:
      normalizeDate(task.date) ??
      options.fallbackDate ??
      null,

    startTime:
      getLegacyStartTime(task),

    durationMinutes:
      normalizeDuration(task),

    // Deadline
    dueDate:
      normalizeDate(task.dueDate),

    dueTime:
      normalizeTime(task.dueTime),

    // Estado
    status,

    // Recorrência
    repeat:
      normalizeRepeat(task.repeat),

    // Subtarefas
    subtasks:
      normalizeSubtasks(
        task.subtasks
      ),

    // Ordenação
    position:
      normalizePosition(
        task.position,
        options.position ?? 0
      ),

    // Origem
    source:
      normalizeSource(task.source),

    // Metadados
    createdAt,
    updatedAt,

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

/* -------------------------------------------------------
   LISTA DE TASKS
------------------------------------------------------- */

export const normalizeTasks = (
  tasks,
  options = {}
) => {
  if (!Array.isArray(tasks)) {
    return [];
  }

  // Todas recebem o mesmo instante durante
  // uma operação de migração.
  const now =
    options.now ||
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
   CRIAÇÃO
------------------------------------------------------- */

export const createTask = (
  values = {},
  options = {}
) =>
  normalizeTask(
    {
      ...values,

      status:
        values.status ??
        'pending',

      priority:
        values.priority ??
        'normal',

      repeat:
        values.repeat ??
        'never',

      source:
        values.source ??
        'app',

      subtasks:
        values.subtasks ??
        [],
    },
    options
  );