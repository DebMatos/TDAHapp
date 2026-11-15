import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeTaskSession } from '../domain/taskSessionModel';

const STORAGE_KEY = '@my_time_task_sessions_local_v1';

// O registo das sessões é independente do armazenamento das tarefas.
export const loadSessions = async () => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored === null) return [];

  const parsed = JSON.parse(stored);
  if (!Array.isArray(parsed)) {
    throw new Error('Dados locais de sessões inválidos.');
  }

  // Nunca substitui silenciosamente registos inválidos por uma lista vazia.
  return parsed.map(normalizeTaskSession);
};

export const saveSessions = async (sessions) => {
  if (!Array.isArray(sessions)) {
    throw new TypeError('sessions deve ser uma lista.');
  }

  const normalized = sessions.map(normalizeTaskSession);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

export const TASK_SESSION_STORAGE_INFO = {
  schemaVersion: 1,
  key: STORAGE_KEY,
};
