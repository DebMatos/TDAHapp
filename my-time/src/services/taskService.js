import {
  createTask as createTaskModel,
  updateTask as updateTaskModel,
  toggleTaskCompletion,
} from '../domain/taskModel';

import {
  loadTasks,
  createTask as createStoredTask,
  updateTask as updateStoredTask,
  deleteTask as deleteStoredTask,
} from '../data/taskRepository';

const getNextPosition = (tasks) => {
  const maxPosition = tasks.reduce(
    (max, task) => {
      const position = Number(task.position);

      return Number.isFinite(position)
        ? Math.max(max, position)
        : max;
    },
    -1,
  );

  return maxPosition + 1;
};

/* -------------------------------------------------------
   CREATE
------------------------------------------------------- */

export const createTask = async (
  values,
  currentTasks = null,
) => {
  const tasks =
    currentTasks ?? await loadTasks();

  const task = createTaskModel({
    ...values,

    id: `task-${Date.now()}`,

    position: getNextPosition(tasks),
  });

  const savedTask =
    await createStoredTask(task);

  return [
    ...tasks,
    savedTask,
  ];
};

/* -------------------------------------------------------
   MOVE
------------------------------------------------------- */

export const moveTask = async ({
  tasks: currentTasks,
  taskId,
  schedule,
}) => {
  const tasks =
    currentTasks ?? await loadTasks();

  const currentTask =
    tasks.find(
      (task) => task.id === taskId,
    );

  if (!currentTask) {
    return tasks;
  }

  const updatedTask =
    updateTaskModel(
      currentTask,
      schedule,
    );

  const savedTask =
    await updateStoredTask(
      updatedTask,
    );

  return tasks.map((task) =>
    task.id === taskId
      ? savedTask
      : task,
  );
};

/* -------------------------------------------------------
   TOGGLE COMPLETION
------------------------------------------------------- */

export const toggleCompletion = async (
  taskId,
  currentTasks = null,
) => {
  const tasks =
    currentTasks ?? await loadTasks();

  const currentTask =
    tasks.find(
      (task) => task.id === taskId,
    );

  if (!currentTask) {
    return tasks;
  }

  const updatedTask =
    toggleTaskCompletion(
      currentTask,
    );

  const savedTask =
    await updateStoredTask(
      updatedTask,
    );

  return tasks.map((task) =>
    task.id === taskId
      ? savedTask
      : task,
  );
};

/* -------------------------------------------------------
   UPDATE
------------------------------------------------------- */

export const updateTask = async (
  taskId,
  changes,
  currentTasks = null,
) => {
  const tasks =
    currentTasks ?? await loadTasks();

  const currentTask =
    tasks.find(
      (task) => task.id === taskId,
    );

  if (!currentTask) {
    return tasks;
  }

  const updatedTask =
    updateTaskModel(
      currentTask,
      changes,
    );

  const savedTask =
    await updateStoredTask(
      updatedTask,
    );

  return tasks.map((task) =>
    task.id === taskId
      ? savedTask
      : task,
  );
};

/* -------------------------------------------------------
   DELETE
------------------------------------------------------- */

export const deleteTask = async (
  taskId,
  currentTasks = null,
) => {
  const tasks =
    currentTasks ?? await loadTasks();

  await deleteStoredTask(taskId);

  return tasks.filter(
    (task) =>
      task.id !== taskId,
  );
};