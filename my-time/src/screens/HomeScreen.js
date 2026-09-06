import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
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
import TaskCardClean from '../components/TaskCardClean';
import Header from '../components/Header';
import CreateTaskModal from '../components/modals/CreateTaskModal';
import EditTaskModal from '../components/modals/EditTaskModal';
import { INITIAL_TIMELINE_BLOCKS } from '../utils/acordionData';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_KEY = '@my_time_blocks_data_v12';
const TASKS_STORAGE_KEY = '@my_time_tasks_data_v1';

const DAY_MINUTES = 24 * 60;
const MAX_PPM = 1.75;
const DEFAULT_PPM = 1.25;
const VERTICAL_PADDING = 20;
const AXIS_WIDTH = 48;

const TIMELINE_START_MINUTES = 7 * 60;
/* -------------------------------------------------------
   CORES DA ESPINHA DORSAL
------------------------------------------------------- */
const getRailColor = (hour) => {
  if (hour >= 7 && hour < 9) return '#68D391';
  if (hour >= 9 && hour < 12) return '#F6E05E';
  if (hour >= 12 && hour < 14) return '#F6AD55';
  if (hour >= 14 && hour < 18) return '#FC8181';
  if (hour >= 18 && hour < 23) return '#B794F4';

  return '#7F9CF5';
};
const VERTICAL_SEGMENTS = [
  { start: 7, duration: 2, color: '#68D391' },
  { start: 9, duration: 3, color: '#F6E05E' },
  { start: 12, duration: 2, color: '#F6AD55' },
  { start: 14, duration: 4, color: '#FC8181' },
  { start: 18, duration: 5, color: '#B794F4' },
  { start: 23, duration: 8, color: '#7F9CF5' },
];
const formatTimeFromMinutes = (totalMinutes) => {
  const normalized =
    ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return 7 * 60;

  const [h, m] = timeStr.split(':').map(Number);

  return (isNaN(h) ? 7 : h) * 60 + (isNaN(m) ? 0 : m);
};

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

const getPinchDistance = (touches) => {
  const [t1, t2] = touches;

  const dx = t1.pageX - t2.pageX;
  const dy = t1.pageY - t2.pageY;

  return Math.sqrt(dx * dx + dy * dy);
};

