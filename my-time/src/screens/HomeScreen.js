import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import Header from '../components/Header';
import TimeBar from '../components/TimeBar';
import CreateTaskModal from '../components/modals/CreateTaskModal';
import EditTaskModal from '../components/modals/EditTaskModal';
import { INITIAL_TIMELINE_BLOCKS } from '../utils/acordionData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_KEY = '@my_time_blocks_data_v12';
const TASKS_STORAGE_KEY = '@my_time_tasks_data_v1';

const DAY_MINUTES = 24 * 60;
const DAY_START_MINUTE = 0; // 00:00 como na tua app de referência
const SNAP_MINUTES = 5;

const MAX_PPM = 3.2;
const DEFAULT_PPM = 1.25;
const VERTICAL_PADDING = 20;

const AXIS_WIDTH = 48;
const CARD_LEFT = 56;
const CARD_RIGHT = 12;

const COLLAPSED_GAP_HEIGHT = 28; // Espaço do botão quando comprimido
const LONG_PRESS_DELAY_MS = 350;

const formatHour = (minute) => {
  const h = Math.floor(minute / 60) % 24;
  return String(h).padStart(2, '0');
};

const formatTimeFromMinutes = (totalMinutes) => {
  const normalized = ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return 7 * 60;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? 7 : h) * 60 + (isNaN(m) ? 0 : m);
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const snap = (minutes) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

const getPinchDistance = (touches) => {
  const [t1, t2] = touches;
  const dx = t1.pageX - t2.pageX;
  const dy = t1.pageY - t2.pageY;
  return Math.sqrt(dx * dx + dy * dy);
};

const CARD_THEMES = [
  { bg: '#F1F5FD', border: '#DCE6FA', accent: '#4F75E2', text: '#2A437E' },
  { bg: '#F5F2FC', border: '#E5DCFA', accent: '#7A55D6', text: '#4C328E' },
  { bg: '#FDF4EC', border: '#FAE0CC', accent: '#E0783E', text: '#8F471B' },
  { bg: '#EDF8F2', border: '#D0EFE0', accent: '#38A169', text: '#216340' },
];

