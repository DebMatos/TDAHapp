import {
  createTask as createTaskModel,
  updateTask as updateTaskModel,
  toggleTaskCompletion,
} from '../domain/taskModel';

import {
  loadTasks,
  saveTasks,
} from '../data/taskRepository';

export const createTask = async (
  values,
    currentTasks = null
) => {
  const tasks =
  currentTasks ??
    await loadTasks();

  const task =
    createTaskModel({
      ...values,

      id: `task-${Date.now()}`,

      position: tasks.length,
    });

  return saveTasks([
    ...tasks,
    task,
  ]);
};

export const moveTask = async ({
  tasks: currentTasks,
  taskId,
  schedule,
}) => {
  const tasks =
    currentTasks ??
    await loadTasks();

  const updatedTasks =
    tasks.map((task) =>
      task.id === taskId
        ? updateTaskModel(
            task,
            schedule
          )
        : task
    );

  return saveTasks(updatedTasks);
};

export const toggleCompletion = async (
  taskId,
 currentTasks = null

) => {
  const tasks =
    currentTasks ??
    await loadTasks();

  const updatedTasks =
    tasks.map((task) =>
      task.id === taskId
        ? toggleTaskCompletion(task)
        : task
    );

  return saveTasks(updatedTasks);
};

export const updateTask = async (
  taskId,
  changes,
  currentTasks = null

) => {
  const tasks =
      currentTasks ??
    await loadTasks();

  const updatedTasks =
    tasks.map((task) =>
      task.id === taskId
        ? updateTaskModel(
            task,
            changes
          )
        : task
    );

  return saveTasks(updatedTasks);
};

export const deleteTask = async (
  taskId,
 currentTasks = null
) => {
  const tasks =
      currentTasks ??
    await loadTasks();

  return saveTasks(
    tasks.filter(
      (task) =>
        task.id !== taskId
    )
  );
};