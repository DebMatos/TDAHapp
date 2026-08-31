import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import {
  NestableDraggableFlatList,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import TaskCardClean, { SLOT_HEIGHT } from './TaskCardClean';

export default function CleanTimeGrid({
  startHour = 7,
  endHour = 9,
  tasks = [],
  onReorder,
  onToggleTask,
}) {
  const totalSlots = ((endHour >= startHour ? endHour - startHour : 24 - startHour + endHour)) * 2;

  return (
    <View style={styles.wrapper}>
      {/* 1. Grelha de Fundo (Linhas + Horas de 30 em 30 min) */}
      <View style={styles.backgroundGrid} pointerEvents="none">
        {Array.from({ length: totalSlots + 1 }).map((_, index) => {
          const totalMinutes = startHour * 60 + index * 30;
          const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
          const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
          const mm = String(normalized % 60).padStart(2, '0');

          return (
            <View key={index} style={[styles.gridRow, { height: SLOT_HEIGHT }]}>
              <Text style={styles.hourText}>{`${hh}:${mm}`}</Text>
              <View style={styles.gridLine} />
            </View>
          );
        })}
      </View>

      {/* 2. Camada Superior: Tarefas Arrastáveis */}
      <View style={styles.tasksLayer}>
        <NestableDraggableFlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          onDragEnd={({ data }) => onReorder(data)}
          renderItem={({ item, drag, isActive }) => (
            <ScaleDecorator>
              <View collapsable={false}>
                <TaskCardClean
                  task={item}
                  isActive={isActive}
                  onLongPress={drag}
                  onToggle={() => onToggleTask(item.id)}
                />
              </View>
            </ScaleDecorator>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    width: '100%',
    paddingVertical: 6,
  },
  backgroundGrid: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourText: {
    width: 44,
    fontSize: 11,
    fontWeight: '600',
    color: '#A89E96',
    marginTop: -7,
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ECE4DD',
  },
  tasksLayer: {
    marginLeft: 48, // Deixa a coluna das horas visível à esquerda
    minHeight: SLOT_HEIGHT * 2,
  },
});