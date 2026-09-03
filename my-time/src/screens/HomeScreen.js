import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  LayoutAnimation,
  LogBox,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';

import Header from '../components/Header';
import TimeBar from '../components/TimeBar';
import AccordionItem from '../components/Accordion';
import CreateTaskModal from '../components/modals/CreateTaskModal';
import EditTaskModal from '../components/modals/EditTaskModal';
import {
  INITIAL_TIMELINE_BLOCKS,
  INITIAL_TASKS,
  TIMELINE_PERIODS,
} from '../utils/acordionData';
// Ignorar o aviso de compatibilidade nativo que aparece em baixo no ecrã
LogBox.ignoreLogs(['InteractionManager has been deprecated']);

const STORAGE_KEY = '@my_time_blocks_data_v12';
const TASKS_STORAGE_KEY = '@my_time_tasks_data_v1';
const SLOT_HEIGHT = 50;

const formatTimeFromMinutes = (totalMinutes) => {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const parseTimeToMinutes = (timeStr, defaultStartHour = 7) => {
  if (!timeStr || !timeStr.includes(':')) return defaultStartHour * 60;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? defaultStartHour : h) * 60 + (isNaN(m) ? 0 : m);
};

const isCurrentTimeSlot = (startMinutes, durationMinutes = 30) => {
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const start = ((startMinutes % 1440) + 1440) % 1440;
  const end = (start + durationMinutes) % 1440;

  if (start < end) {
    return currentTotalMinutes >= start && currentTotalMinutes < end;
  }
  return currentTotalMinutes >= start || currentTotalMinutes < end;
};

const isCurrentTimeInBlock = (startHour, endHour) => {
  const currentHour = new Date().getHours();
  if (startHour < endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }
  return currentHour >= startHour || currentHour < endHour;
};

