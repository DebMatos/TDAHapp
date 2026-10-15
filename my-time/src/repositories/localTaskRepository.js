
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeTasks } from '../domain/taskModel';

const STORAGE_KEY = '@my_time_tasks_local_v1';

export const loadTasks = async () => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);

  if (stored === null) {
    return null;
  }

  return normalizeTasks(JSON.parse(stored));
};

export const saveTasks = async (tasks) => {
  const normalized = normalizeTasks(tasks);

  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalized),
  );

  return normalized;
};
