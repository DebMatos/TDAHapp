let status = {
  pending: null, sending: false, pulling: false,
  sendFailed: false, pullFailed: false, failureCategory: null,
  connectivity: 'unknown', sendConfirmed: false, pullConfirmed: false,
};
const listeners = new Set();

const notify = (listener) => {
  try {
    listener({ ...status });
  } catch (error) {
    console.warn('[Sync] Falha ao apresentar estado:', error);
  }
};

export const updateTaskSyncStatus = (changes) => {
  status = { ...status, ...changes };
  if (status.pending > 0 || status.sendFailed) status.sendConfirmed = false;
  if (status.pullFailed) status.pullConfirmed = false;
  listeners.forEach(notify);
};

// Reuse the App's existing NetInfo subscription. Null does not prove offline.
export const updateTaskSyncConnectivity = (network) => {
  const connectivity = network.isConnected === false || network.isInternetReachable === false
    ? 'offline'
    : network.isConnected === true && network.isInternetReachable === true
      ? 'online' : 'unknown';
  if (connectivity === status.connectivity) return;
  updateTaskSyncStatus({ connectivity, sendConfirmed: false, pullConfirmed: false });
};

export const getTaskSyncState = (state) => {
  if (state.connectivity === 'offline') return 'offline';
  if (state.sending || state.pulling) return 'syncing';
  if (state.sendFailed || state.pullFailed ||
      state.pending > 0 && ['validation', 'conflict', 'auth'].includes(state.failureCategory)) {
    return 'error';
  }
  if (state.connectivity === 'online' && state.pending === 0 &&
      state.sendConfirmed && state.pullConfirmed) return 'synced';
  if (state.pending > 0) return 'pending';
  return 'checking';
};

export const subscribeTaskSyncStatus = (listener) => {
  listeners.add(listener);
  notify(listener);
  return () => listeners.delete(listener);
};

export const getTaskSyncMessage = (state) => {
  if (state.pending > 0 && !state.sending) {
    if (state.failureCategory === 'validation') {
      return 'Alterações guardadas neste dispositivo. O servidor rejeitou os dados de uma tarefa; a sincronização está bloqueada até o problema ser corrigido.';
    }
    if (state.failureCategory === 'conflict') {
      return 'Alterações guardadas neste dispositivo. Não foi possível confirmar a tarefa no servidor; a sincronização precisa de revisão.';
    }
    if (state.failureCategory === 'auth') {
      return 'Alterações guardadas neste dispositivo. Não foi possível autorizar a sincronização. Verifica a sessão e o acesso.';
    }
  }
  if (state.pending > 0 && state.sendFailed) {
    return 'Alterações guardadas neste dispositivo. Sincronização pendente.';
  }
  if (state.pullFailed) {
    return 'Não foi possível recuperar tarefas remotas. As tarefas locais foram mantidas.';
  }
  if (state.sending || state.pulling) return 'A sincronizar tarefas…';
  if (state.pending > 0) return 'Alterações guardadas neste dispositivo. Sincronização pendente.';
  return '';
};
