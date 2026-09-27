import { supabase } from '../lib/supabase';
import {
  normalizeTask,
  normalizeTasks,
} from '../domain/taskModel';

const fromDatabase = (row) => ({
  id: row.id,
  title: row.title,
  notes: row.notes,
  projectId: row.project_id,
  categoryId: row.category_id,
  priority: row.priority,
  date: row.date,
  startTime: row.start_time,
  durationMinutes: row.duration_minutes,
  dueDate: row.due_date,
  dueTime: row.due_time,
  status: row.status,
  repeat: row.repeat,
  subtasks: row.subtasks,
  position: row.position,
  source: row.source,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
  abandonedAt: row.abandoned_at,
});

const toDatabase = (task, userId) => ({
  id: task.id,
  user_id: userId,
  title: task.title,
  notes: task.notes,
  project_id: task.projectId,
  category_id: task.categoryId,
  priority: task.priority,
  date: task.date,
  start_time: task.startTime,
  duration_minutes: task.durationMinutes,
  due_date: task.dueDate,
  due_time: task.dueTime,
  status: task.status,
  repeat: task.repeat,
  subtasks: task.subtasks,
  position: task.position,
  source: task.source,
  created_at: task.createdAt,
  updated_at: task.updatedAt,
  completed_at: task.completedAt,
  abandoned_at: task.abandonedAt,
});

/* -------------------------------------------------------
   READ
------------------------------------------------------- */

export const loadTasks = async (userId) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('position', {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return normalizeTasks(
    data.map(fromDatabase),
  );
};

/* -------------------------------------------------------
   CREATE
------------------------------------------------------- */

export const createTask = async (
  userId,
  task,
) => {
  const canonicalTask =
    normalizeTask(task);

  const { data, error } =
    await supabase
      .from('tasks')
      .insert(
        toDatabase(
          canonicalTask,
          userId,
        ),
      )
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return normalizeTask(
    fromDatabase(data),
  );
};

/* -------------------------------------------------------
   UPDATE
------------------------------------------------------- */

export const updateTask = async (
  userId,
  task,
) => {
  const canonicalTask =
    normalizeTask(task);

  const row = toDatabase(
    canonicalTask,
    userId,
  );

  const {
    id,
    user_id,
    created_at,
    ...changes
  } = row;

  const { data, error } =
    await supabase
      .from('tasks')
      .update(changes)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return normalizeTask(
    fromDatabase(data),
  );
};

/* -------------------------------------------------------
   DELETE
------------------------------------------------------- */

export const deleteTask = async (
  userId,
  taskId,
) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
};

/* -------------------------------------------------------
   CLEAR
------------------------------------------------------- */

export const clearTasks = async (
  userId,
) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
};

/* -------------------------------------------------------
   SNAPSHOT SAVE

   Mantido apenas para migração/importação em lote.
   Não usar no CRUD normal.
------------------------------------------------------- */

export const saveTasks = async (
  userId,
  tasks,
) => {
  const canonicalTasks =
    normalizeTasks(tasks);

  const {
    data: existingTasks,
    error: loadError,
  } = await supabase
    .from('tasks')
    .select('id')
    .eq('user_id', userId);

  if (loadError) {
    throw loadError;
  }

  if (canonicalTasks.length > 0) {
    const rowsToUpsert =
      canonicalTasks.map((task) =>
        toDatabase(task, userId),
      );

    const { error: upsertError } =
      await supabase
        .from('tasks')
        .upsert(
          rowsToUpsert,
          {
            onConflict: 'id',
          },
        );

    if (upsertError) {
      throw upsertError;
    }
  }

  const currentIds =
    new Set(
      canonicalTasks.map(
        (task) => task.id,
      ),
    );

  const idsToDelete =
    existingTasks
      .map((task) => task.id)
      .filter(
        (id) =>
          !currentIds.has(id),
      );

  if (idsToDelete.length > 0) {
    const { error: deleteError } =
      await supabase
        .from('tasks')
        .delete()
        .eq('user_id', userId)
        .in('id', idsToDelete);

    if (deleteError) {
      throw deleteError;
    }
  }

  return canonicalTasks;
};