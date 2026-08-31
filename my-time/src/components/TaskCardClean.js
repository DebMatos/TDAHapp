import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const SLOT_HEIGHT = 56; // 30 min = 56px de altura na grelha

const calculateCardHeight = (minutes = 30) => {
  const slots = Math.max(0.6, minutes / 30);
  return Math.max(48, slots * SLOT_HEIGHT - 6); // -6px de margem visual
};

export default function TaskCardClean({
  task,
  onToggle,
  onLongPress,
  isActive,
}) {
  const cardHeight = calculateCardHeight(task.timeMinutes);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={onLongPress}
      delayLongPress={160}
      style={[
        styles.card,
        { minHeight: cardHeight },
        isActive && styles.cardActive,
        task.completed && styles.cardCompleted,
      ]}
    >
      <View style={styles.content}>
        <Text
          numberOfLines={2}
          style={[styles.title, task.completed && styles.titleCompleted]}
        >
          {task.title}
        </Text>
        <Text style={styles.duration}>{task.timeMinutes} min</Text>
      </View>

      {/* Checkbox Circular */}
      <TouchableOpacity
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={onToggle}
        style={[styles.checkbox, task.completed && styles.checkboxCompleted]}
      >
        {task.completed && <Ionicons name="checkmark" size={13} color="#FFF" />}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EAE2DA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardActive: {
    borderColor: '#4A90B2',
    backgroundColor: '#FAF7F4',
    transform: [{ scale: 1.02 }],
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  cardCompleted: {
    backgroundColor: '#F7F3EE',
    borderColor: '#EFEAE3',
    opacity: 0.7,
  },
  content: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2521',
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9C9088',
  },
  duration: {
    fontSize: 11,
    color: '#8C827B',
    marginTop: 2,
    fontWeight: '500',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#B0A49B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#8C827B',
    borderColor: '#8C827B',
  },
});