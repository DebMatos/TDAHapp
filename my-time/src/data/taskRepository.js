import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeTasks } from '../domain/taskModel';

import { supabase } from '../lib/supabase';

import {
  loadTasks as loadRemoteTasks,
  saveTasks as saveRemoteTasks,
} from '../repositories/supabaseTaskRepository';

const TASKS_STORAGE_KEY = '@my_time_tasks_data_v2';

const TASKS_SCHEMA_VERSION = 2;

const getCurrentUserId = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    throw new Error('Não existe um utilizador autenticado.');
  }

  return session.user.id;
};

const loadLocalTasks = async () => {
  const stored = await AsyncStorage.getItem(TASKS_STORAGE_KEY);

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
};

/* -------------------------------------------------------
   WRITE
------------------------------------------------------- */

export const saveTasks = async (tasks) => {
  const userId = await getCurrentUserId();

  const result = await saveRemoteTasks(userId, tasks);
  return result;
};
/* -------------------------------------------------------
   READ
------------------------------------------------------- */

export const loadTasks = async () => {
  const userId = await getCurrentUserId();

  const remoteTasks = await loadRemoteTasks(userId);

  if (remoteTasks.length > 0) {
    return remoteTasks;
  }

  /*
   * Migração única das tarefas que já existiam
   * no telemóvel antes de ligar ao Supabase.
   */
  const localTasks = await loadLocalTasks();

  if (localTasks.length === 0) {
    return [];
  }

  const migratedTasks = await saveRemoteTasks(userId, localTasks);

  await AsyncStorage.removeItem(TASKS_STORAGE_KEY);

  return migratedTasks;
};

export const clearTasks = async () => {
  const userId = await getCurrentUserId();

  await saveRemoteTasks(userId, []);

  await AsyncStorage.removeItem(TASKS_STORAGE_KEY);
};

export const TASK_STORAGE_INFO = {
  schemaVersion: TASKS_SCHEMA_VERSION,
  key: TASKS_STORAGE_KEY,
};
