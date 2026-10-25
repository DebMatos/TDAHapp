import {
  createTaskAndLoadTasks,
  updateTaskAndLoadTasks,
  toggleCompletionAndLoadTasks,
  deleteTask as deleteStoredTask,
} from '../data/taskRepository';

/* -------------------------------------------------------
   CREATE
------------------------------------------------------- */

export const createTask = async (values) => {
  return createTaskAndLoadTasks({
    ...values,
    id: `task-${Date.now()}`,
  });
};

/* -------------------------------------------------------
   MOVE
------------------------------------------------------- */

export const moveTask = async ({ taskId, schedule }) => {
  return updateTaskAndLoadTasks(taskId, schedule);
};

/* -------------------------------------------------------
   TOGGLE COMPLETION
------------------------------------------------------- */

export const toggleCompletion = async (taskId) => {
  return toggleCompletionAndLoadTasks(taskId);
};

/* -------------------------------------------------------
   UPDATE
------------------------------------------------------- */

export const updateTask = async (
  taskId,
  changes,
) => {
  return updateTaskAndLoadTasks(
    taskId,
    changes,
  );
};

/* -------------------------------------------------------
   DELETE
------------------------------------------------------- */

export const deleteTask = async (taskId) => {
  return deleteStoredTask(taskId);
};
