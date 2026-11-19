export const TASK_SYNC_PRESENTATIONS = {
  syncing: {
    icon: 'autorenew',
    title: 'A sincronizar',
    message: 'As alterações estão guardadas neste dispositivo e a ser confirmadas no servidor.',
  },
  offline: {
    icon: 'cloud-off-outline',
    title: 'Sem Internet',
    message: 'As tarefas locais estão seguras. O envio recomeça quando houver ligação.',
  },
  synced: {
    icon: 'cloud-check-outline',
    title: 'Tudo sincronizado',
    message: 'O envio e a recuperação terminaram sem alterações pendentes.',
  },
  error: {
    icon: 'cloud-alert-outline',
    title: 'Sincronização com problema',
    message: 'As tarefas locais foram mantidas. Consulta o estado completo para resolver.',
  },
  pending: {
    icon: 'cloud-sync-outline',
    title: 'Guardado no dispositivo',
    message: 'Existem alterações locais a aguardar confirmação do servidor.',
  },
  checking: {
    icon: 'cloud-outline',
    title: 'A verificar',
    message: 'Ainda não foi possível confirmar todo o estado da sincronização.',
  },
};

export const getConnectivityPresentation = (connectivity) => {
  if (connectivity === 'online') return { label: 'Ligado à Internet', state: 'ok' };
  if (connectivity === 'offline') return { label: 'Sem ligação à Internet', state: 'error' };
  return { label: 'Ligação ainda não confirmada', state: 'neutral' };
};

export const getQueuePresentation = (pending) => {
  if (!Number.isInteger(pending)) return { label: 'Fila local ainda não verificada', state: 'neutral' };
  if (pending === 0) return { label: 'Sem alterações locais pendentes', state: 'ok' };
  return {
    label: pending === 1 ? '1 alteração por enviar' : `${pending} alterações por enviar`,
    state: 'warning',
  };
};

export const getSendPresentation = (status) => {
  if (status.sending) return { label: 'Envio em curso', state: 'active' };
  if (status.sendFailed) return { label: 'Último envio não foi confirmado', state: 'error' };
  if (status.sendConfirmed) return { label: 'Alterações enviadas', state: 'ok' };
  return { label: 'Envio ainda não confirmado', state: 'neutral' };
};

export const getPullPresentation = (status) => {
  if (status.pulling) return { label: 'Recuperação em curso', state: 'active' };
  if (status.pullFailed) return { label: 'Última recuperação não foi confirmada', state: 'error' };
  if (status.pullConfirmed) return { label: 'Tarefas remotas verificadas', state: 'ok' };
  return { label: 'Tarefas remotas ainda não verificadas', state: 'neutral' };
};

export const getFailureCategoryLabel = (category) => {
  if (category === 'validation') return 'O servidor rejeitou os dados de uma tarefa.';
  if (category === 'conflict') return 'Uma tarefa não pôde ser confirmada no servidor.';
  if (category === 'auth') return 'A sessão não autorizou a sincronização.';
  if (category === 'transient') return 'O serviço está temporariamente indisponível.';
  if (category === 'unknown') return 'A última tentativa não foi concluída.';
  return null;
};
