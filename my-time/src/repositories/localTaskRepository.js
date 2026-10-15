
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeTasks } from '../domain/taskModel';

const STORAGE_KEY = '@my_time_tasks_local_v1';

export const loadState = async () => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);

  if (stored === null) {
    return null;
  }

  const parsed = JSON.parse(stored);

  // Compatibilidade com o primeiro formato
  if (Array.isArray(parsed)) {
    return {
      tasks: normalizeTasks(parsed),
      pendingOps: [],
    };
  }

  if (
    !parsed ||
    !Array.isArray(parsed.tasks) ||
    !Array.isArray(parsed.pendingOps)
  ) {
    throw new Error('Dados locais inválidos.');
  }

  return {
    tasks: normalizeTasks(parsed.tasks),
    pendingOps: parsed.pendingOps,
  };
};

export const saveState = async (state) => {
  const normalized = {
    tasks: normalizeTasks(state.tasks),
    pendingOps: state.pendingOps,
  };

  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalized),
  );

  return normalized;
};

export const loadTasks = async () => {
  const state = await loadState();
  return state?.tasks ?? null;
};
