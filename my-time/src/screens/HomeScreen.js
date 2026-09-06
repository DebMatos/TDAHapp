import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Image,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import TaskDetailsModal from '../components/modals/TaskDetailsModal';
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

const TASK_CARD_LEFT = 56;
const TASK_CARD_RIGHT = 16;
const OVERLAP_GAP = 4;

const TIMELINE_START_MINUTES = 7 * 60;
const SNAP_MINUTES = 5;

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
  {
    start: 7,
    duration: 2,
    color: '#68D391',
  },
  {
    start: 9,
    duration: 3,
    color: '#F6E05E',
  },
  {
    start: 12,
    duration: 2,
    color: '#F6AD55',
  },
  {
    start: 14,
    duration: 4,
    color: '#FC8181',
  },
  {
    start: 18,
    duration: 5,
    color: '#B794F4',
  },
  {
    start: 23,
    duration: 8,
    color: '#7F9CF5',
  },
];

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */
const normalizeTaskDate = (value) => {
  if (!value) {
    return null;
  }

  // Já está no formato da BD/timeline
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Formato usado pelo TaskDetailsModal: DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');

    return `${year}-${month}-${day}`;
  }

  return value;
};

const formatTimeFromMinutes = (
  totalMinutes
) => {
  const normalized =
    ((totalMinutes % DAY_MINUTES) +
      DAY_MINUTES) %
    DAY_MINUTES;

  const hours =
    Math.floor(normalized / 60);

  const mins =
    normalized % 60;

  return `${String(hours).padStart(
    2,
    '0'
  )}:${String(mins).padStart(
    2,
    '0'
  )}`;
};

const parseTimeToMinutes = (
  timeStr
) => {
  if (
    !timeStr ||
    !timeStr.includes(':')
  ) {
    return 7 * 60;
  }

  const [h, m] =
    timeStr
      .split(':')
      .map(Number);

  return (
    (isNaN(h) ? 7 : h) *
      60 +
    (isNaN(m) ? 0 : m)
  );
};

const clamp = (
  value,
  min,
  max
) =>
  Math.max(
    min,
    Math.min(
      max,
      value
    )
  );

const snapMinutes = (
  minutes
) =>
  Math.round(
    minutes /
      SNAP_MINUTES
  ) *
  SNAP_MINUTES;

  const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const addDays = (date, amount) => {
  const next = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  next.setDate(next.getDate() + amount);

  return next;
};

const getPinchDistance = (
  touches
) => {
  const [t1, t2] =
    touches;

  const dx =
    t1.pageX -
    t2.pageX;

  const dy =
    t1.pageY -
    t2.pageY;

  return Math.sqrt(
    dx * dx +
      dy * dy
  );
};

/* -------------------------------------------------------
   ESTADO
------------------------------------------------------- */

const getTaskStatus = (
  task
) =>
  task.status ||
  (
    task.completed
      ? 'completed'
      : 'pending'
  );

/* -------------------------------------------------------
   OVERLAP
------------------------------------------------------- */

const getTaskTimelineInterval = (
  task
) => {
  const startMinute =
    task.startMinsPlanned ??
    parseTimeToMinutes(
      task.timeOfDay
    );

  let start =
    startMinute -
    TIMELINE_START_MINUTES;

  if (start < 0) {
    start +=
      DAY_MINUTES;
  }

  const duration =
    Math.max(
      1,
      Number(
        task.timeMinutes
      ) || 30
    );

  return {
    id: task.id,
    start,
    end:
      start +
      duration,
  };
};

