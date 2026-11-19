import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../theme/ThemeContext';
import {
  getTaskSyncMessage,
  getTaskSyncState,
  subscribeTaskSyncStatus,
} from '../data/taskSyncStatus';
import { pullRemoteTasks, syncPendingTasks } from '../data/taskRepository';
import {
  TASK_SYNC_PRESENTATIONS,
  getConnectivityPresentation,
  getFailureCategoryLabel,
  getPullPresentation,
  getQueuePresentation,
  getSendPresentation,
} from '../data/taskSyncPresentation';

const ROWS = [
  { key: 'connectivity', title: 'Ligação', icon: 'wifi' },
  { key: 'queue', title: 'Alterações locais', icon: 'tray-full' },
  { key: 'send', title: 'Envio para o servidor', icon: 'cloud-upload-outline' },
  { key: 'pull', title: 'Verificação remota', icon: 'cloud-download-outline' },
];

export default function SyncStatusScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState({});
  const [retrying, setRetrying] = useState(false);

  useEffect(() => subscribeTaskSyncStatus(setStatus), []);

  const mode = getTaskSyncState(status);
  const presentation = TASK_SYNC_PRESENTATIONS[mode];
  const busy = retrying || status.sending || status.pulling;
  const canRetry = mode !== 'offline';
  const detail = getTaskSyncMessage(
    mode === 'offline' ? { ...status, sending: false, pulling: false } : status,
  );
  const failure = getFailureCategoryLabel(status.failureCategory);
  const values = {
    connectivity: getConnectivityPresentation(status.connectivity),
    queue: getQueuePresentation(status.pending),
    send: getSendPresentation(status),
    pull: getPullPresentation(status),
  };

  const retry = async () => {
    if (!canRetry || busy) return;
    setRetrying(true);
    try {
      await Promise.allSettled([syncPendingTasks(), pullRemoteTasks()]);
    } finally {
      setRetrying(false);
    }
  };

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  const stateColor = (state) => {
    if (state === 'ok') return colors.success;
    if (state === 'error') return colors.danger;
    if (state === 'warning' || state === 'active') return colors.action;
    return colors.textMuted;
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}> 
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={goBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>Sincronização</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${presentation.title}. ${presentation.message}`}
          style={styles.hero}
        >
          <View style={[styles.heroIcon, { borderColor: mode === 'error' ? colors.danger : colors.border }]}> 
            <MaterialCommunityIcons
              name={presentation.icon}
              size={38}
              color={mode === 'error' ? colors.danger : mode === 'synced' ? colors.success : colors.action}
            />
          </View>
          <Text style={styles.heroTitle}>{presentation.title}</Text>
          <Text style={styles.heroMessage}>{presentation.message}</Text>
        </View>

        <Text style={styles.sectionLabel}>ESTADO COMPLETO</Text>
        <View style={styles.card}>
          {ROWS.map((row, index) => {
            const value = values[row.key];
            const color = stateColor(value.state);
            return (
              <View key={row.key} style={[styles.row, index < ROWS.length - 1 && styles.rowBorder]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.surfaceSoft }]}> 
                  <MaterialCommunityIcons name={row.icon} size={20} color={color} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{row.title}</Text>
                  <Text style={styles.rowValue}>{value.label}</Text>
                </View>
                <MaterialCommunityIcons
                  name={value.state === 'ok' ? 'check-circle-outline' : value.state === 'error' ? 'alert-circle-outline' : 'circle-medium'}
                  size={22}
                  color={color}
                />
              </View>
            );
          })}
        </View>

        {(detail || failure) && (
          <View style={[styles.notice, { borderColor: status.sendFailed || status.pullFailed ? colors.danger : colors.border }]}> 
            <MaterialCommunityIcons name="information-outline" size={21} color={colors.textSecondary} />
            <Text style={styles.noticeText}>{failure || detail}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Verificar sincronização agora"
          accessibilityState={{ disabled: !canRetry || busy, busy }}
          disabled={!canRetry || busy}
          onPress={retry}
          style={({ pressed }) => [
            styles.retryButton,
            (!canRetry || busy) && styles.retryDisabled,
            pressed && canRetry && !busy && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons name="sync" size={20} color={colors.onAction} />
          <Text style={styles.retryText}>{busy ? 'A verificar…' : 'Verificar agora'}</Text>
        </Pressable>
        {mode === 'offline' && (
          <Text style={styles.helper}>A verificação fica disponível quando a ligação regressar.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32 },
  hero: { alignItems: 'center', paddingHorizontal: 12, marginBottom: 30 },
  heroIcon: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  heroMessage: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 420 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  card: { backgroundColor: colors.surface, borderColor: colors.borderSoft, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, paddingVertical: 12 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rowValue: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  notice: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeText: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  retryButton: { minHeight: 48, marginTop: 20, borderRadius: 14, backgroundColor: colors.action, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18 },
  retryDisabled: { opacity: 0.48 },
  retryText: { color: colors.onAction, fontSize: 15, fontWeight: '700' },
  helper: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  pressed: { opacity: 0.7 },
});
