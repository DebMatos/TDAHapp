import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SLOT_HEIGHT = 44; // Altura de cada slot de 30 minutos

export default function TimeSlotGrid({
  startHour = 7,
  endHour = 9,
  tasks = [],
  blockColor = '#3A9BB7',
  onToggleTask,
  onOpenTaskMenu,
}) {
  // 1. Calcula os slots de 30 minutos do intervalo
  const totalSlots = ((endHour >= startHour ? endHour - startHour : 24 - startHour + endHour)) * 2;
  
  // 2. Mapeia as tarefas sequencialmente nos slots
  let currentSlotIndex = 0;
  const renderedTasks = tasks.map((task) => {
    const slotsNeeded = Math.max(1, Math.ceil((task.timeMinutes || 30) / 30));
    const top = currentSlotIndex * SLOT_HEIGHT;
    const height = slotsNeeded * SLOT_HEIGHT - 2; // -2px para margem visual
    currentSlotIndex += slotsNeeded;

    return {
      ...task,
      top,
      height,
    };
  });

  return (
    <View style={[styles.container, { height: totalSlots * SLOT_HEIGHT }]}>
      {/* Grelha de Fundo com as Linhas de 30 min */}
      {Array.from({ length: totalSlots }).map((_, index) => {
        const totalMinutes = startHour * 60 + index * 30;
        const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
        const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
        const mm = String(normalized % 60).padStart(2, '0');
        const isFullHour = mm === '00';

        return (
          <View key={index} style={[styles.slotRow, { height: SLOT_HEIGHT }]}>
            <View style={styles.timeColumn}>
              <Text style={[styles.timeLabel, isFullHour && styles.timeLabelBold]}>
                {`${hh}:${mm}`}
              </Text>
            </View>
            <View style={[styles.slotLine, isFullHour && styles.slotLineBold]} />
          </View>
        );
      })}

      {/* Blocos de Tarefas Sobrepostos na Grelha */}
      <View style={styles.tasksOverlay}>
        {renderedTasks.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.85}
            onPress={() => onOpenTaskMenu && onOpenTaskMenu(item)}
            style={[
              styles.taskBlock,
              {
                top: item.top,
                height: item.height,
                backgroundColor: item.completed ? '#D5CDC7' : blockColor,
              },
            ]}
          >
            <View style={styles.taskContent}>
              <Text
                numberOfLines={1}
                style={[styles.taskTitle, item.completed && styles.taskCompletedText]}
              >
                {item.title}
              </Text>
              <Text style={styles.taskDuration}>{item.timeMinutes}m</Text>
            </View>

            {/* Checkbox minimalista */}
            <TouchableOpacity
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => onToggleTask(item.id)}
              style={[styles.checkbox, item.completed && styles.checkboxCompleted]}
            >
              {item.completed && <Ionicons name="checkmark" size={12} color="#FFF" />}
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    marginVertical: 4,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeColumn: {
    width: 48,
    alignItems: 'flex-start',
  },
  timeLabel: {
    fontSize: 11,
    color: '#A0958E',
    fontWeight: '400',
  },
  timeLabelBold: {
    fontWeight: '700',
    color: '#6B625C',
  },
  slotLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EFE8E2',
  },
  slotLineBold: {
    backgroundColor: '#D9CFC7',
  },
  tasksOverlay: {
    position: 'absolute',
    top: 0,
    left: 52,
    right: 0,
    bottom: 0,
  },
  taskBlock: {
    position: 'absolute',
    left: 0,
    right: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  taskContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  taskDuration: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  taskCompletedText: {
    textDecorationLine: 'line-through',
    color: '#F2EFEB',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  checkboxCompleted: {
    backgroundColor: '#8C827B',
    borderColor: '#8C827B',
  },
});