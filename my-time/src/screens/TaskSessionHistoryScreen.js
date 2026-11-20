import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeContext';
import { getTaskSessions } from '../services/taskExecutionService';
import {
  buildTaskSessionHistory,
  formatTrackingMinutes,
  getTrackingComparisonLabel,
} from '../utils/taskSessionHistory';

export default function TaskSessionHistoryScreen({ navigation, route }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const task = route.params?.task;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    getTaskSessions(task?.id)
      .then((items) => { if (active) setSessions(items); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [task?.id]);

  const hasActiveSession = sessions.some((session) => session.endedAt === null);
  useEffect(() => {
    if (!hasActiveSession) return undefined;
    const timer = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(timer);
  }, [hasActiveSession]);

  const history = useMemo(
    () => buildTaskSessionHistory(sessions, task?.id, now),
    [sessions, task?.id, now],
  );
  const estimatedMinutes = Number(task?.durationMinutes) || 0;
  const comparison = task?.status === 'completed'
    ? getTrackingComparisonLabel(history.totalMinutes, estimatedMinutes)
    : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}> 
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={23} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>Histórico de sessões</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.taskTitle}>{task?.title || 'Tarefa'}</Text>
        <Text style={styles.estimated}>Previsto: {formatTrackingMinutes(estimatedMinutes)}</Text>

        <View style={styles.summary}>
          <Text style={styles.totalLabel}>Tempo registado: {formatTrackingMinutes(history.totalMinutes)}</Text>
          {comparison && <Text style={styles.comparison}>{comparison}</Text>}
        </View>

        <View style={styles.divider} />

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.action} />
            <Text style={styles.stateText}>A carregar sessões…</Text>
          </View>
        ) : failed ? (
          <Text accessibilityLiveRegion="polite" style={styles.stateText}>
            Não foi possível carregar o histórico local. Os registos não foram alterados.
          </Text>
        ) : history.groups.length === 0 ? (
          <Text style={styles.stateText}>Ainda não há sessões registadas para esta tarefa.</Text>
        ) : (
          history.groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={styles.dateTitle}>{group.label}</Text>
              {group.sessions.map((session) => (
                <View key={session.id} style={styles.sessionRow}>
                  <Text style={styles.sessionTime}>
                    {session.startLabel} → {session.endLabel}
                  </Text>
                  <Text style={styles.sessionDuration}>
                    {formatTrackingMinutes(session.durationMinutes)}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 36 },
  taskTitle: { color: colors.text, fontSize: 24, lineHeight: 31, fontWeight: '700' },
  estimated: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },
  summary: { marginTop: 28, gap: 6 },
  totalLabel: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  comparison: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSoft, marginVertical: 24 },
  centerState: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  stateText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  group: { marginBottom: 24 },
  dateTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  sessionRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  sessionTime: { flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  sessionDuration: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'right' },
  pressed: { opacity: 0.7 },
});
