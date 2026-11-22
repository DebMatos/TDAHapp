import { runSyncRequest, syncDataClient } from '../lib/supabase';
import { normalizeTaskSession } from '../domain/taskSessionModel';

const toDatabase = (session, userId) => {
  const normalized = normalizeTaskSession(session);
  return {
    id: normalized.id,
    user_id: userId,
    task_id: normalized.taskId,
    started_at: normalized.startedAt,
    ended_at: normalized.endedAt,
  };
};

const fromDatabase = (row) => normalizeTaskSession({
  id: row.id,
  taskId: row.task_id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
});

export const loadRemoteSessions = async (userId, signal) => {
  const { data, error } = await runSyncRequest(userId, signal, () => syncDataClient
    .from('task_sessions')
    .select('id, task_id, started_at, ended_at')
    .eq('user_id', userId));
  if (error) throw error;
  return (data ?? []).map(fromDatabase);
};

// Idempotente: repetir o envio não duplica a sessão.
export const upsertRemoteSession = async (userId, session, signal) => {
  const { error } = await runSyncRequest(userId, signal, () => syncDataClient
    .from('task_sessions')
    .upsert(toDatabase(session, userId), { onConflict: 'id' }));
  if (error) throw error;
};