/* -------------------------------------------------------
   SCREEN
------------------------------------------------------- */
export default function TimelineScreen() {
  const scrollRef = useRef(null);

  const [viewportHeight, setViewportHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [ppm, setPpm] = useState(DEFAULT_PPM);

  const [tasks, setTasks] = useState([]);
  const [blocks, setBlocks] = useState(
    INITIAL_TIMELINE_BLOCKS || []
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [targetSlotMinutes, setTargetSlotMinutes] =
    useState(null);

  /* -------------------------------------------------------
     CONVERSÃO TEMPO <-> POSIÇÃO
  ------------------------------------------------------- */
  const getVisualY = useCallback(
    (minute) => {
      let offset = minute - TIMELINE_START_MINUTES;

      if (offset < 0) {
        offset += DAY_MINUTES;
      }

      return offset * ppm + VERTICAL_PADDING;
    },
    [ppm]
  );

  const getMinuteFromY = useCallback(
    (y) => {
      const rawY = y - VERTICAL_PADDING;
      const offset = rawY / ppm;

      let realMinute =
        (offset + TIMELINE_START_MINUTES) % DAY_MINUTES;

      if (realMinute < 0) {
        realMinute += DAY_MINUTES;
      }

      return realMinute;
    },
    [ppm]
  );

  const canvasHeight = useMemo(() => {
    return DAY_MINUTES * ppm + VERTICAL_PADDING * 2;
  }, [ppm]);

  /* -------------------------------------------------------
     AGORA
  ------------------------------------------------------- */
  const now = new Date();

  const currentAbsMins =
    now.getHours() * 60 + now.getMinutes();

  const nowTop = getVisualY(currentAbsMins);

  /* -------------------------------------------------------
     SCROLL INICIAL
  ------------------------------------------------------- */
  const initialScrollDone = useRef(false);

  useEffect(() => {
    if (
      viewportHeight > 0 &&
      !initialScrollDone.current &&
      scrollRef.current
    ) {
      initialScrollDone.current = true;

      const targetY =
        nowTop - viewportHeight * 0.35;

      const maxScroll = Math.max(
        0,
        canvasHeight - viewportHeight
      );

      const y = clamp(targetY, 0, maxScroll);

      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y,
          animated: false,
        });
      });
    }
  }, [viewportHeight, nowTop, canvasHeight]);

  /* -------------------------------------------------------
     STORAGE
  ------------------------------------------------------- */
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const storedBlocks =
          await AsyncStorage.getItem(STORAGE_KEY);

        const storedTasks =
          await AsyncStorage.getItem(
            TASKS_STORAGE_KEY
          );

        let parsedBlocks = null;

        if (storedBlocks) {
          const parsed = JSON.parse(storedBlocks);

          if (
            Array.isArray(parsed) &&
            parsed.length > 0
          ) {
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
          const migratedTasks =
            parsedBlocks.flatMap((block) => {
              let currentMinute =
                block.startHour * 60;

              return (block.tasks || []).map(
                (task) => {
                  const startMinsPlanned =
                    task.startMinsPlanned ??
                    (task.timeOfDay
                      ? parseTimeToMinutes(
                        task.timeOfDay
                      )
                      : currentMinute);

                  currentMinute =
                    startMinsPlanned +
                    (task.timeMinutes || 30);

                  return {
                    ...task,
                    startMinsPlanned,
                    timeOfDay:
                      task.timeOfDay ||
                      formatTimeFromMinutes(
                        startMinsPlanned
                      ),
                  };
                }
              );
            });

          setTasks(migratedTasks);

          await AsyncStorage.setItem(
            TASKS_STORAGE_KEY,
            JSON.stringify(migratedTasks)
          );
        }
      } catch (error) {
        console.error(
          'Erro ao carregar dados:',
          error
        );
      }
    };

    loadStoredData();
  }, []);

  const saveTasks = async (newTasks) => {
    setTasks(newTasks);

    try {
      await AsyncStorage.setItem(
        TASKS_STORAGE_KEY,
        JSON.stringify(newTasks)
      );
    } catch (error) {
      console.error(
        'Erro ao guardar tarefas:',
        error
      );
    }
  };

  /* -------------------------------------------------------
     TAREFAS
  ------------------------------------------------------- */
  const handleDragEnd = (taskId, newMins) => {
    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? {
          ...t,
          startMinsPlanned: newMins,
          timeOfDay:
            formatTimeFromMinutes(newMins),
        }
        : t
    );

    saveTasks(updatedTasks);
  };

  const toggleTaskComplete = (taskId) => {
    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? {
          ...t,
          completed: !t.completed,
        }
        : t
    );

    saveTasks(updatedTasks);
  };

  const handleSaveTask = (
    blockId,
    title,
    durationMinutes
  ) => {
    const duration = Math.max(
      1,
      Number(durationMinutes) || 30
    );

    const startMins =
      targetSlotMinutes ?? 7 * 60;

    const newTask = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      timeMinutes: duration,
      completed: false,
      repeat: 'Nunca',
      notes: '',
      startMinsPlanned: startMins,
      timeOfDay:
        formatTimeFromMinutes(startMins),
    };

    saveTasks([...tasks, newTask]);

    setTargetSlotMinutes(null);
    setModalVisible(false);
  };

  const handleEditTask = (
    taskId,
    targetBlockId,
    changes
  ) => {
    const startMins =
      parseTimeToMinutes(changes.timeOfDay);

    const duration = Math.max(
      1,
      Number(changes.timeMinutes) || 30
    );

    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? {
          ...t,
          ...changes,
          timeMinutes: duration,
          startMinsPlanned: startMins,
          timeOfDay:
            changes.timeOfDay ||
            formatTimeFromMinutes(
              startMins
            ),
        }
        : t
    );

    saveTasks(updatedTasks);

    setEditingTask(null);
  };

  const handleDeleteTask = (taskId) => {
    saveTasks(
      tasks.filter((t) => t.id !== taskId)
    );

    setEditingTask(null);
  };

  /* -------------------------------------------------------
     ZOOM
  ------------------------------------------------------- */
  const minPpm =
    (viewportHeight -
      VERTICAL_PADDING * 2) /
    DAY_MINUTES;

  const ppmRef = useRef(ppm);

  useEffect(() => {
    ppmRef.current = ppm;
  }, [ppm]);

  const minPpmRef = useRef(minPpm);

  useEffect(() => {
    minPpmRef.current = minPpm;
  }, [minPpm]);

  const pinchStartDistance = useRef(0);
  const initialPpm = useRef(1);

  const zoomResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture:
          (evt) =>
            evt.nativeEvent.touches.length === 2,

        onMoveShouldSetPanResponderCapture:
          (evt) =>
            evt.nativeEvent.touches.length === 2,

        onPanResponderGrant: (evt) => {
          if (
            evt.nativeEvent.touches.length === 2
          ) {
            pinchStartDistance.current =
              getPinchDistance(
                evt.nativeEvent.touches
              );

            initialPpm.current =
              ppmRef.current;
          }
        },

        onPanResponderMove: (evt) => {
          if (
            evt.nativeEvent.touches.length ===
            2 &&
            pinchStartDistance.current > 0
          ) {
            const currentDistance =
              getPinchDistance(
                evt.nativeEvent.touches
              );

            const scale =
              currentDistance /
              pinchStartDistance.current;

            setPpm(
              clamp(
                initialPpm.current * scale,
                minPpmRef.current,
                MAX_PPM
              )
            );
          }
        },

        onPanResponderRelease: () => {
          pinchStartDistance.current = 0;
        },

        onPanResponderTerminate: () => {
          pinchStartDistance.current = 0;
        },
      }),
    []
  );

  const isDense = ppm < 0.7;

  const totalCompletedTasks =
    tasks.filter((t) => t.completed).length;

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'left', 'right']}
    >
      <Header
        completedTasks={totalCompletedTasks}
        totalTasks={tasks.length}
      />

      <View
        {...zoomResponder.panHandlers}
        style={styles.timelineViewport}
        onLayout={(e) =>
          setViewportHeight(
            e.nativeEvent.layout.height
          )
        }
      >
        <ScrollView
          ref={scrollRef}
          scrollEnabled={!isDragging}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            height: canvasHeight,
          }}
        >
          <View
            style={[
              styles.timelineCanvas,
              {
                height: canvasHeight,
              },
            ]}
          >
            {/* ESPINHA DORSAL */}
            <View style={styles.railContainer}>
              {VERTICAL_SEGMENTS.map((segment, index) => {
                let offsetHour = segment.start - 7;

                if (offsetHour < 0) {
                  offsetHour += 24;
                }

                return (
                  <View
                    key={index}
                    style={[
                      styles.railSegment,
                      {
                        top:
                          offsetHour * 60 * ppm +
                          VERTICAL_PADDING,
                        height:
                          segment.duration * 60 * ppm,
                        backgroundColor: segment.color,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* MARCADORES DE HORA E MEIA-HORA */}
            {Array.from({
              length: 49,
            }).map((_, i) => {
              const offsetMinutes = i * 30;

              const top =
                offsetMinutes * ppm +
                VERTICAL_PADDING;

              const isHalfHour =
                i % 2 !== 0;

              const displayHour =
                (Math.floor(i / 2) + 7) %
                24;



              const hideText =
                isHalfHour

              return (
                <View
                  key={i}
                  style={[
                    styles.hourRow,
                    {
                      top: top - 8,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.hourText,
                      isDense &&
                      styles.hourTextOverview,
                    ]}
                  >
                    {!hideText
                      ? String(
                        displayHour
                      ).padStart(2, '0')
                      : ''}
                  </Text>

                  {!isHalfHour && (
                    <View
                      style={[
                        styles.hourDot,
                        {
                          backgroundColor:
                            i === 48
                              ? '#7F9CF5'
                              : getRailColor(displayHour),
                        },
                      ]}
                    />
                  )}

                  <View
                    style={[
                      styles.hourLine,

                      isHalfHour
                        ? styles.halfHourLine
                        : (isDense ||
                          hideText) &&
                        styles.hourLineOverview,
                    ]}
                  />
                </View>
              );
            })}

            {/* TAREFAS */}
            {tasks.map(
              (task, index) => (
                <TaskCardClean
                  key={task.id}
                  task={task}
                  ppm={ppm}
                  themeIndex={index}
                  onChangeStart={
                    handleDragEnd
                  }
                  onDragStateChange={
                    setIsDragging
                  }
                  onToggle={
                    toggleTaskComplete
                  }
                  onPress={(t) =>
                    setEditingTask(t)
                  }
                  getVisualY={
                    getVisualY
                  }
                  getMinuteFromY={
                    getMinuteFromY
                  }
                />
              )
            )}

            {/* LINHA AGORA */}
            <View
              pointerEvents="none"
              style={[
                styles.nowLine,
                {
                  top: nowTop,
                },
              ]}
            >
              <View
                style={styles.nowDot}
              />

              <Image
                source={require('../../assets/abelha.png')}
                style={
                  styles.nowBeeImage
                }
              />
            </View>
          </View>
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => {
            setTargetSlotMinutes(
              now.getHours() * 60
            );

            setModalVisible(true);
          }}
        >
          <Ionicons
            name="add"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <CreateTaskModal
        visible={modalVisible}
        onClose={() =>
          setModalVisible(false)
        }
        onSave={handleSaveTask}
        blocks={blocks}
      />

      <EditTaskModal
        visible={Boolean(editingTask)}
        onClose={() =>
          setEditingTask(null)
        }
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
    marginTop: 2,
  },

  timelineCanvas: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },

  /* -------------------------------------------------------
     HORAS
  ------------------------------------------------------- */
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

  /* -------------------------------------------------------
     ESPINHA DORSAL
  ------------------------------------------------------- */
  railContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: AXIS_WIDTH - 0.5,
    width: 1,
    zIndex: 2,
  },

  railSegment: {
    position: 'absolute',
    left: 0,
    width: 1,
  },

  hourDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: -2,
    marginRight: -2,
    zIndex: 3,
  },

  /* -------------------------------------------------------
     GRELHA
  ------------------------------------------------------- */
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F5F2EF',
  },

  hourLineOverview: {
    backgroundColor: '#FBF9F7',
  },

  halfHourLine: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#FAF8F6',
    borderStyle: 'dashed',
  },

  /* -------------------------------------------------------
     AGORA
  ------------------------------------------------------- */
  nowLine: {
    position: 'absolute',
    left: AXIS_WIDTH,
    right: 10,

    height: 1.5,

    zIndex: 90,

    backgroundColor: '#ECC94B',
  },

  nowDot: {
    position: 'absolute',

    left: -3,
    top: -2.5,

    width: 6.5,
    height: 6.5,

    borderRadius: 4,

    backgroundColor: '#ECC94B',
  },

  nowBeeImage: {
    position: 'absolute',

    right: -6,
    top: -10,

    width: 20,
    height: 20,

    resizeMode: 'contain',

    transform: [
      {
        rotate: '90deg',
      },
    ],
  },

  /* -------------------------------------------------------
     FAB
  ------------------------------------------------------- */
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

    shadowOffset: {
      width: 0,
      height: 3,
    },

    shadowOpacity: 0.25,
    shadowRadius: 4.5,

    elevation: 6,
  },
});