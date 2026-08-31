import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const calculateHeight = (minutes = 30) => {
  const base = minutes * 1.6;
  return Math.max(54, base);
};

export default function TaskTimelineItem({
  task,
  startTimeStr = '07:00',
  blockColor = '#3A9BB7',
  onToggle,
  onLongPress,
  isActive,
}) {
  const minHeight = calculateHeight(task.timeMinutes);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={onLongPress}
      delayLongPress={160}
      style={[
        styles.taskCard,
        { minHeight },
        isActive && styles.taskCardActive,
        task.completed && styles.taskCardCompleted,
      ]}
    >
      {/* 1. Faixa Lateral Integrada (com cor do Bloco e Horário) */}
      <View style={[styles.timeStrip, { backgroundColor: blockColor }]}>
        <Text style={styles.timeStripText}>{startTimeStr}</Text>
      </View>

      {/* 2. Conteúdo da Tarefa */}
      <View style={styles.taskBody}>
        <View style={styles.textContainer}>
          <Text
            numberOfLines={2}
            style={[styles.taskTitle, task.completed && styles.taskTitleCompleted]}
          >
            {task.title}
          </Text>
          <Text style={styles.durationText}>{task.timeMinutes} min</Text>
        </View>

        {/* Checkbox circular limpa */}
        <TouchableOpacity
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={onToggle}
          style={[
            styles.checkbox,
            task.completed && { backgroundColor: blockColor, borderColor: blockColor },
          ]}
        >
          {task.completed && <Ionicons name="checkmark" size={13} color="#FFF" />}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  taskCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  taskCardActive: {
    borderColor: '#4A90B2',
    transform: [{ scale: 1.02 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  taskCardCompleted: {
    opacity: 0.55,
    backgroundColor: '#FAF7F5',
  },
  timeStrip: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  timeStripText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  taskBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2521',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#7D7571',
  },
  durationText: {
    fontSize: 11,
    color: '#9C928C',
    marginTop: 2,
    fontWeight: '500',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#C4B9B1',
    alignItems: 'center',
    justifyContent: 'center',
  },
});