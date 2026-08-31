import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { INITIAL_TIMELINE_BLOCKS } from '../utils/acordionData';

// Procura o bloco correspondente à hora atual a partir da mesma fonte de dados dos acordeões
const getCurrentBlock = (currentHour) => {
  const matched = (INITIAL_TIMELINE_BLOCKS || []).find((block) => {
    const start = Number(block.startHour ?? 0);
    const end = Number(block.endHour ?? 24);

    if (start < end) {
      return currentHour >= start && currentHour < end;
    }
    // Para blocos que passam a meia-noite (ex: 23h às 7h)
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

export default function Header({ onMenuPress, completedTasks = 0, totalTasks = 0 }) {
  const currentDate = new Date();
  const currentHour = currentDate.getHours();

  // Formatação da Data em Português
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dateString = `${weekDays[currentDate.getDay()]}, ${currentDate.getDate()} ${months[currentDate.getMonth()]}`;

  const currentBlock = getCurrentBlock(currentHour);
  const IconComponent =
    currentBlock.iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;

  return (
    <View style={styles.headerContainer}>
      {/* Botão Menu */}
      <TouchableOpacity
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={onMenuPress}
        style={styles.iconButton}
      >
        <Ionicons name="menu-outline" size={24} color="#2C2521" />
      </TouchableOpacity>

      {/* Centro: Data + Tarefas Concluídas */}
      <View style={styles.centerGroup}>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={13} color="#6B625C" />
          <Text style={styles.dateText}>{dateString}</Text>
        </View>

        <View style={styles.tasksBadge}>
          <Ionicons name="checkmark-done" size={13} color="#2E7D32" />
          <Text style={styles.tasksText}>{`${completedTasks}/${totalTasks}`}</Text>
        </View>
      </View>

      {/* Direita: Mesmo ícone, cor e nome do acordeão ativo */}
      <View style={[styles.periodBadge, { backgroundColor: `${currentBlock.iconColor}18` }]}>
        <IconComponent
          name={currentBlock.iconName}
          size={15}
          color={currentBlock.iconColor}
        />
        <Text style={[styles.periodText, { color: currentBlock.iconColor }]}>
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
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3EDE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
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