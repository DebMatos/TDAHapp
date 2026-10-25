import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getTaskSyncMessage, subscribeTaskSyncStatus } from '../data/taskSyncStatus';
import { pullRemoteTasks, syncPendingTasks } from '../data/taskRepository';
import colors from '../theme/colors';

export default function TaskSyncStatus() {
  const [status, setStatus] = useState({});
  const [retrying, setRetrying] = useState(false);
  useEffect(() => subscribeTaskSyncStatus(setStatus), []);
  const message = getTaskSyncMessage(status);
  const busy = retrying || status.sending || status.pulling;
  const canRetry = status.sendFailed || status.pullFailed || status.pending > 0;

  const retry = async () => {
    if (busy) return;
    setRetrying(true);
    try {
      // Failure in one direction must not prevent recovery in the other.
      await Promise.allSettled([syncPendingTasks(), pullRemoteTasks()]);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text>
      {canRetry && (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}
          disabled={busy} onPress={retry} style={styles.retry}>
          <Text style={[styles.retryText, busy && styles.disabled]}>
            {busy ? 'A tentar…' : 'Tentar novamente'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  message: { flex: 1, fontSize: 12, color: colors.textSecondary },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, maxWidth: '40%' },
  retryText: { fontSize: 12, color: colors.selectionText, fontWeight: '600' },
  disabled: { color: colors.textMuted },
});
