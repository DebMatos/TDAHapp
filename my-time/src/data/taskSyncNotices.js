// One remote notice per failure episode, not per automatic retry.
// Success is deliberately silent. Details remain in the header panel.
export const createTaskSyncNoticeTracker = () => {
  let announced = false;
  return (status) => {
    if (status.pending === 0 && status.sendConfirmed && status.pullConfirmed &&
        !status.sendFailed && !status.pullFailed) {
      if (!announced) return null;
      announced = false;
      return { kind: 'clear' };
    }
    if (announced || status.connectivity !== 'online' ||
        status.sending || status.pulling ||
        !(status.sendFailed || status.pullFailed)) return null;

    announced = true;
    const needsAttention = ['validation', 'conflict', 'auth'].includes(status.failureCategory);
    return {
      kind: 'notice',
      notice: {
        title: 'Sincronização pendente',
        message: 'As tarefas locais foram mantidas. Consulta os detalhes no ícone de sincronização.',
        tone: needsAttention ? 'error' : 'info',
      },
    };
  };
};
