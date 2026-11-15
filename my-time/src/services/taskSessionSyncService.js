import { supabase, getSessionIdentity } from '../lib/supabase';
import {
  claimSessionOwner,
  loadSessionSyncState,
  confirmSyncedSession,
  mergeRemoteSessions,
} from '../repositories/localTaskSessionRepository';
import {
  loadRemoteSessions,
  upsertRemoteSession,
} from '../repositories/supabaseTaskSessionRepository';

let inFlight = null;

const assertIdentity = (userId, revision) => {
  const identity = getSessionIdentity();
  if (identity.revision !== revision ||
      (identity.userId !== undefined && identity.userId !== userId)) {
    throw new Error('Sessão de utilizador alterada durante a sincronização.');
  }
};

const syncOnce = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = session?.user?.id;
  if (!userId) throw new Error('É necessária uma sessão autenticada.');
  const revision = getSessionIdentity().revision;
  assertIdentity(userId, revision);

  await claimSessionOwner(userId);
  // Obter primeiro a versão remota, sem substituir alterações locais pendentes.
  const remote = await loadRemoteSessions(userId);
  assertIdentity(userId, revision);
  await mergeRemoteSessions(remote);

  const { sessions, pendingIds } = await loadSessionSyncState();
  const pending = new Set(pendingIds);
  let sent = 0;
  for (const item of sessions) {
    if (!pending.has(item.id)) continue;
    assertIdentity(userId, revision);
    await upsertRemoteSession(userId, item);
    assertIdentity(userId, revision);
    await confirmSyncedSession(item);
    sent += 1;
  }

  return sent;
};

// Só uma sincronização de cada vez; outra chamada pode ser feita após terminar.
export const syncTaskSessions = () => {
  if (inFlight) return inFlight;
  const promise = syncOnce();
  inFlight = promise;
  promise.finally(() => {
    if (inFlight === promise) inFlight = null;
  }).catch(() => {});
  return promise;
};