const calculateOverlapColumns = (
  tasks
) => {
  const intervals =
    tasks
      .map(
        getTaskTimelineInterval
      )
      .sort(
        (a, b) => {
          if (
            a.start !==
            b.start
          ) {
            return (
              a.start -
              b.start
            );
          }

          return (
            b.end -
            a.end
          );
        }
      );

  const result =
    new Map();

  let group = [];
  let groupEnd = -1;

  const processGroup =
    () => {
      if (
        group.length ===
        0
      ) {
        return;
      }

      const active = [];
      const assignments = [];

      let maxColumns = 1;

      group.forEach(
        (event) => {
          for (
            let i =
              active.length -
              1;
            i >= 0;
            i--
          ) {
            if (
              active[i].end <=
              event.start
            ) {
              active.splice(
                i,
                1
              );
            }
          }

          const usedColumns =
            new Set(
              active.map(
                (item) =>
                  item.column
              )
            );

          let column = 0;

          while (
            usedColumns.has(
              column
            )
          ) {
            column += 1;
          }

          active.push({
            end: event.end,
            column,
          });

          assignments.push({
            id: event.id,
            column,
          });

          maxColumns =
            Math.max(
              maxColumns,
              active.length,
              column + 1
            );
        }
      );

      assignments.forEach(
        ({
          id,
          column,
        }) => {
          result.set(
            id,
            {
              column,
              columnCount:
                maxColumns,
            }
          );
        }
      );
    };

  intervals.forEach(
    (event) => {
      if (
        group.length >
          0 &&
        event.start >=
          groupEnd
      ) {
        processGroup();

        group = [];
        groupEnd = -1;
      }

      group.push(
        event
      );

      groupEnd =
        Math.max(
          groupEnd,
          event.end
        );
    }
  );

  processGroup();

  return result;
};

/* -------------------------------------------------------
   SCREEN
------------------------------------------------------- */

export default function TimelineScreen() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
const today = new Date();

const selectedDateKey = getDateKey(selectedDate);

const isViewingToday = isSameDay(
  selectedDate,
  today
);
  const scrollRef =
    useRef(null);

  const timelineViewportRef =
    useRef(null);

  const scrollYRef =
    useRef(0);

  const viewportWindowYRef =
    useRef(0);

  const tapStartRef =
    useRef(null);

  const touchMovedRef =
    useRef(false);

  const suppressTimelineCreateRef =
    useRef(false);

  const [
    detailsTask,
    setDetailsTask,
  ] = useState(null);

  const [
    detailsMode,
    setDetailsMode,
  ] = useState(
    'create'
  );

  const [
    viewportHeight,
    setViewportHeight,
  ] = useState(0);

  const [
    viewportWidth,
    setViewportWidth,
  ] = useState(0);

  const [
    isDragging,
    setIsDragging,
  ] = useState(false);

  const [
    ppm,
    setPpm,
  ] = useState(
    DEFAULT_PPM
  );

  const [
    tasks,
    setTasks,
  ] = useState([]);

  const visibleTasks = useMemo(() => {
  const todayKey = getDateKey(new Date());

  return tasks.filter((task) => {
    /*
     * Compatibilidade com tarefas antigas:
     * antes de existir suporte de datas,
     * todas pertenciam implicitamente a Hoje.
     */
    const taskDate =
      task.date || todayKey;

    return taskDate === selectedDateKey;
  });
}, [tasks, selectedDateKey]);

  const [
    blocks,
    setBlocks,
  ] = useState(
    INITIAL_TIMELINE_BLOCKS ||
      []
  );

  const [
    modalVisible,
    setModalVisible,
  ] = useState(false);

  const [
    editingTask,
    setEditingTask,
  ] = useState(null);

  const [
    targetSlotMinutes,
    setTargetSlotMinutes,
  ] = useState(null);

  const goToPreviousDay = () => {
  setSelectedDate((current) =>
    addDays(current, -1)
  );
};

const goToNextDay = () => {
  setSelectedDate((current) =>
    addDays(current, 1)
  );
};

const goToToday = () => {
  setSelectedDate(new Date());
};

  /* -------------------------------------------------------
     CONVERSÃO TEMPO <-> POSIÇÃO
  ------------------------------------------------------- */

  const getVisualY =
    useCallback(
      (minute) => {
        let offset =
          minute -
          TIMELINE_START_MINUTES;

        if (
          offset < 0
        ) {
          offset +=
            DAY_MINUTES;
        }

        return (
          offset * ppm +
          VERTICAL_PADDING
        );
      },
      [ppm]
    );

  const getMinuteFromY =
    useCallback(
      (y) => {
        const rawY =
          y -
          VERTICAL_PADDING;

        const offset =
          rawY /
          ppm;

        let realMinute =
          (
            offset +
            TIMELINE_START_MINUTES
          ) %
          DAY_MINUTES;

        if (
          realMinute < 0
        ) {
          realMinute +=
            DAY_MINUTES;
        }

        return realMinute;
      },
      [ppm]
    );

  const canvasHeight =
    useMemo(
      () =>
        DAY_MINUTES *
          ppm +
        VERTICAL_PADDING *
          2,
      [ppm]
    );

  /* -------------------------------------------------------
     OVERLAPS
  ------------------------------------------------------- */

