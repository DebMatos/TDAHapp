const syncError = (code, message) => Object.assign(new Error(message), { code });
const timeoutError = () => syncError('SYNC_TIMEOUT', 'Tempo limite da sincronização excedido.');
const cancelled = () => syncError('SYNC_CANCELLED', 'Sincronização interrompida.');

const withDeadline = async (run, duration, parent) => {
  if (parent?.aborted) throw cancelled();
  const controller = new AbortController();
  let rejectStopped;
  const stopped = new Promise((_, reject) => { rejectStopped = reject; });
  const stop = (error) => {
    rejectStopped(error);
    controller.abort();
  };
  const onAbort = () => stop(cancelled());
  parent?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => stop(timeoutError()), duration);
  try {
    return await Promise.race([stopped, run(controller.signal)]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', onAbort);
  }
};

export const createRefreshFetch = (fetchRequest, authUrl, trace) => (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.origin + url.pathname !== authUrl ||
      url.searchParams.get('grant_type') !== 'refresh_token') {
    return fetchRequest(input, init);
  }
  return trace(reportHttp => withDeadline(async signal => {
    const response = await fetchRequest(input, { ...init, signal });
    reportHttp?.(response.status);
    // Keep the deadline active until the body is available to Auth.
    await response.clone().text();
    if (!response.ok) throw Object.assign(new Error('Renovação recusada.'), { status: response.status, response });
    return response;
  }, 8_000, init?.signal)).catch(error => {
    // Let Auth parse its own HTTP errors and manage refresh retries.
    if (error.response) return error.response;
    throw error;
  });
};

const rejectedSessionCodes = new Set([
  'refresh_token_not_found', 'refresh_token_already_used', 'session_not_found',
  'session_expired', 'user_not_found',
]);

export const createSyncRequest = (auth, getIdentity) => async (userId, parent, buildQuery) => {
  const identity = getIdentity();
  const assertIdentity = () => {
    const current = getIdentity();
    if (parent?.aborted || identity.userId !== userId ||
        current.userId !== userId || current.revision !== identity.revision) {
      throw cancelled();
    }
  };
  assertIdentity();
  const { data, error } = await withDeadline(() => auth.getSession(), 45_000, parent);
  assertIdentity();
  if (error) {
    if (rejectedSessionCodes.has(error.code)) {
      throw syncError('SESSION_REAUTH_REQUIRED', 'A sessão terminou. Volta a iniciar sessão.');
    }
    if (error.name === 'AuthRetryableFetchError') {
      throw syncError('SESSION_REFRESH_TRANSIENT', 'A renovação da sessão está temporariamente indisponível.');
    }
    throw error;
  }
  if (data.session?.user?.id !== userId || !data.session?.access_token) {
    throw syncError('SESSION_REAUTH_REQUIRED', 'A sessão terminou. Volta a iniciar sessão.');
  }
  const result = await withDeadline(signal => buildQuery()
    .setHeader('Authorization', `Bearer ${data.session.access_token}`)
    .abortSignal(signal), 15_000, parent);
  assertIdentity();
  return result;
};
