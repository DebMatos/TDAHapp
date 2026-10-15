
import {
  normalizeTask,
  normalizeTasks,
} from '../domain/taskModel';

import {
  loadState,
  saveState,
} from '../repositories/localTaskRepository';

// Serializa operações para evitar gravações concorrentes.
let writeQueue = Promise.resolve();

const enqueueWrite = (operation) => {
  const result = writeQueue.then(operation);

  // Uma falha não deve bloquear as próximas operações.
  writeQueue = result.catch(() => {});

  return result;
};

const getState = async () => {
  const state = await loadState();

  return state ?? {
    tasks: [],
    pendingOps: [],
  };
};

const makeOperation = (type, data) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  type,
  ...data,
});

// Guarda tarefas e operação pendente no mesmo registo.
const commit = (buildNextState) =>
  enqueueWrite(async () => {
    const state = await getState();
    const nextState = buildNextState(state);

    return saveState(nextState);
  });

/* READ */

export const loadTasks = async () => {
  // Aguarda alterações locais ainda em curso.
  await writeQueue;

  const state = await getState();
  return state.tasks;
};

/* CREATE */

export const createTask = async (task) => {
  const canonicalTask = normalizeTask(task);

  await commit((state) => ({
    tasks: [...state.tasks, canonicalTask],
    pendingOps: [
      ...state.pendingOps,
      makeOperation('create', { task: canonicalTask }),
    ],
  }));

  return canonicalTask;
};

/* UPDATE */

export const updateTask = async (task) => {
  const canonicalTask = normalizeTask(task);

  await commit((state) => ({
    tasks: state.tasks.map((item) =>
      item.id === canonicalTask.id
        ? canonicalTask
        : item,
    ),
    pendingOps: [
      ...state.pendingOps,
      makeOperation('update', { task: canonicalTask }),
    ],
  }));

  return canonicalTask;
};

/* DELETE */

export const deleteTask = async (taskId) => {
  await commit((state) => ({
    tasks: state.tasks.filter(
      (task) => task.id !== taskId,
    ),
    pendingOps: [
      ...state.pendingOps,
      makeOperation('delete', { taskId }),
    ],
  }));
};

/* CLEAR */

export const clearTasks = async () => {
  await commit((state) => ({
    tasks: [],
    pendingOps: [
      ...state.pendingOps,
      ...state.tasks.map((task) =>
        makeOperation('delete', { taskId: task.id }),
      ),
    ],
  }));
};

/* SNAPSHOT SAVE - COMPATIBILIDADE */

export const saveTasks = async (tasks) => {
  const canonicalTasks = normalizeTasks(tasks);

  await commit((state) => {
    const previous = new Map(
      state.tasks.map((task) => [task.id, task]),
    );

    const next = new Map(
      canonicalTasks.map((task) => [task.id, task]),
    );

    const operations = [];

    for (const task of canonicalTasks) {
      const oldTask = previous.get(task.id);

      if (!oldTask) {
        operations.push(
          makeOperation('create', { task }),
        );
      } else if (
        JSON.stringify(oldTask) !== JSON.stringify(task)
      ) {
        operations.push(
          makeOperation('update', { task }),
        );
      }
    }

    for (const task of state.tasks) {
      if (!next.has(task.id)) {
        operations.push(
          makeOperation('delete', { taskId: task.id }),
        );
      }
    }

    return {
      tasks: canonicalTasks,
      pendingOps: [
        ...state.pendingOps,
        ...operations,
      ],
    };
  });

  return canonicalTasks;
};

export const TASK_STORAGE_INFO = {
  schemaVersion: 1,
  key: '@my_time_tasks_local_v1',
};
