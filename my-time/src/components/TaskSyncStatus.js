import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView,
  StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getTaskSyncMessage, getTaskSyncState, subscribeTaskSyncStatus,
} from '../data/taskSyncStatus';
import { pullRemoteTasks, syncPendingTasks } from '../data/taskRepository';
import colors from '../theme/colors';

const presentations = {
  syncing: { icon: 'autorenew', title: 'A sincronizar', message: 'Existem operações de envio ou recuperação em curso.' },
  offline: { icon: 'cloud-off-outline', title: 'Sem Internet', message: 'As tarefas locais permanecem guardadas neste dispositivo. As alterações pendentes serão enviadas quando houver ligação.' },
  synced: { icon: 'cloud-check-outline', title: 'Sincronizado', message: 'O envio e a recuperação foram concluídos. Não existem alterações locais pendentes.' },
  error: { icon: 'cloud-alert-outline', title: 'A sincronização precisa de atenção' },
  pending: { icon: 'cloud-sync-outline', title: 'Sincronização pendente', message: 'Existem alterações guardadas neste dispositivo por enviar.' },
  checking: { icon: 'cloud-outline', title: 'A verificar sincronização', message: 'Ainda não foi possível confirmar o envio e a recuperação de tarefas.' },
};

export default function TaskSyncStatus() {
  const [status, setStatus] = useState({});
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const trigger = useRef(null);
  const rotation = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
  useEffect(() => subscribeTaskSyncStatus(setStatus), []);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) setReduceMotion(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  const mode = getTaskSyncState(status);
  const presentation = presentations[mode];
  const busy = retrying || status.sending || status.pulling;
  const canRetry = mode !== 'synced' && mode !== 'offline';

  useEffect(() => {
    rotation.setValue(0);
    if (mode !== 'syncing' || reduceMotion) return;
    const animation = Animated.loop(Animated.timing(rotation, {
      toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true,
    }));
    animation.start();
    return () => { animation.stop(); rotation.setValue(0); };
  }, [mode, reduceMotion, rotation]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus?.();
  };
  const show = () => {
    trigger.current?.measureInWindow((x, y, buttonWidth, buttonHeight) => {
      setAnchor({ x, y, width: buttonWidth, height: buttonHeight });
      setOpen(true);
    });
  };
  const retry = async () => {
    if (busy) return;
    setRetrying(true);
    try {
      await Promise.allSettled([syncPendingTasks(), pullRemoteTasks()]);
    } finally {
      setRetrying(false);
    }
  };
  const panelWidth = Math.max(0, Math.min(320, width - 24));
  const left = Math.max(12, Math.min((anchor?.x ?? width) + (anchor?.width ?? 0) - panelWidth, width - panelWidth - 12));
  const top = Math.max(12, Math.min((anchor?.y ?? 40) + (anchor?.height ?? 0) + 8, height - 260));
  const detail = getTaskSyncMessage(mode === 'offline'
    ? { ...status, sending: false, pulling: false } : status);
  const message = presentation.message || detail || 'Não foi possível confirmar a sincronização. As tarefas locais foram mantidas.';
  const color = mode === 'error' ? colors.danger : colors.textSecondary;

  return (
    <>
      <Pressable ref={trigger} onPress={show} style={styles.trigger}
        accessibilityRole="button" accessibilityLabel={`Sincronização: ${presentation.title}`}
        accessibilityHint="Abre os detalhes da sincronização" accessibilityState={{ expanded: open }}>
        <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
          <MaterialCommunityIcons name={presentation.icon} size={21} color={color} />
        </Animated.View>
      </Pressable>
      <Modal visible={open} transparent animationType="none" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close}
            accessibilityRole="button" accessibilityLabel="Fechar detalhes da sincronização" />
          <View accessibilityViewIsModal style={[styles.panel, { top, left, width: panelWidth, maxHeight: Math.max(100, height - top - 12) }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text accessibilityRole="header" style={styles.title}>{presentation.title}</Text>
              <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
              {mode === 'offline' && (status.sendFailed || status.pullFailed || status.failureCategory) && (
                <Text style={styles.message}>{detail || 'Existe uma falha anterior de sincronização. Poderás tentar novamente quando houver ligação.'}</Text>
              )}
              {Number.isInteger(status.pending) && status.pending > 0 && (
                <Text style={styles.count}>{status.pending === 1 ? '1 operação pendente' : `${status.pending} operações pendentes`}</Text>
              )}
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={close} style={styles.action}>
                  <Text style={styles.actionText}>Fechar</Text>
                </Pressable>
                {canRetry && (
                  <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}
                    disabled={busy} onPress={retry} style={styles.action}>
                    <Text style={[styles.actionText, busy && styles.disabled]}>{busy ? 'A tentar…' : 'Tentar novamente'}</Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1 },
  panel: { position: 'absolute', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, elevation: 5, shadowColor: colors.text, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  title: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  message: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  count: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 8 },
  action: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  actionText: { color: colors.selectionText, fontSize: 13, fontWeight: '600' },
  disabled: { color: colors.textMuted },
});
