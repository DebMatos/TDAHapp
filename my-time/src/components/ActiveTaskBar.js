import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const formatElapsed = (milliseconds) => {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

export default function ActiveTaskBar({ task, running, durationMs, onPress, onToggle, onFinish, busy = false }) {
  const { colors } = useTheme();
  if (!task) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.taskInfo}
        accessibilityRole="button"
        accessibilityLabel={`Abrir detalhes de ${task.title}`}
        onPress={onPress}
      >
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{task.title}</Text>
        <Text style={{ color: colors.textSecondary }}>{formatElapsed(durationMs)}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: colors.action }]}
        accessibilityRole="button"
        accessibilityLabel="Terminar registo de tempo"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={onFinish}
      >
        <Ionicons name="stop" size={22} color={colors.onAction} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: colors.action }]}
        accessibilityRole="button"
        accessibilityLabel={running ? 'Pausar tarefa' : 'Retomar tarefa'}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={onToggle}
      >
        <Ionicons name={running ? 'pause' : 'play'} size={22} color={colors.onAction} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskInfo: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '600' },
  action: {
    minWidth: 46,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
