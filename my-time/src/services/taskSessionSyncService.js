import { getSessionIdentity } from '../lib/supabase';
import { classifyTaskSyncError } from './taskSyncErrors';
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
let online = false;
let retryTimer = null;
let retryAttempt = 0;
const retryDelays = [5_000, 15_000, 30_000, 60_000];

const isCurrent = ({ userId, revision }) => {
  const identity = getSessionIdentity();
  return identity.revision === revision && identity.userId === userId;
};

const syncOnce = async (identity, signal) => {
  const { userId } = identity;
  const assertIdentity = () => {
    if (signal.aborted || !isCurrent(identity)) {
      throw new Error('Sessão de utilizador alterada durante a sincronização.');
    }
  };

  assertIdentity();
  await claimSessionOwner(userId);
  assertIdentity();
  // Obter primeiro a versão remota, sem substituir alterações locais pendentes.
  const remote = await loadRemoteSessions(userId, signal);
  assertIdentity();
  await mergeRemoteSessions(remote, userId);

  assertIdentity();
  const { sessions, pendingIds } = await loadSessionSyncState(userId);
  const pending = new Set(pendingIds);
  let sent = 0;
  for (const item of sessions) {
    if (!pending.has(item.id)) continue;
    assertIdentity();
    await upsertRemoteSession(userId, item, signal);
    assertIdentity();
    await confirmSyncedSession(item, userId);
    sent += 1;
  }

  return sent;
};

const clearRetry = () => {
  clearTimeout(retryTimer);
  retryTimer = null;
};

export const setTaskSessionSyncOnline = (value) => {
  if (online === value) return;
  online = value;
  if (!online) {
    clearRetry();
    retryAttempt = 0;
    inFlight?.controller.abort();
  }
};

export const syncTaskSessions = () => {
  const identity = getSessionIdentity();
  if (!online || !identity.userId) return Promise.resolve();
  if (inFlight && !inFlight.controller.signal.aborted && isCurrent(inFlight.identity)) {
    inFlight.requestedAgain = true;
    return inFlight.promise;
  }
  if (inFlight && !isCurrent(inFlight.identity)) retryAttempt = 0;
  inFlight?.controller.abort();
  clearRetry();
  const controller = new AbortController();
  const run = { identity, controller, requestedAgain: false };
  const promise = (async () => {
    do {
      run.requestedAgain = false;
      await syncOnce(identity, controller.signal);
      retryAttempt = 0;
    } while (run.requestedAgain && !controller.signal.aborted && isCurrent(identity));
  })();
  run.promise = promise;
  inFlight = run;
  promise.catch(error => {
    const { category } = classifyTaskSyncError(error);
    if (!online || controller.signal.aborted || !isCurrent(identity) ||
        !['transient', 'unknown'].includes(category)) return;
    const delay = retryDelays[Math.min(retryAttempt++, retryDelays.length - 1)];
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (online && isCurrent(identity)) syncTaskSessions().catch(() => {});
    }, delay);
    retryTimer?.unref?.();
  }).finally(() => {
    if (inFlight === run) inFlight = null;
  }).catch(() => {});
  return promise;
};
