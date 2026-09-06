import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { INITIAL_TIMELINE_BLOCKS } from '../utils/acordionData';

// Procura o bloco correspondente à hora atual
const getCurrentBlock = (currentHour) => {
  const matched = (INITIAL_TIMELINE_BLOCKS || []).find((block) => {
    const start = Number(block.startHour ?? 0);
    const end = Number(block.endHour ?? 24);

    if (start < end) {
      return currentHour >= start && currentHour < end;
    }

    // Blocos que atravessam a meia-noite
    return currentHour >= start || currentHour < end;
  });

  return (
    matched || {
      title: 'Dia',
      iconFamily: 'Ionicons',
      iconName: 'sunny-outline',
      iconColor: '#3A9BB7',
    }
  );
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatSelectedDate = (date) => {
  const today = new Date();

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];

  if (isSameDay(date, today)) {
    return `Hoje, ${day} ${month}`;
  }

  return `${weekDays[date.getDay()]}, ${day} ${month}`;
};

export default function Header({
  onMenuPress,

  selectedDate,
  onPreviousDay,
  onNextDay,
  onDatePress,

  completedTasks = 0,
  totalTasks = 0,
}) {
  const now = new Date();
  const currentHour = now.getHours();

  const safeSelectedDate =
    selectedDate instanceof Date ? selectedDate : new Date();

  const dateString = formatSelectedDate(safeSelectedDate);

  const currentBlock = getCurrentBlock(currentHour);

  const IconComponent =
    currentBlock.iconFamily === 'MaterialCommunityIcons'
      ? MaterialCommunityIcons
      : Ionicons;

  return (
    <View style={styles.headerContainer}>
      {/* MENU */}
      <TouchableOpacity
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={onMenuPress}
        style={styles.iconButton}
        activeOpacity={0.7}
      >
        <Ionicons name="menu-outline" size={24} color="#2C2521" />
      </TouchableOpacity>

      {/* CENTRO */}
      <View style={styles.centerGroup}>
        {/* NAVEGAÇÃO DE DATA */}
        <View style={styles.dateNavigator}>
          <TouchableOpacity
            style={styles.dateArrowButton}
            onPress={onPreviousDay}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="chevron-back"
              size={15}
              color="#6B625C"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateMainButton}
            onPress={onDatePress}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color="#6B625C"
            />

            <Text style={styles.dateText}>
              {dateString}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateArrowButton}
            onPress={onNextDay}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="chevron-forward"
              size={15}
              color="#6B625C"
            />
          </TouchableOpacity>
        </View>

        {/* TAREFAS */}
        <View style={styles.tasksBadge}>
          <Ionicons
            name="checkmark-done"
            size={13}
            color="#2E7D32"
          />

          <Text style={styles.tasksText}>
            {`${completedTasks}/${totalTasks}`}
          </Text>
        </View>
      </View>

      {/* PERÍODO ATUAL */}
      <View
        style={[
          styles.periodBadge,
          {
            backgroundColor: `${currentBlock.iconColor}18`,
          },
        ]}
      >
        <IconComponent
          name={currentBlock.iconName}
          size={15}
          color={currentBlock.iconColor}
        />

        <Text
          style={[
            styles.periodText,
            {
              color: currentBlock.iconColor,
            },
          ]}
        >
          {currentBlock.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFDF9',
  },

  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  centerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3EDE7',
    borderRadius: 6,
  },

  dateArrowButton: {
    width: 26,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateMainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 3,
  },

  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B625C',
  },

  tasksBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  tasksText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D32',
  },

  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },

  periodText: {
    fontSize: 12,
    fontWeight: '700',
  },
});