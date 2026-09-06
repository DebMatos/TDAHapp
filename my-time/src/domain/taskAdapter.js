import {
  normalizeTask,
} from './taskModel';

const timeToMinutes = (value) => {
  if (
    !value ||
    typeof value !== 'string' ||
    !value.includes(':')
  ) {
    return null;
  }

  const [hours, minutes] =
    value.split(':').map(Number);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

const REPEAT_LABELS = {
  never: 'Nunca',
  daily: 'Todos os dias',
  weekdays: 'Dias úteis',
  weekly: 'Todas as semanas',
};

/*
 * Temporário.
 *
 * Converte o modelo canónico para o formato
 * que os componentes antigos ainda esperam.
 *
 * Quando Timeline/Modal trabalharem diretamente
 * com o modelo novo, este adapter pode desaparecer.
 */
export const taskToLegacyView = (task) => {
  const startMinsPlanned =
    timeToMinutes(task.startTime);

  return {
    ...task,

    // aliases temporários
    timeOfDay: task.startTime,
    startMinsPlanned,

    timeMinutes:
      task.durationMinutes,

    duration:
      task.durationMinutes,

    description:
      task.notes,

    completed:
      task.status === 'completed',

    repeat:
      REPEAT_LABELS[task.repeat] ??
      'Nunca',
  };
};

export const legacyTaskToCanonical = (
  task,
  options = {}
) =>
  normalizeTask(task, options);

export const canonicalTaskToLegacy =
  taskToLegacyView;

/*
 * Helper útil enquanto a app ainda mistura
 * componentes antigos e modelo novo.
 */
export const normalizeTaskForLegacyView = (
  task,
  options = {}
) => {
  const canonical =
    normalizeTask(task, options);

  if (!canonical) {
    return null;
  }

  return taskToLegacyView(canonical);
};