const copySubtasks = (subtasks) => {
  if (!Array.isArray(subtasks)) return [];

  return subtasks.map((subtask, index) => ({
    title: String(subtask?.title ?? '').trim(),
    status: 'pending',
    position: Number.isFinite(Number(subtask?.position))
      ? Number(subtask.position)
      : index,
  }));
};

// Keep only reusable planning data. Identity, lifecycle timestamps and
// execution data deliberately never enter the application clipboard.
export const copyTaskForPaste = (task) => ({
  title: String(task?.title ?? '').trim(),
  notes: String(task?.notes ?? '').trim(),
  projectId: task?.projectId ?? null,
  categoryId: task?.categoryId ?? 'inbox',
  priority: task?.priority ?? null,
  durationMinutes: Number(task?.durationMinutes) || 30,
  dueDate: task?.dueDate ?? null,
  dueTime: task?.dueTime ?? null,
  repeat: task?.repeat ?? 'never',
  subtasks: copySubtasks(task?.subtasks),
  source: task?.source ?? 'app',
});

let currentTask = null;

export const storeCopiedTask = (task) => {
  currentTask = copyTaskForPaste(task);
  return currentTask;
};

export const getCopiedTask = () => currentTask;

export const buildPastedTask = (copiedTask, schedule) => ({
  ...copyTaskForPaste(copiedTask),
  subtasks: copySubtasks(copiedTask?.subtasks).map((subtask, index) => ({
    ...subtask,
    id: `subtask-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
  })),
  date: schedule.date,
  startTime: schedule.startTime,
  status: 'pending',
});