/* -------------------------------------------------------
   TASK
------------------------------------------------------- */
function DraggableTask({
  task,
  ppm,
  onChangeStart,
  onDragStateChange,
  onPress,
  onToggle,
  themeIndex,
  getVisualY,
  getMinuteFromY,
}) {
  const dragY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const duration = task.timeMinutes || 30;
  const realHeight = duration * ppm;
  const visualHeight = Math.max(22, realHeight);
  const isCompact = visualHeight < 44;

  const top = getVisualY(task.startMinsPlanned || 0);
  const theme = CARD_THEMES[themeIndex % CARD_THEMES.length];

  const longPressTimer = useRef(null);
  const isDragActive = useRef(false);
  const initialTouch = useRef({ x: 0, y: 0 });

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const resetAll = useCallback(() => {
    clearTimer();
    isDragActive.current = false;
    onDragStateChange?.(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [clearTimer, onDragStateChange, scaleAnim]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => isDragActive.current,
        onMoveShouldSetPanResponderCapture: () => isDragActive.current,
        onPanResponderTerminationRequest: () => !isDragActive.current,

        onPanResponderGrant: () => {
          dragY.setValue(0);
        },

        onPanResponderMove: (_, gesture) => {
          if (isDragActive.current) {
            dragY.setValue(gesture.dy);
          }
        },

        onPanResponderRelease: (_, gesture) => {
          if (isDragActive.current) {
            const finalY = top + gesture.dy;
            const finalMins = clamp(
              snap(getMinuteFromY(finalY)),
              0,
              DAY_MINUTES - duration
            );

            dragY.setValue(0);
            onChangeStart(task.id, finalMins);
          }
          resetAll();
        },

        onPanResponderTerminate: () => {
          dragY.setValue(0);
          resetAll();
        },
      }),
    [dragY, top, getMinuteFromY, duration, onChangeStart, task.id, resetAll]
  );

  const handleTouchStart = (e) => {
    const { pageX, pageY } = e.nativeEvent;
    initialTouch.current = { x: pageX, y: pageY };

    clearTimer();
    longPressTimer.current = setTimeout(() => {
      isDragActive.current = true;
      onDragStateChange?.(true);

      Animated.spring(scaleAnim, {
        toValue: 1.03,
        useNativeDriver: true,
        friction: 4,
      }).start();
    }, LONG_PRESS_DELAY_MS);
  };

  const handleTouchMove = (e) => {
    if (!isDragActive.current) {
      const { pageX, pageY } = e.nativeEvent;
      const dx = Math.abs(pageX - initialTouch.current.x);
      const dy = Math.abs(pageY - initialTouch.current.y);
      if (dx > 8 || dy > 8) clearTimer();
    }
  };

  const handleTouchEnd = () => {
    if (!isDragActive.current) clearTimer();
  };

  const startTimeStr = formatTimeFromMinutes(task.startMinsPlanned);
  const endTimeStr = formatTimeFromMinutes(task.startMinsPlanned + duration);

  if (isCompact) {
    return (
      <Animated.View
        {...responder.panHandlers}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={[
          styles.taskCompact,
          {
            top,
            height: visualHeight,
            left: CARD_LEFT,
            right: CARD_RIGHT,
            backgroundColor: theme.bg,
            borderColor: theme.border,
            transform: [{ translateY: dragY }, { scale: scaleAnim }],
          },
        ]}
      >
        <View style={[styles.taskCompactBar, { backgroundColor: theme.accent }]} />
        <TouchableOpacity
          style={styles.compactClickArea}
          onPress={() => {
            if (!isDragActive.current) onPress(task);
          }}
        >
          <Text
            style={[
              styles.compactTitle,
              { color: theme.text },
              task.completed && styles.taskTitleCompleted,
            ]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => onToggle(task.id)}
          style={[
            styles.compactCheckbox,
            { borderColor: theme.accent },
            task.completed && { backgroundColor: theme.accent },
          ]}
        >
          {task.completed && <Ionicons name="checkmark" size={8} color="#FFF" />}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      {...responder.panHandlers}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={[
        styles.taskNormal,
        {
          top,
          height: visualHeight,
          left: CARD_LEFT,
          right: CARD_RIGHT,
          backgroundColor: theme.bg,
          borderColor: theme.border,
          transform: [{ translateY: dragY }, { scale: scaleAnim }],
        },
        task.completed && styles.taskCompletedOpacity,
      ]}
    >
      <View style={[styles.taskAccentBar, { backgroundColor: theme.accent }]} />
      <TouchableOpacity
        style={styles.taskBody}
        onPress={() => {
          if (!isDragActive.current) onPress(task);
        }}
      >
        <Text
          style={[
            styles.taskTitle,
            { color: theme.text },
            task.completed && styles.taskTitleCompleted,
          ]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <Text style={styles.taskMeta}>
          {startTimeStr} – {endTimeStr}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => onToggle(task.id)}
        style={[
          styles.checkbox,
          { borderColor: theme.accent },
          task.completed && { backgroundColor: theme.accent },
        ]}
      >
        {task.completed && <Ionicons name="checkmark" size={12} color="#FFF" />}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* -------------------------------------------------------
   SCREEN
------------------------------------------------------- */
export default function TimelineScreen() {
  const scrollRef = useRef(null);

  const [viewportHeight, setViewportHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [ppm, setPpm] = useState(DEFAULT_PPM);

  const [tasks, setTasks] = useState([]);
  const [blocks, setBlocks] = useState(INITIAL_TIMELINE_BLOCKS || []);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [targetSlotMinutes, setTargetSlotMinutes] = useState(null);

  // Intervalo comprimível (00:00 até às 06:00 da manhã como na tua screenshot)
  const [isNightCollapsed, setIsNightCollapsed] = useState(true);

  const NIGHT_START = 0 * 60; // 00:00
  const NIGHT_END = 6 * 60;   // 06:00
  const NIGHT_DURATION = NIGHT_END - NIGHT_START;

  const toggleNight = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsNightCollapsed((prev) => !prev);
  };

  /* CÁLCULO DE Y ADAPTATIVO */
  const getVisualY = useCallback(
    (minute) => {
      if (!isNightCollapsed) {
        return minute * ppm + VERTICAL_PADDING;
      }

      if (minute <= NIGHT_START) {
        return minute * ppm + VERTICAL_PADDING;
      }

      if (minute > NIGHT_START && minute < NIGHT_END) {
        // Horas dentro do colapso ficam compactadas dentro do botão toggle
        const progress = (minute - NIGHT_START) / NIGHT_DURATION;
        return NIGHT_START * ppm + progress * COLLAPSED_GAP_HEIGHT + VERTICAL_PADDING;
      }

      // Horas depois do bloco sobem o tempo colapsado
      const savedHeight = NIGHT_DURATION * ppm - COLLAPSED_GAP_HEIGHT;
      return minute * ppm - savedHeight + VERTICAL_PADDING;
    },
    [isNightCollapsed, ppm]
  );

  const getMinuteFromY = useCallback(
    (y) => {
      const rawY = y - VERTICAL_PADDING;
      if (!isNightCollapsed) return rawY / ppm;

      const splitY = NIGHT_START * ppm;
      if (rawY <= splitY) return rawY / ppm;

      if (rawY <= splitY + COLLAPSED_GAP_HEIGHT) {
        const progress = (rawY - splitY) / COLLAPSED_GAP_HEIGHT;
        return NIGHT_START + progress * NIGHT_DURATION;
      }

      const savedHeight = NIGHT_DURATION * ppm - COLLAPSED_GAP_HEIGHT;
      return (rawY + savedHeight) / ppm;
    },
    [isNightCollapsed, ppm]
  );

  const canvasHeight = useMemo(() => {
    if (!isNightCollapsed) {
      return DAY_MINUTES * ppm + VERTICAL_PADDING * 2;
    }
    const savedHeight = NIGHT_DURATION * ppm - COLLAPSED_GAP_HEIGHT;
    return DAY_MINUTES * ppm - savedHeight + VERTICAL_PADDING * 2;
  }, [isNightCollapsed, ppm]);

  /* AGORA */
  const now = new Date();
  const currentAbsMins = now.getHours() * 60 + now.getMinutes();
  const nowTop = getVisualY(currentAbsMins);

  /* SCROLL PARA O AGORA */
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (viewportHeight > 0 && !initialScrollDone.current && scrollRef.current) {
      initialScrollDone.current = true;
      const targetY = nowTop - viewportHeight * 0.35;
      const maxScroll = Math.max(0, canvasHeight - viewportHeight);
      const y = clamp(targetY, 0, maxScroll);

      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y, animated: false });
      });
    }
  }, [viewportHeight, nowTop, canvasHeight]);

  /* CARREGAR DADOS */
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const storedBlocks = await AsyncStorage.getItem(STORAGE_KEY);
        const storedTasks = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
        let parsedBlocks = null;

        if (storedBlocks) {
          const parsed = JSON.parse(storedBlocks);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsedBlocks = parsed;
            setBlocks(parsed);
          }
        }

        if (storedTasks) {
          const parsed = JSON.parse(storedTasks);
          if (Array.isArray(parsed)) {
            setTasks(parsed);
            return;
          }
        }

        if (parsedBlocks) {
          const migratedTasks = parsedBlocks.flatMap((block) => {
            let currentMinute = block.startHour * 60;
            return (block.tasks || []).map((task) => {
              const startMinsPlanned =
                task.startMinsPlanned ??
                (task.timeOfDay ? parseTimeToMinutes(task.timeOfDay) : currentMinute);
              currentMinute = startMinsPlanned + (task.timeMinutes || 30);
              return {
                ...task,
                startMinsPlanned,
                timeOfDay: task.timeOfDay || formatTimeFromMinutes(startMinsPlanned),
              };
            });
          });
          setTasks(migratedTasks);
          await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(migratedTasks));
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    };
    loadStoredData();
  }, []);

  const saveTasks = async (newTasks) => {
    setTasks(newTasks);
    try {
      await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(newTasks));
    } catch (error) {
      console.error('Erro ao guardar tarefas:', error);
    }
  };

  const handleDragEnd = (taskId, newMins) => {
    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? { ...t, startMinsPlanned: newMins, timeOfDay: formatTimeFromMinutes(newMins) }
        : t
    );
    saveTasks(updatedTasks);
  };

  const toggleTaskComplete = (taskId) => {
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    saveTasks(updatedTasks);
  };

  const handleSaveTask = (blockId, title, durationMinutes) => {
    const duration = Math.max(1, Number(durationMinutes) || 30);
    const startMins = targetSlotMinutes ?? 7 * 60;

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
    setModalVisible(false);
  };

  const handleEditTask = (taskId, targetBlockId, changes) => {
    const startMins = parseTimeToMinutes(changes.timeOfDay);
    const duration = Math.max(1, Number(changes.timeMinutes) || 30);

    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            ...changes,
            timeMinutes: duration,
            startMinsPlanned: startMins,
            timeOfDay: changes.timeOfDay || formatTimeFromMinutes(startMins),
          }
        : t
    );
    saveTasks(updatedTasks);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId) => {
    saveTasks(tasks.filter((t) => t.id !== taskId));
    setEditingTask(null);
  };

  const minPpm = useMemo(() => {
    return viewportHeight > 0 ? (viewportHeight - VERTICAL_PADDING * 2) / DAY_MINUTES : 0.3;
  }, [viewportHeight]);

  const ppmRef = useRef(ppm);
  useEffect(() => { ppmRef.current = ppm; }, [ppm]);
  const minPpmRef = useRef(minPpm);
  useEffect(() => { minPpmRef.current = minPpm; }, [minPpm]);

  // Lista das 24 horas (00 a 23)
  const hourMarkers = useMemo(() => Array.from({ length: 25 }, (_, i) => i * 60), []);

  const pinchStartDistance = useRef(0);
  const initialPpm = useRef(1);

  const zoomResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,
        onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,
        onPanResponderGrant: (evt) => {
          if (evt.nativeEvent.touches.length === 2) {
            pinchStartDistance.current = getPinchDistance(evt.nativeEvent.touches);
            initialPpm.current = ppmRef.current;
          }
        },
        onPanResponderMove: (evt) => {
          if (evt.nativeEvent.touches.length === 2 && pinchStartDistance.current > 0) {
            const currentDistance = getPinchDistance(evt.nativeEvent.touches);
            const scale = currentDistance / pinchStartDistance.current;
            setPpm(clamp(initialPpm.current * scale, minPpmRef.current, MAX_PPM));
          }
        },
        onPanResponderRelease: () => { pinchStartDistance.current = 0; },
        onPanResponderTerminate: () => { pinchStartDistance.current = 0; },
      }),
    []
  );

  const isDense = ppm < 0.7;
  const totalCompletedTasks = tasks.filter((t) => t.completed).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <Header completedTasks={totalCompletedTasks} totalTasks={tasks.length} />
      <TimeBar />

      <View
        {...zoomResponder.panHandlers}
        style={styles.timelineViewport}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      >
        <ScrollView
          ref={scrollRef}
          scrollEnabled={!isDragging}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ height: canvasHeight }}
        >
          <View style={[styles.timelineCanvas, { height: canvasHeight }]}>
            {/* RÉGUA */}
            <View style={[styles.rail, { height: canvasHeight }]} />

            {/* MARCADORES DE HORA */}
            {hourMarkers.map((minute) => {
              // Se colapsado, esconde as horas entre as 00 e as 06
              if (isNightCollapsed && minute > NIGHT_START && minute < NIGHT_END) {
                return null;
              }

              const top = getVisualY(minute);
              const isOdd = (minute / 60) % 2 !== 0;
              const hideText = isDense && isOdd;

              return (
                <View key={minute} style={[styles.hourRow, { top: top - 8 }]}>
                  <Text style={[styles.hourText, isDense && styles.hourTextOverview]}>
                    {!hideText ? formatHour(minute) : ''}
                  </Text>
                  <View style={[styles.hourLine, (isDense || hideText) && styles.hourLineOverview]} />
                </View>
              );
            })}

            {/* TOGGLE PERMANENTE NO EIXO (Estilo das tuas imagens) */}
            <View
              style={[
                styles.axisToggleRow,
                { top: getVisualY(NIGHT_START) + 12 },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={toggleNight}
                style={styles.axisToggleButton}
              >
                {/* Mostra o ícone de toggle estilo TimeTune */}
                <Text style={styles.axisToggleIcon}>
                  {isNightCollapsed ? '⬍' : '≎'}
                </Text>
              </TouchableOpacity>
              {isNightCollapsed && <View style={styles.axisToggleDash} />}
            </View>

            {/* TAREFAS */}
            {tasks.map((task, index) => (
              <DraggableTask
                key={task.id}
                task={task}
                ppm={ppm}
                themeIndex={index}
                onChangeStart={handleDragEnd}
                onDragStateChange={setIsDragging}
                onToggle={toggleTaskComplete}
                onPress={(t) => setEditingTask(t)}
                getVisualY={getVisualY}
                getMinuteFromY={getMinuteFromY}
              />
            ))}

            {/* LINHA "AGORA" */}
            <View pointerEvents="none" style={[styles.nowLine, { top: nowTop }]}>
              <View style={styles.nowDot} />
              <View style={styles.nowBadge}>
                <Text style={styles.nowBadgeText}>AGORA</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => {
            setTargetSlotMinutes(now.getHours() * 60);
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <CreateTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveTask}
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

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  timelineViewport: {
    flex: 1,
    position: 'relative',
    marginTop: 8,
  },
  timelineCanvas: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourText: {
    width: AXIS_WIDTH,
    paddingRight: 10,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '500',
    color: '#9C948D',
  },
  hourTextOverview: {
    fontSize: 9,
    color: '#C7BFB9',
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F3EFEA',
  },
  hourLineOverview: {
    backgroundColor: '#FBF9F7',
  },
  rail: {
    position: 'absolute',
    top: 0,
    left: AXIS_WIDTH,
    width: 1.5,
    backgroundColor: '#ECE7E1',
  },

  /* BOTÃO TOGGLE NO EIXO */
  axisToggleRow: {
    position: 'absolute',
    left: 0,
    right: 12,
    height: COLLAPSED_GAP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
  },
  axisToggleButton: {
    width: AXIS_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  axisToggleIcon: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A827C',
    letterSpacing: -1,
  },
  axisToggleDash: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: '#E8E1DA',
    borderStyle: 'dashed',
  },

  /* AGORA */
  nowLine: {
    position: 'absolute',
    left: AXIS_WIDTH,
    right: 10,
    height: 1.5,
    zIndex: 90,
    backgroundColor: '#FF4D85',
  },
  nowDot: {
    position: 'absolute',
    left: -3,
    top: -2.5,
    width: 6.5,
    height: 6.5,
    borderRadius: 4,
    backgroundColor: '#FF4D85',
  },
  nowBadge: {
    position: 'absolute',
    right: 0,
    top: -9,
    backgroundColor: '#FF4D85',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  nowBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  /* TAREFAS */
  taskNormal: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#1A1817',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  taskAccentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  taskBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  taskMeta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '500',
    color: '#8A827C',
  },
  checkbox: {
    width: 20,
    height: 20,
    marginRight: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCompletedOpacity: {
    opacity: 0.55,
  },
  taskCompact: {
    position: 'absolute',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 2,
  },
  taskCompactBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  compactClickArea: {
    flex: 1,
    paddingHorizontal: 6,
  },
  compactTitle: {
    fontSize: 9,
    fontWeight: '700',
  },
  compactCheckbox: {
    width: 11,
    height: 11,
    marginRight: 6,
    borderRadius: 3,
    borderWidth: 1.2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B71F7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4.5,
    elevation: 6,
  },
});