export default function HomeScreen() {
  const [blocks, setBlocks] = useState(INITIAL_TIMELINE_BLOCKS || []);
  const [tasks, setTasks] = useState(INITIAL_TASKS || []);
  const [modalVisible, setModalVisible] = useState(false);
  const [targetBlockId, setTargetBlockId] = useState(null);
  const [targetSlotMinutes, setTargetSlotMinutes] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [, setTick] = useState(0);

  const [expandedBlocks, setExpandedBlocks] = useState(() => {
    const initial = {};
    (INITIAL_TIMELINE_BLOCKS || []).forEach((b) => {
      initial[b.id] = true;
    });
    return initial;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const storedBlocks = await AsyncStorage.getItem(STORAGE_KEY);
        const storedTasks = await AsyncStorage.getItem(TASKS_STORAGE_KEY);

        let parsedBlocks = null;

        // 1. Carregar os blocks antigos, enquanto ainda precisamos deles
        if (storedBlocks) {
          const parsed = JSON.parse(storedBlocks);

          if (Array.isArray(parsed) && parsed.length > 0) {
            parsedBlocks = parsed;
            setBlocks(parsed);
          }
        }

        // 2. Se já existem tasks no formato novo, são a fonte de verdade
        if (storedTasks) {
          const parsed = JSON.parse(storedTasks);

          if (Array.isArray(parsed)) {
            setTasks(parsed);
            return;
          }
        }

        // 3. Se ainda não existem, migrar as tasks dos blocks antigos
        if (parsedBlocks) {
          const migratedTasks = parsedBlocks.flatMap((block) => {
            let currentMinute = block.startHour * 60;

            return (block.tasks || []).map((task) => {
              const startMinsPlanned =
                task.startMinsPlanned ??
                (task.timeOfDay
                  ? parseTimeToMinutes(task.timeOfDay, block.startHour)
                  : currentMinute);

              currentMinute =
                startMinsPlanned + (task.timeMinutes || 30);

              return {
                ...task,
                startMinsPlanned,
                timeOfDay:
                  task.timeOfDay ||
                  formatTimeFromMinutes(startMinsPlanned),
              };
            });
          });

          setTasks(migratedTasks);

          await AsyncStorage.setItem(
            TASKS_STORAGE_KEY,
            JSON.stringify(migratedTasks)
          );
        }
      } catch (error) {
        console.error('Erro ao carregar/migrar dados:', error);
      }
    };

    loadStoredData();
  }, []);
  const saveBlocks = async (newBlocks) => {
    setBlocks(newBlocks);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newBlocks));
    } catch (error) {
      console.error('Erro ao guardar:', error);
    }
  };
  const saveTasks = async (newTasks) => {
    setTasks(newTasks);

    try {
      await AsyncStorage.setItem(
        TASKS_STORAGE_KEY,
        JSON.stringify(newTasks)
      );
    } catch (error) {
      console.error('Erro ao guardar tarefas:', error);
    }
  };
  const buildDraggableGrid = (block) => {
    const blockStartMins = block.startHour * 60;
    const blockEndMins =
      (block.endHour >= block.startHour ? block.endHour : block.endHour + 24) * 60;

    const sortedTasks = tasks
      .filter((task) => {
        const start = task.startMinsPlanned ?? parseTimeToMinutes(task.timeOfDay);

        const blockStart = block.startHour * 60;
        const blockEnd =
          (block.endHour >= block.startHour
            ? block.endHour
            : block.endHour + 24) * 60;

        const normalizedStart =
          block.endHour < block.startHour && start < block.startHour * 60
            ? start + 24 * 60
            : start;

        return normalizedStart >= blockStart && normalizedStart < blockEnd;
      })
      .map((t) => ({
        ...t,
        startMinsPlanned:
          t.startMinsPlanned ?? parseTimeToMinutes(t.timeOfDay, block.startHour),
      }))
      .sort((a, b) => a.startMinsPlanned - b.startMinsPlanned);

    const items = [];
    let currentMinute = blockStartMins;
    const placedTaskIds = new Set();

    while (currentMinute < blockEndMins || placedTaskIds.size < sortedTasks.length) {
      let taskAtTime = sortedTasks.find(
        (t) => !placedTaskIds.has(t.id) && Math.abs(t.startMinsPlanned - currentMinute) < 15
      );

      if (!taskAtTime && currentMinute >= blockEndMins) {
        taskAtTime = sortedTasks.find((t) => !placedTaskIds.has(t.id));
      }

      if (taskAtTime) {
        placedTaskIds.add(taskAtTime.id);
        const duration = taskAtTime.timeMinutes || 30;
        items.push({
          id: `task-${taskAtTime.id}`,
          type: 'task',
          startMins: currentMinute,
          duration: duration,
          data: taskAtTime,
        });
        currentMinute += duration;
      } else {
        if (currentMinute < blockEndMins) {
          items.push({
            id: `empty-${block.id}-${currentMinute}`,
            type: 'empty',
            startMins: currentMinute,
            duration: 30,
          });
          currentMinute += 30;
        }
      }
    }

    return items;
  };

  const handleReorder = (blockId, reorderedItems) => {
    const block = blocks.find((b) => b.id === blockId);

    if (!block) return;

    let clock = block.startHour * 60;
    const reorderedTaskUpdates = new Map();

    reorderedItems.forEach((item) => {
      if (item.type === 'task') {
        reorderedTaskUpdates.set(item.data.id, {
          startMinsPlanned: clock,
          timeOfDay: formatTimeFromMinutes(clock),
        });

        clock += item.duration;
      } else {
        clock += 30;
      }
    });

    const updatedTasks = tasks.map((task) => {
      const update = reorderedTaskUpdates.get(task.id);

      return update
        ? {
          ...task,
          ...update,
        }
        : task;
    });

    saveTasks(updatedTasks);
  };

  const toggleTask = (taskId) => {
    const updatedTasks = tasks.map((task) =>
      task.id === taskId
        ? { ...task, completed: !task.completed }
        : task
    );

    saveTasks(updatedTasks);
  };

  const handleSaveTask = (blockId, title, durationMinutes) => {
    const targetBlock = blocks.find((b) => b.id === blockId);
    const duration = Math.max(1, Number(durationMinutes) || 30);

    const startMins =
      targetSlotMinutes ??
      (targetBlock?.startHour || 7) * 60;

    const newTask = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      timeMinutes: duration,
      completed: false,
      repeat: 'Nunca',
      notes: '',
      startMinsPlanned: startMins,
      timeOfDay: formatTimeFromMinutes(startMins),
    };

    saveTasks([...tasks, newTask]);

    setTargetSlotMinutes(null);
  };

  const handleEditTask = (taskId, targetBlockId, changes) => {
    const targetBlock = blocks.find(
      (block) => block.id === (targetBlockId || editingTask?.blockId)
    );

    const startMins = parseTimeToMinutes(
      changes.timeOfDay,
      targetBlock?.startHour || 7
    );

    const duration = Math.max(
      1,
      Number(changes.timeMinutes) || 30
    );

    const updatedTasks = tasks.map((task) =>
      task.id === taskId
        ? {
          ...task,
          ...changes,
          id: taskId,
          timeMinutes: duration,
          startMinsPlanned: startMins,
          timeOfDay:
            changes.timeOfDay ||
            formatTimeFromMinutes(startMins),
        }
        : task
    );

    saveTasks(updatedTasks);
    setEditingTask(null);
  };
  const handleDeleteTask = (taskId) => {
    const updatedTasks = tasks.filter(
      (task) => task.id !== taskId
    );

    saveTasks(updatedTasks);
    setEditingTask(null);
  };

  const toggleSingleAccordion = (blockId) => {
    setExpandedBlocks((prev) => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
  };

  const hasAnyOpen = Object.values(expandedBlocks).some(Boolean);

  const toggleAllAccordions = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newState = !hasAnyOpen;
    const nextMap = {};
    blocks.forEach((b) => {
      nextMap[b.id] = newState;
    });
    setExpandedBlocks(nextMap);
  };

