import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView,
  StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  getTaskSyncMessage, getTaskSyncState, subscribeTaskSyncStatus,
} from '../data/taskSyncStatus';
import { TASK_SYNC_PRESENTATIONS } from '../data/taskSyncPresentation';
import { useTheme } from '../theme/ThemeContext';

export default function TaskSyncStatus() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState({});
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
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
  const presentation = TASK_SYNC_PRESENTATIONS[mode];

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
  const showDetails = () => {
    setOpen(false);
    navigation.navigate('SyncStatus');
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
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={close} style={styles.action}>
                  <Text style={styles.actionText}>Fechar</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={showDetails} style={styles.action}>
                  <Text style={styles.actionText}>Ver estado completo</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors) => StyleSheet.create({
  trigger: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1 },
  panel: { position: 'absolute', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, elevation: 5, shadowColor: colors.text, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  title: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  message: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 8 },
  action: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  actionText: { color: colors.selectionText, fontSize: 13, fontWeight: '600' },
});
