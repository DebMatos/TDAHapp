import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { formatChronometerDuration } from '../utils/trackingChronometer';

export default function ActiveTaskBar({ task, running, durationMs, onPress, onToggle, onFinish, busy = false }) {
  const { colors, isDark } = useTheme();
  if (!task) return null;
  const stopIconColor = isDark ? colors.text : colors.onAction;
  const toggleIconColor = colors.text;
  const panelStyle = {
    backgroundColor: colors.surface,
    borderColor: isDark ? colors.border : colors.now,
    elevation: isDark ? 0 : 2,
    shadowColor: colors.floatingButton.shadow,
    shadowOffset: { width: 0, height: isDark ? 0 : 2 },
    shadowOpacity: isDark ? 0 : 0.08,
    shadowRadius: isDark ? 0 : 8,
  };

  return (
    <View style={[styles.container, panelStyle]}>
      <TouchableOpacity
        style={styles.taskInfo}
        accessibilityRole="button"
        accessibilityLabel={`Abrir detalhes de ${task.title}`}
        onPress={onPress}
      >
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{task.title}</Text>
        <Text style={{ color: colors.textSecondary }}>{formatChronometerDuration(durationMs)}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: colors.danger }]}
        accessibilityRole="button"
        accessibilityLabel="Terminar registo de tempo"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={onFinish}
      >
        <Ionicons name="stop" size={22} color={stopIconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: colors.completed }]}
        accessibilityRole="button"
        accessibilityLabel={running ? 'Pausar tarefa' : 'Retomar tarefa'}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={onToggle}
      >
        <Ionicons name={running ? 'pause' : 'play'} size={22} color={toggleIconColor} />
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