const overlapColumns =
  useMemo(
    () =>
      calculateOverlapColumns(
        visibleTasks
      ),
    [visibleTasks]
  );

  const taskHorizontalLayouts =
    useMemo(() => {
      const layouts =
        new Map();

      const availableWidth =
        Math.max(
          0,
          viewportWidth -
            TASK_CARD_LEFT -
            TASK_CARD_RIGHT
        );

      visibleTasks.forEach(
        (task) => {
          const overlap =
            overlapColumns.get(
              task.id
            ) || {
              column: 0,
              columnCount: 1,
            };

          const {
            column,
            columnCount,
          } = overlap;

          if (
            columnCount <=
              1 ||
            availableWidth <=
              0
          ) {
            layouts.set(
              task.id,
              {
                left:
                  TASK_CARD_LEFT,
                right:
                  TASK_CARD_RIGHT,
              }
            );

            return;
          }

          const gaps =
            OVERLAP_GAP *
            (
              columnCount -
              1
            );

          const columnWidth =
            (
              availableWidth -
              gaps
            ) /
            columnCount;

          layouts.set(
            task.id,
            {
              left:
                TASK_CARD_LEFT +
                column *
                  (
                    columnWidth +
                    OVERLAP_GAP
                  ),

              width:
                columnWidth,

              right:
                undefined,
            }
          );
        }
      );

      return layouts;
    }, [
      visibleTasks,
      overlapColumns,
      viewportWidth,
    ]);

  /* -------------------------------------------------------
     AGORA
  ------------------------------------------------------- */

  const now =
    new Date();

  const currentAbsMins =
    now.getHours() *
      60 +
    now.getMinutes();

  const nowTop =
    getVisualY(
      currentAbsMins
    );

  /* -------------------------------------------------------
     SCROLL INICIAL
  ------------------------------------------------------- */

  const initialScrollDone =
    useRef(false);

  useEffect(() => {
    if (
      viewportHeight >
        0 &&
      !initialScrollDone.current &&
      scrollRef.current
    ) {
      initialScrollDone.current =
        true;

      const targetY =
        nowTop -
        viewportHeight *
          0.35;

      const maxScroll =
        Math.max(
          0,
          canvasHeight -
            viewportHeight
        );

      const y =
        clamp(
          targetY,
          0,
          maxScroll
        );

      scrollYRef.current =
        y;

      requestAnimationFrame(
        () => {
          scrollRef.current?.scrollTo(
            {
              y,
              animated:
                false,
            }
          );
        }
      );
    }
  }, [
    viewportHeight,
    nowTop,
    canvasHeight,
  ]);

  /* -------------------------------------------------------
     STORAGE
  ------------------------------------------------------- */

  useEffect(() => {
    const loadStoredData =
      async () => {
        try {
          const storedBlocks =
            await AsyncStorage.getItem(
              STORAGE_KEY
            );

          const storedTasks =
            await AsyncStorage.getItem(
              TASKS_STORAGE_KEY
            );

          let parsedBlocks =
            null;

          if (
            storedBlocks
          ) {
            const parsed =
              JSON.parse(
                storedBlocks
              );

            if (
              Array.isArray(
                parsed
              ) &&
              parsed.length >
                0
            ) {
              parsedBlocks =
                parsed;

              setBlocks(
                parsed
              );
            }
          }

          if (
            storedTasks
          ) {
            const parsed =
              JSON.parse(
                storedTasks
              );

            if (
              Array.isArray(
                parsed
              )
            ) {
              /*
               * Não fazemos uma migração
               * destrutiva aqui.
               *
               * getTaskStatus continua a
               * suportar tarefas antigas
               * que só tenham completed.
               */
              setTasks(
                parsed
              );

              return;
            }
          }

          if (
            parsedBlocks
          ) {
            const migratedTasks =
              parsedBlocks.flatMap(
                (block) => {
                  let currentMinute =
                    block.startHour *
                    60;

                  return (
                    block.tasks ||
                    []
                  ).map(
                    (task) => {
                      const startMinsPlanned =
                        task.startMinsPlanned ??
                        (
                          task.timeOfDay
                            ? parseTimeToMinutes(
                                task.timeOfDay
                              )
                            : currentMinute
                        );

                      currentMinute =
                        startMinsPlanned +
                        (
                          task.timeMinutes ||
                          30
                        );

                      return {
                        ...task,

                        status:
                          task.status ||
                          (
                            task.completed
                              ? 'completed'
                              : 'pending'
                          ),

                        completed:
                          task.status
                            ? task.status ===
                              'completed'
                            : Boolean(
                                task.completed
                              ),

                        startMinsPlanned,

                        timeOfDay:
                          task.timeOfDay ||
                          formatTimeFromMinutes(
                            startMinsPlanned
                          ),
                      };
                    }
                  );
                }
              );

            setTasks(
              migratedTasks
            );

            await AsyncStorage.setItem(
              TASKS_STORAGE_KEY,
              JSON.stringify(
                migratedTasks
              )
            );
          }
        } catch (
          error
        ) {
          console.error(
            'Erro ao carregar dados:',
            error
          );
        }
      };

    loadStoredData();
  }, []);

  const saveTasks =
    async (
      newTasks
    ) => {
      setTasks(
        newTasks
      );

      try {
        await AsyncStorage.setItem(
          TASKS_STORAGE_KEY,
          JSON.stringify(
            newTasks
          )
        );
      } catch (
        error
      ) {
        console.error(
          'Erro ao guardar tarefas:',
          error
        );
      }
    };

  /* -------------------------------------------------------
     TAREFAS
  ------------------------------------------------------- */

  const handleDragEnd = (
    taskId,
    newMins
  ) => {
    const updatedTasks =
      tasks.map(
        (task) =>
          task.id ===
          taskId
            ? {
                ...task,

                startMinsPlanned:
                  newMins,

                timeOfDay:
                  formatTimeFromMinutes(
                    newMins
                  ),
              }
            : task
      );

    saveTasks(
      updatedTasks
    );
  };

  /* -------------------------------------------------------
     CHECKBOX:
     pending <-> completed

     abandoned não muda pelo card
  ------------------------------------------------------- */

  const toggleTaskComplete = (
    taskId
  ) => {
    const updatedTasks =
      tasks.map(
        (task) => {
          if (
            task.id !==
            taskId
          ) {
            return task;
          }

          const currentStatus =
            getTaskStatus(
              task
            );

          /*
           * Uma tarefa abandonada só
           * muda de estado através dos
           * detalhes.
           */
          if (
            currentStatus ===
            'abandoned'
          ) {
            return task;
          }

          const nextStatus =
            currentStatus ===
            'completed'
              ? 'pending'
              : 'completed';

          return {
            ...task,

            status:
              nextStatus,

            completed:
              nextStatus ===
              'completed',
          };
        }
      );

    saveTasks(
      updatedTasks
    );
  };

  /* -------------------------------------------------------
     QUICK CREATE
  ------------------------------------------------------- */

  const handleSaveTask = ({
    title,
    description,
    duration,
    categoryId,
  }) => {
    const safeDuration =
      Math.max(
        1,
        Number(
          duration
        ) || 30
      );

    const startMins =
      targetSlotMinutes ??
      7 * 60;

    const newTask = {
      id: `task-${Date.now()}`,
  date: selectedDateKey,

      title:
        title.trim(),

      description:
        description?.trim() ||
        '',

      notes:
        description?.trim() ||
        '',

      timeMinutes:
        safeDuration,

      status:
        'pending',

      completed:
        false,

      repeat:
        'Nunca',

      categoryId,

      startMinsPlanned:
        startMins,

      timeOfDay:
        formatTimeFromMinutes(
          startMins
        ),
    };

    saveTasks([
      ...tasks,
      newTask,
    ]);

    setTargetSlotMinutes(
      null
    );

    setModalVisible(
      false
    );
  };

  /* -------------------------------------------------------
     EDIT ANTIGO
  ------------------------------------------------------- */

  const handleEditTask = (
    taskId,
    targetBlockId,
    changes
  ) => {
    const startMins =
      parseTimeToMinutes(
        changes.timeOfDay
      );

    const duration =
      Math.max(
        1,
        Number(
          changes.timeMinutes
        ) || 30
      );

    const updatedTasks =
      tasks.map(
        (task) =>
          task.id ===
          taskId
            ? {
                ...task,
                ...changes,

                status:
                  changes.status ||
                  getTaskStatus(
                    task
                  ),

                completed:
                  (
                    changes.status ||
                    getTaskStatus(
                      task
                    )
                  ) ===
                  'completed',

                timeMinutes:
                  duration,

                startMinsPlanned:
                  startMins,

                timeOfDay:
                  changes.timeOfDay ||
                  formatTimeFromMinutes(
                    startMins
                  ),
              }
            : task
      );

    saveTasks(
      updatedTasks
    );

    setEditingTask(
      null
    );
  };

  const handleDeleteTask = (
    taskId
  ) => {
    saveTasks(
      tasks.filter(
        (task) =>
          task.id !==
          taskId
      )
    );

    setEditingTask(
      null
    );
  };

  /* -------------------------------------------------------
     TOQUE NA TIMELINE -> CRIAR
  ------------------------------------------------------- */

  const handleTimelineTouchStart = (
    event
  ) => {
    const touches =
      event.nativeEvent
        .touches;

    if (
      !touches ||
      touches.length !==
        1
    ) {
      tapStartRef.current =
        null;

      return;
    }

    const touch =
      touches[0];

    tapStartRef.current =
      {
        pageX:
          touch.pageX,

        pageY:
          touch.pageY,

        time:
          Date.now(),
      };

    touchMovedRef.current =
      false;

    suppressTimelineCreateRef.current =
      false;
  };

  const handleTimelineTouchMove = (
    event
  ) => {
    if (
      !tapStartRef.current
    ) {
      return;
    }

    const touches =
      event.nativeEvent
        .touches;

    if (
      !touches ||
      touches.length !==
        1
    ) {
      touchMovedRef.current =
        true;

      return;
    }

    const touch =
      touches[0];

    const dx =
      touch.pageX -
      tapStartRef.current
        .pageX;

    const dy =
      touch.pageY -
      tapStartRef.current
        .pageY;

    const distance =
      Math.sqrt(
        dx * dx +
          dy * dy
      );

    if (
      distance > 8
    ) {
      touchMovedRef.current =
        true;
    }
  };

  const handleTimelineTouchEnd = (
    event
  ) => {
    const start =
      tapStartRef.current;

    tapStartRef.current =
      null;

    if (
      !start ||
      touchMovedRef.current ||
      isDragging ||
      pinchStartDistance.current >
        0
    ) {
      return;
    }

    const touch =
      event.nativeEvent
        .changedTouches?.[0];

    if (!touch) {
      return;
    }

    const elapsed =
      Date.now() -
      start.time;

    if (
      elapsed > 300
    ) {
      return;
    }

    const viewportY =
      touch.pageY -
      viewportWindowYRef.current;

    if (
      viewportY < 0 ||
      viewportY >
        viewportHeight
    ) {
      return;
    }

    const contentY =
      scrollYRef.current +
      viewportY;

    const rawMinute =
      getMinuteFromY(
        contentY
      );

    let snappedMinute =
      snapMinutes(
        rawMinute
      );

    snappedMinute =
      (
        (
          snappedMinute %
          DAY_MINUTES
        ) +
        DAY_MINUTES
      ) %
      DAY_MINUTES;

    requestAnimationFrame(
      () => {
        if (
          suppressTimelineCreateRef.current
        ) {
          suppressTimelineCreateRef.current =
            false;

          return;
        }

        setTargetSlotMinutes(
          snappedMinute
        );

        setModalVisible(
          true
        );
      }
    );
  };

  /* -------------------------------------------------------
     ZOOM
  ------------------------------------------------------- */

  const minPpm =
    (
      viewportHeight -
      VERTICAL_PADDING *
        2
    ) /
    DAY_MINUTES;

  const ppmRef =
    useRef(ppm);

  useEffect(() => {
    ppmRef.current =
      ppm;
  }, [ppm]);

  const minPpmRef =
    useRef(minPpm);

  useEffect(() => {
    minPpmRef.current =
      minPpm;
  }, [minPpm]);

  const pinchStartDistance =
    useRef(0);

  const initialPpm =
    useRef(1);

  const zoomResponder =
    useMemo(
      () =>
        PanResponder.create(
          {
            onStartShouldSetPanResponderCapture:
              (evt) =>
                evt.nativeEvent
                  .touches
                  .length ===
                2,

            onMoveShouldSetPanResponderCapture:
              (evt) =>
                evt.nativeEvent
                  .touches
                  .length ===
                2,

            onPanResponderGrant:
              (evt) => {
                if (
                  evt.nativeEvent
                    .touches
                    .length ===
                  2
                ) {
                  pinchStartDistance.current =
                    getPinchDistance(
                      evt.nativeEvent
                        .touches
                    );

                  initialPpm.current =
                    ppmRef.current;

                  tapStartRef.current =
                    null;
                }
              },

            onPanResponderMove:
              (evt) => {
                if (
                  evt.nativeEvent
                    .touches
                    .length ===
                    2 &&
                  pinchStartDistance.current >
                    0
                ) {
                  const currentDistance =
                    getPinchDistance(
                      evt.nativeEvent
                        .touches
                    );

                  const scale =
                    currentDistance /
                    pinchStartDistance.current;

                  setPpm(
                    clamp(
                      initialPpm.current *
                        scale,

                      minPpmRef.current,

                      MAX_PPM
                    )
                  );
                }
              },

            onPanResponderRelease:
              () => {
                pinchStartDistance.current =
                  0;
              },

            onPanResponderTerminate:
              () => {
                pinchStartDistance.current =
                  0;
              },
          }
        ),
      []
    );

  const isDense =
    ppm < 0.7;

  /* -------------------------------------------------------
     CONTADOR
  ------------------------------------------------------- */

