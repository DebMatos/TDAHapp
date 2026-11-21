
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeTasks } from '../domain/taskModel';

const LEGACY_STORAGE_KEY = '@my_time_tasks_local_v1';
const STORAGE_PREFIX = '@my_time_tasks_local_v2:';

const storageKey = (userId) => {
  if (typeof userId !== 'string' || !userId) {
    throw new Error('É necessária uma conta para aceder às tarefas locais.');
  }
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`;
};

export const discardUnownedTaskState = () =>
  AsyncStorage.removeItem(LEGACY_STORAGE_KEY);

export const loadState = async (userId) => {
  const stored = await AsyncStorage.getItem(storageKey(userId));

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

export const saveState = async (userId, state) => {
  const normalized = {
    tasks: normalizeTasks(state.tasks),
    pendingOps: state.pendingOps,
  };

  await AsyncStorage.setItem(
    storageKey(userId),
    JSON.stringify(normalized),
  );

  return normalized;
};

export const loadTasks = async (userId) => {
  const state = await loadState(userId);
  return state?.tasks ?? null;
};

export const TASK_STORAGE_INFO = {
  schemaVersion: 2,
  keyPrefix: STORAGE_PREFIX,
  legacyKey: LEGACY_STORAGE_KEY,
};
