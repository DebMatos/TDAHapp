import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeTasks,
} from '../domain/taskModel';

const TASKS_STORAGE_KEY =
  '@my_time_tasks_data_v2';

const TASKS_SCHEMA_VERSION = 2;

/* -------------------------------------------------------
   WRITE
------------------------------------------------------- */

export const saveTasks = async (tasks) => {
  const canonicalTasks = normalizeTasks(tasks);

  await AsyncStorage.setItem(
    TASKS_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: TASKS_SCHEMA_VERSION,
      tasks: canonicalTasks,
    })
  );

  return canonicalTasks;
};

/* -------------------------------------------------------
   READ
------------------------------------------------------- */

export const loadTasks = async () => {
  try {
    const stored = await AsyncStorage.getItem(
      TASKS_STORAGE_KEY
    );

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    if (
      !parsed ||
      parsed.schemaVersion !== TASKS_SCHEMA_VERSION ||
      !Array.isArray(parsed.tasks)
    ) {
      return [];
    }

    return normalizeTasks(parsed.tasks);
  } catch (error) {
    console.error(
      'Erro ao carregar tarefas:',
      error
    );

    return [];
  }
};

export const clearTasks = async () => {
  await AsyncStorage.removeItem(
    TASKS_STORAGE_KEY
  );
};

export const TASK_STORAGE_INFO = {
  schemaVersion: TASKS_SCHEMA_VERSION,
  key: TASKS_STORAGE_KEY,
};