const totalCompletedTasks =
  visibleTasks.filter(
    (task) =>
      getTaskStatus(task) === 'completed'
  ).length;
  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <SafeAreaView
      style={
        styles.safe
      }
      edges={[
        'top',
        'left',
        'right',
      ]}
    >
  <Header
  selectedDate={selectedDate}
  onPreviousDay={goToPreviousDay}
  onNextDay={goToNextDay}
  onDatePress={() => {
    // Depois abrimos o calendário/date picker
  }}
  completedTasks={totalCompletedTasks}
  totalTasks={visibleTasks.length}
/>

      <View
        ref={
          timelineViewportRef
        }
        {...zoomResponder.panHandlers}
        style={
          styles.timelineViewport
        }
        onTouchStart={
          handleTimelineTouchStart
        }
        onTouchMove={
          handleTimelineTouchMove
        }
        onTouchEnd={
          handleTimelineTouchEnd
        }
        onLayout={(
          event
        ) => {
          setViewportHeight(
            event
              .nativeEvent
              .layout
              .height
          );

          setViewportWidth(
            event
              .nativeEvent
              .layout
              .width
          );

          requestAnimationFrame(
            () => {
              timelineViewportRef.current?.measureInWindow(
                (
                  x,
                  y
                ) => {
                  viewportWindowYRef.current =
                    y;
                }
              );
            }
          );
        }}
      >
        <ScrollView
          ref={
            scrollRef
          }
          scrollEnabled={
            !isDragging
          }
          showsVerticalScrollIndicator={
            false
          }
          scrollEventThrottle={
            16
          }
          onScroll={(
            event
          ) => {
            scrollYRef.current =
              event
                .nativeEvent
                .contentOffset
                .y;
          }}
          onScrollBeginDrag={() => {
            touchMovedRef.current =
              true;
          }}
          contentContainerStyle={{
            height:
              canvasHeight,
          }}
        >
          <View
            style={[
              styles.timelineCanvas,
              {
                height:
                  canvasHeight,
              },
            ]}
          >
            {/* ESPINHA DORSAL */}

            <View
              pointerEvents="none"
              style={
                styles.railContainer
              }
            >
              {VERTICAL_SEGMENTS.map(
                (
                  segment,
                  index
                ) => {
                  let offsetHour =
                    segment.start -
                    7;

                  if (
                    offsetHour <
                    0
                  ) {
                    offsetHour +=
                      24;
                  }

                  return (
                    <View
                      key={
                        index
                      }
                      style={[
                        styles.railSegment,
                        {
                          top:
                            offsetHour *
                              60 *
                              ppm +
                            VERTICAL_PADDING,

                          height:
                            segment.duration *
                            60 *
                            ppm,

                          backgroundColor:
                            segment.color,
                        },
                      ]}
                    />
                  );
                }
              )}
            </View>

            {/* HORAS / MEIAS HORAS */}

            {Array.from({
              length: 49,
            }).map(
              (
                _,
                i
              ) => {
                const offsetMinutes =
                  i * 30;

                const top =
                  offsetMinutes *
                    ppm +
                  VERTICAL_PADDING;

                const isHalfHour =
                  i % 2 !==
                  0;

                const displayHour =
                  (
                    Math.floor(
                      i / 2
                    ) +
                    7
                  ) %
                  24;

                const hideText =
                  isHalfHour;

                return (
                  <View
                    pointerEvents="none"
                    key={
                      i
                    }
                    style={[
                      styles.hourRow,
                      {
                        top:
                          top -
                          8,
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
                          ).padStart(
                            2,
                            '0'
                          )
                        : ''}
                    </Text>

                    {!isHalfHour && (
                      <View
                        style={[
                          styles.hourDot,
                          {
                            backgroundColor:
                              i ===
                              48
                                ? '#7F9CF5'
                                : getRailColor(
                                    displayHour
                                  ),
                          },
                        ]}
                      />
                    )}

                    <View
                      style={[
                        styles.hourLine,

                        isHalfHour
                          ? styles.halfHourLine
                          : (
                              isDense ||
                              hideText
                            ) &&
                            styles.hourLineOverview,
                      ]}
                    />
                  </View>
                );
              }
            )}

            {/* TAREFAS */}

            {visibleTasks.map(
              (
                task,
                index
              ) => (
                <TaskCardClean
                  key={
                    task.id
                  }
                  task={
                    task
                  }
                  ppm={
                    ppm
                  }
                  themeIndex={
                    index
                  }
                  layoutStyle={
                    taskHorizontalLayouts.get(
                      task.id
                    )
                  }
                  onChangeStart={
                    handleDragEnd
                  }
                  onDragStateChange={
                    setIsDragging
                  }
                  onToggle={
                    toggleTaskComplete
                  }
                  onPress={(
                    selectedTask
                  ) => {
                    suppressTimelineCreateRef.current =
                      true;

                    setDetailsMode(
                      'edit'
                    );

                    setDetailsTask(
                      selectedTask
                    );
                  }}
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

          {/* LINHA AGORA — apenas no dia atual */}

{isViewingToday && (
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
      style={styles.nowBeeImage}
    />
  </View>
)}
          </View>
        </ScrollView>
      </View>

      {/* QUICK CREATE */}

      <CreateTaskModal
        visible={
          modalVisible
        }
        initialMinutes={
          targetSlotMinutes
        }
        onClose={() => {
          setModalVisible(
            false
          );

          setTargetSlotMinutes(
            null
          );
        }}
        onSave={
          handleSaveTask
        }
        onMoreOptions={(
          draft
        ) => {
          setDetailsMode(
            'create'
          );

          setDetailsTask(
            draft
          );

          setModalVisible(
            false
          );
        }}
      />

      {/* DETAILS / EDIT */}

      <TaskDetailsModal
        visible={Boolean(
          detailsTask
        )}
        mode={
          detailsMode
        }
        initialValues={
          detailsTask
        }
        onClose={() => {
          setDetailsTask(
            null
          );

          if (
            detailsMode ===
            'create'
          ) {
            setTargetSlotMinutes(
              null
            );
          }
        }}
        onSave={(
          changes
        ) => {
          if (
            detailsMode ===
            'create'
          ) {
            const newTask = {
              id: `task-${Date.now()}`,
  date:
    changes.date ||
    selectedDateKey,
              ...changes,

              status:
                changes.status ||
                'pending',

              completed:
                (
                  changes.status ||
                  'pending'
                ) ===
                'completed',
            };

            saveTasks([
              ...tasks,
              newTask,
            ]);
          } else {
            const updated =
              tasks.map(
                (task) =>
                  task.id ===
                  detailsTask.id
                    ? {
                        ...task,
                        ...changes,

                        status:
                          changes.status ||
                          getTaskStatus(
                            task
                          ),

                        completed:
                          (
                            changes.status ||
                            getTaskStatus(
                              task
                            )
                          ) ===
                          'completed',
                      }
                    : task
              );

            saveTasks(
              updated
            );
          }

          setDetailsTask(
            null
          );

          setEditingTask(
            null
          );

          setTargetSlotMinutes(
            null
          );
        }}
        onDelete={
          detailsMode ===
          'edit'
            ? () => {
                saveTasks(
                  tasks.filter(
                    (
                      task
                    ) =>
                      task.id !==
                      detailsTask.id
                  )
                );

                setDetailsTask(
                  null
                );

                setEditingTask(
                  null
                );
              }
            : undefined
        }
      />

      {/* MODAL ANTIGO — AINDA MANTIDO POR AGORA */}

      <EditTaskModal
        visible={Boolean(
          editingTask
        )}
        onClose={() =>
          setEditingTask(
            null
          )
        }
        onSave={
          handleEditTask
        }
        onDelete={
          handleDeleteTask
        }
        task={
          editingTask
        }
        blocks={
          blocks
        }
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,

      backgroundColor:
        '#FFFFFF',
    },

    timelineViewport: {
      flex: 1,

      position:
        'relative',

      marginTop: 2,
    },

    timelineCanvas: {
      position:
        'relative',

      backgroundColor:
        '#FFFFFF',
    },

    /* -------------------------------------------------------
       HORAS
    ------------------------------------------------------- */

    hourRow: {
      position:
        'absolute',

      left: 0,
      right: 0,

      height: 16,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    hourText: {
      width:
        AXIS_WIDTH,

      paddingRight:
        10,

      textAlign:
        'right',

      fontSize: 12,

      fontWeight:
        '500',

      color:
        '#9C948D',
    },

    hourTextOverview: {
      fontSize: 9,

      color:
        '#C7BFB9',
    },

    /* -------------------------------------------------------
       ESPINHA DORSAL
    ------------------------------------------------------- */

    railContainer: {
      position:
        'absolute',

      top: 0,
      bottom: 0,

      left:
        AXIS_WIDTH -
        0.5,

      width: 1,

      zIndex: 2,
    },

    railSegment: {
      position:
        'absolute',

      left: 0,

      width: 1,
    },

    hourDot: {
      width: 4,
      height: 4,

      borderRadius:
        2,

      marginLeft:
        -2,

      marginRight:
        -2,

      zIndex: 3,
    },

    /* -------------------------------------------------------
       GRELHA
    ------------------------------------------------------- */

    hourLine: {
      flex: 1,

      height: 1,

      backgroundColor:
        '#F5F2EF',
    },

    hourLineOverview: {
      backgroundColor:
        '#FBF9F7',
    },

    halfHourLine: {
      backgroundColor:
        'transparent',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#FAF8F6',

      borderStyle:
        'dashed',
    },

    /* -------------------------------------------------------
       AGORA
    ------------------------------------------------------- */

    nowLine: {
      position:
        'absolute',

      left:
        AXIS_WIDTH,

      right: 10,

      height: 1.5,

      zIndex: 90,

      backgroundColor:
        '#ECC94B',
    },

    nowDot: {
      position:
        'absolute',

      left: -3,

      top: -2.5,

      width: 6.5,

      height: 6.5,

      borderRadius:
        4,

      backgroundColor:
        '#ECC94B',
    },

    nowBeeImage: {
      position:
        'absolute',

      right: -6,

      top: -10,

      width: 20,

      height: 20,

      resizeMode:
        'contain',

      transform: [
        {
          rotate:
            '90deg',
        },
      ],
    },
  });