const totalCompletedTasks = tasks.filter(
  (task) => task.completed
).length;

const totalTasksCount = tasks.length;
  const renderSlotItem = ({ item, drag, isActive, blockId }) => {
    const startMins = item.startMins;
    const duration = item.duration;
    const startTimeStr = formatTimeFromMinutes(startMins);
    const endTimeStr = formatTimeFromMinutes(startMins + duration);
    const isCurrent = isCurrentTimeSlot(startMins, duration);

    if (item.type === 'empty') {
      return (
        <View style={styles.timelineRow}>
          <View style={styles.timeColumn}>
            <Text style={[styles.timeTextEmpty, isCurrent && styles.timeTextCurrent]}>
              {startTimeStr}
            </Text>
            {isCurrent && (
              <View style={styles.beeContainer}>
                <Text style={styles.beeIcon}>🐝</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            activeOpacity={0.5}
            disabled={isActive}
            onPress={() => {
              setTargetBlockId(blockId);
              setTargetSlotMinutes(startMins);
              setModalVisible(true);
            }}
            style={[styles.emptySlotCard, isCurrent && styles.emptySlotCardCurrent]}
          >
            <Ionicons name="add" size={18} color={isCurrent ? '#F1A93B' : '#B5A99F'} />
          </TouchableOpacity>
        </View>
      );
    }

    const task = item.data;
    const isShort = duration < 15;
    const slotsCount = Math.max(0.6, duration / 30);
    const cardHeight = Math.max(34, slotsCount * SLOT_HEIGHT - 4);
    const TaskWrapper =
      Platform.OS === 'web' ? React.Fragment : ScaleDecorator;

    return (
      <TaskWrapper>
        <View style={styles.timelineRow}>
          <View style={styles.timeColumn}>
            <Text style={[styles.timeText, isCurrent && styles.timeTextCurrent]}>
              {startTimeStr}
            </Text>
            {isCurrent && (
              <View style={styles.beeContainer}>
                <Text style={styles.beeIcon}>🐝</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            onLongPress={drag}
            delayLongPress={160}
            disabled={isActive}
            onPress={() =>
              setEditingTask({
                ...task,
                blockId,
                timeOfDay: startTimeStr,
                date: task.date || new Date().toISOString().slice(0, 10),
              })
            }
            style={[
              styles.taskCard,
              { height: cardHeight },
              isCurrent && styles.taskCardCurrentSlot,
              task.completed && styles.taskCardCompleted,
              isActive && styles.taskCardDragging,
            ]}
          >
            <View style={[styles.taskCardContent, isShort && styles.taskCardContentInline]}>
              <Text
                numberOfLines={1}
                style={[styles.taskTitle, task.completed && styles.taskTitleCompleted]}
              >
                {task.title}
              </Text>

              <Text style={styles.taskDuration}>
                {startTimeStr} - {endTimeStr} ({duration} min)
              </Text>
            </View>

            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => toggleTask(task.id)}
              style={[styles.checkboxRound, task.completed && styles.checkboxCompleted]}
            >
              {task.completed && <Ionicons name="checkmark" size={11} color="#FFF" />}
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </TaskWrapper>
    );
  };

  const ScrollContainer = Platform.OS === 'web' ? ScrollView : NestableScrollContainer;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Header completedTasks={totalCompletedTasks} totalTasks={totalTasksCount} />
      <TimeBar />

      <View style={styles.actionsBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={toggleAllAccordions}
          style={styles.toggleAllBtn}
        >
          <Ionicons
            name={hasAnyOpen ? 'chevron-up-circle-outline' : 'chevron-down-circle-outline'}
            size={14}
            color="#7E736B"
          />
          <Text style={styles.toggleAllText}>
            {hasAnyOpen ? 'Fechar todos' : 'Abrir todos'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollContainer contentContainerStyle={styles.content}>
        {blocks.map((block) => {


          const blockStartMins = block.startHour * 60;

          const blockEndMins =
            (block.endHour >= block.startHour
              ? block.endHour
              : block.endHour + 24) * 60;

          const blockTasks = tasks.filter((task) => {
            const start =
              task.startMinsPlanned ??
              parseTimeToMinutes(task.timeOfDay);

            const normalizedStart =
              block.endHour < block.startHour &&
                start < blockStartMins
                ? start + 24 * 60
                : start;

            return (
              normalizedStart >= blockStartMins &&
              normalizedStart < blockEndMins
            );
          });

          const completedCount = blockTasks.filter(
            (task) => task.completed
          ).length;

          const totalCount = blockTasks.length;

          const taskProgress = `${completedCount}/${totalCount}`;

          const blockDurationHours =
            block.endHour >= block.startHour
              ? block.endHour - block.startHour
              : 24 - block.startHour + block.endHour;

          const totalBlockSlots = blockDurationHours * 2;

          const usedSlots = Math.round(
            blockTasks.reduce(
              (acc, task) => acc + (task.timeMinutes || 30),
              0
            ) / 30
          );

          const slotsProgress = `${usedSlots}/${totalBlockSlots} slots`;

          const gridItems = buildDraggableGrid(block);

          const standardEndMins = (block.endHour >= block.startHour ? block.endHour : block.endHour + 24) * 60;
          const lastItem = gridItems[gridItems.length - 1];
          const actualEndMins = lastItem ? lastItem.startMins + lastItem.duration : standardEndMins;
          const visualEndMins = Math.max(standardEndMins, actualEndMins);

          return (
            <View key={block.id} style={styles.blockContainer}>
              <AccordionItem
                title={block.title}
                taskProgress={taskProgress}
                slotsProgress={slotsProgress}
                startHour={block.startHour}
                endHour={block.endHour}
                backgroundColor={block.backgroundColor}
                iconFamily={block.iconFamily}
                iconName={block.iconName}
                iconColor={block.iconColor}
                isCurrentPeriod={isCurrentTimeInBlock(block.startHour, block.endHour)}
                expanded={Boolean(expandedBlocks[block.id])}
                onToggle={() => toggleSingleAccordion(block.id)}
              >
                {Platform.OS === 'web' ? (
                  <View>
                    {gridItems.map((item) => (
                      <View key={item.id}>
                        {renderSlotItem({ item, drag: undefined, isActive: false, blockId: block.id })}
                      </View>
                    ))}
                  </View>
                ) : (
                  <NestableDraggableFlatList
                    data={gridItems}
                    keyExtractor={(item) => item.id}
                    onDragEnd={({ data }) => handleReorder(block.id, data)}
                    autoscrollThreshold={0} // <--- MATADOR DE BUGS: Desliga o auto-scroll fantasma
                    activationDistance={10} // <--- Exige um micro-movimento para iniciar o drag
                    renderItem={({ item, drag, isActive }) =>
                      renderSlotItem({ item, drag, isActive, blockId: block.id })
                    }
                  />
                )}

                <View style={styles.endHourRow}>
                  <Text style={styles.timeTextEmpty}>
                    {formatTimeFromMinutes(visualEndMins)}
                  </Text>
                </View>
              </AccordionItem>
            </View>
          );
        })}
      </ScrollContainer>

      <CreateTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveTask}
        initialBlockId={targetBlockId}
        blocks={blocks}
      />

      <EditTaskModal
        visible={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onSave={handleEditTask}
        onDelete={handleDeleteTask}
        task={editingTask}
        blocks={blocks}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
  },
  toggleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F3EDE7',
  },
  toggleAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E736B',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 6,
  },
  blockContainer: {
    marginBottom: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  timeColumn: {
    width: 62,
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 6,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B625C',
  },
  timeTextCurrent: {
    color: '#2C2521',
    fontWeight: '800',
  },
  timeTextEmpty: {
    fontSize: 11,
    fontWeight: '500',
    color: '#B5A99F',
  },
  beeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  beeIcon: {
    fontSize: 13,
  },
  endHourRow: {
    paddingTop: 2,
    marginBottom: 2,
  },
  taskCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EAE2DA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1.5,
  },
  taskCardCurrentSlot: {
    borderColor: '#F1A93B',
    borderWidth: 1.5,
  },
  taskCardCompleted: {
    backgroundColor: '#F7F3EE',
    borderColor: '#EAE4DC',
    opacity: 0.65,
  },
  taskCardDragging: {
    borderColor: '#4A90B2',
    borderWidth: 1.5,
    elevation: 6,
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  taskCardContent: {
    flex: 1,
    paddingRight: 8,
    justifyContent: 'center',
  },
  taskCardContentInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C2521',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9E9289',
  },
  taskDuration: {
    fontSize: 10,
    color: '#8C827B',
    marginTop: 1,
    fontWeight: '500',
  },
  checkboxRound: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#B0A49B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#8C827B',
    borderColor: '#8C827B',
  },
  emptySlotCard: {
    flex: 1,
    height: SLOT_HEIGHT - 4,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#DDD4CC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  emptySlotCardCurrent: {
    borderColor: '#F1A93B',
    backgroundColor: 'rgba(241, 169, 59, 0.08)',
  },
});