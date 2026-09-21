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
  Alert,
} from 'react-native';
import * as taskService from
  '../services/taskService';
import { SafeAreaView } from 'react-native-safe-area-context';

import TaskDetailsModal from '../components/modals/TaskDetailsModal';
import TaskCardClean from '../components/TaskCardClean';
import Header from '../components/Header';
import CreateTaskModal from '../components/modals/CreateTaskModal';
import colors from '../theme/colors';

import {
  loadTasks as loadStoredTasks,
} from '../data/taskRepository';
import { supabase } from '../lib/supabase';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(
    true
  );
}


/* -------------------------------------------------------
   TIMELINE
------------------------------------------------------- */

const DAY_MINUTES =
  24 * 60;

const MAX_PPM =
  1.75;

const DEFAULT_PPM =
  1.25;

const VERTICAL_PADDING =
  20;

const AXIS_WIDTH =
  45;

const TASK_CARD_LEFT =
  56;

const TASK_CARD_RIGHT =
  22;

const OVERLAP_GAP =
  4;

const TIMELINE_START_MINUTES =
  7 * 60;

const SNAP_MINUTES =
  5;

/* -------------------------------------------------------
   CORES DA ESPINHA DORSAL
------------------------------------------------------- */

const getRailColor = (
  hour
) => {
  if (
    hour >= 7 &&
    hour < 9
  ) {
    return '#68D391';
  }

  if (
    hour >= 9 &&
    hour < 12
  ) {
    return '#F6E05E';
  }

  if (
    hour >= 12 &&
    hour < 14
  ) {
    return '#F6AD55';
  }

  if (
    hour >= 14 &&
    hour < 18
  ) {
    return '#FC8181';
  }

  if (
    hour >= 18 &&
    hour < 23
  ) {
    return '#B794F4';
  }

  return '#7F9CF5';
};

const VERTICAL_SEGMENTS = [
  { start: 7,  duration: 2, color: '#88C096' }, // Manhã cedo (Verde suave)
  { start: 9,  duration: 3, color: '#E2C268' }, // Manhã (Dourado/Amarelo suave)
  { start: 12, duration: 2, color: '#C86D51' }, // Almoço (O teu Tijolo/Terracota)
  { start: 14, duration: 4, color: '#D28873' }, // Tarde (Terracota suave)
  { start: 18, duration: 5, color: '#9E8BB3' }, // Fim de tarde / Noite (Crepúsculo)
  { start: 23, duration: 8, color: '#798CAE' }, // Madrugada (Azul noturno lavado)
];

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

const formatTimeFromMinutes = (
  totalMinutes
) => {
  const normalized =
    (
      (
        totalMinutes %
        DAY_MINUTES
      ) +
      DAY_MINUTES
    ) %
    DAY_MINUTES;

  const hours =
    Math.floor(
      normalized /
      60
    );

  const mins =
    normalized %
    60;

  return `${String(
    hours
  ).padStart(
    2,
    '0'
  )}:${String(
    mins
  ).padStart(
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

  const [
    h,
    m,
  ] =
    timeStr
      .split(':')
      .map(Number);

  return (
    (
      Number.isNaN(h)
        ? 7
        : h
    ) *
    60 +
    (
      Number.isNaN(m)
        ? 0
        : m
    )
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

const getDateKey = (
  date
) => {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
      1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
};

const isSameDay = (
  a,
  b
) =>
  a.getFullYear() ===
  b.getFullYear() &&
  a.getMonth() ===
  b.getMonth() &&
  a.getDate() ===
  b.getDate();

const addDays = (
  date,
  amount
) => {
  const next =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

  next.setDate(
    next.getDate() +
    amount
  );

  return next;
};

const getPinchDistance = (
  touches
) => {
  const [
    t1,
    t2,
  ] =
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
   OVERLAP
------------------------------------------------------- */


const getTaskTimelineInterval = (
  task
) => {
  const startMinute =
    parseTimeToMinutes(
      task.startTime
    );

  let start =
    startMinute -
    TIMELINE_START_MINUTES;

  if (
    start < 0
  ) {
    start +=
      DAY_MINUTES;
  }

  const duration =
    Math.max(
      1,
      Number(
        task.durationMinutes
      ) || 30
    );

  return {
    id:
      task.id,

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
        (
          a,
          b
        ) => {
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

  let group =
    [];

  let groupEnd =
    -1;

  const processGroup =
    () => {
      if (
        group.length ===
        0
      ) {
        return;
      }

      const active =
        [];

      const assignments =
        [];

      let maxColumns =
        1;

      group.forEach(
        (
          event
        ) => {
          for (
            let i =
              active.length -
              1;
            i >= 0;
            i--
          ) {
            if (
              active[i]
                .end <=
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
                (
                  item
                ) =>
                  item.column
              )
            );

          let column =
            0;

          while (
            usedColumns.has(
              column
            )
          ) {
            column +=
              1;
          }

          active.push({
            end:
              event.end,

            column,
          });

          assignments.push({
            id:
              event.id,

            column,
          });

          maxColumns =
            Math.max(
              maxColumns,
              active.length,
              column +
              1
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
    (
      event
    ) => {
      if (
        group.length >
        0 &&
        event.start >=
        groupEnd
      ) {
        processGroup();

        group =
          [];

        groupEnd =
          -1;
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
  const handleMenuPress = () => {
    Alert.alert(
      'Terminar sessão',
      'Queres terminar sessão nesta app?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Terminar sessão',
          style: 'destructive',
          onPress: async () => {
            const { error } =
              await supabase.auth.signOut();

            if (error) {
              Alert.alert(
                'Não foi possível terminar sessão',
                error.message
              );
            }
          },
        },
      ]
    );
  };
  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState(
      () =>
        new Date()
    );

  const today =
    new Date();

  const selectedDateKey =
    getDateKey(
      selectedDate
    );

  const isViewingToday =
    isSameDay(
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
  ] =
    useState(null);

  const [
    detailsMode,
    setDetailsMode,
  ] =
    useState(
      'create'
    );

  const [
    viewportHeight,
    setViewportHeight,
  ] =
    useState(0);

  const [
    viewportWidth,
    setViewportWidth,
  ] =
    useState(0);

  const [
    isDragging,
    setIsDragging,
  ] =
    useState(false);

  const [
    ppm,
    setPpm,
  ] =
    useState(
      DEFAULT_PPM
    );

  const [
    tasks,
    setTasks,
  ] =
    useState([]);

  const visibleTasks =
    useMemo(
      () => {
        const todayKey =
          getDateKey(
            new Date()
          );

        return tasks.filter(
          (
            task
          ) => {
            const taskDate =
              task.date ||
              todayKey;

            return (
              taskDate ===
              selectedDateKey
            );
          }
        );
      },
      [
        tasks,
        selectedDateKey,
      ]
    );


  const [
    modalVisible,
    setModalVisible,
  ] =
    useState(false);


  const [
    targetSlotMinutes,
    setTargetSlotMinutes,
  ] =
    useState(null);

  const goToPreviousDay =
    () => {
      setSelectedDate(
        (
          current
        ) =>
          addDays(
            current,
            -1
          )
      );
    };

  const goToNextDay =
    () => {
      setSelectedDate(
        (
          current
        ) =>
          addDays(
            current,
            1
          )
      );
    };

  /* -------------------------------------------------------
     CONVERSÃO TEMPO <-> POSIÇÃO
  ------------------------------------------------------- */

  const getVisualY =
    useCallback(
      (
        minute
      ) => {
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
          offset *
          ppm +
          VERTICAL_PADDING
        );
      },
      [
        ppm,
      ]
    );

  const getMinuteFromY =
    useCallback(
      (
        y
      ) => {
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
          realMinute <
          0
        ) {
          realMinute +=
            DAY_MINUTES;
        }

        return realMinute;
      },
      [
        ppm,
      ]
    );

  const canvasHeight =
    useMemo(
      () =>
        DAY_MINUTES *
        ppm +
        VERTICAL_PADDING *
        2,
      [
        ppm,
      ]
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
      [
        visibleTasks,
      ]
    );

  const taskHorizontalLayouts =
    useMemo(
      () => {
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
          (
            task
          ) => {
            const overlap =
              overlapColumns.get(
                task.id
              ) || {
                column:
                  0,

                columnCount:
                  1,
              };

            const {
              column,
              columnCount,
            } =
              overlap;

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
      },
      [
        visibleTasks,
        overlapColumns,
        viewportWidth,
      ]
    );

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

  useEffect(
    () => {
      if (
        viewportHeight >
        0 &&
        !initialScrollDone
          .current &&
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
    },
    [
      viewportHeight,
      nowTop,
      canvasHeight,
    ]
  );

  /* -------------------------------------------------------
     STORAGE
  ------------------------------------------------------- */

  useEffect(() => {
    const loadStoredData = async () => {
      const canonicalTasks =
        await loadStoredTasks();

      setTasks(canonicalTasks);
    };

    loadStoredData();
  }, []);
  /* -------------------------------------------------------
     DRAG
  ------------------------------------------------------- */

  const handleDragEnd = async (
    taskId,
    newMins
  ) => {
    const savedTasks =
      await taskService.moveTask({
        tasks,

        taskId,

        schedule: {
          startTime:
            formatTimeFromMinutes(
              newMins
            ),
        },
      });

    setTasks(savedTasks);
  };

  /* -------------------------------------------------------
     CHECKBOX
  ------------------------------------------------------- */

  const toggleTaskComplete = async (
    taskId
  ) => {
    const savedTasks =
      await taskService.toggleCompletion(
        taskId,
        tasks
      );

    setTasks(savedTasks);
  };
  /* -------------------------------------------------------
     QUICK CREATE
  ------------------------------------------------------- */

  const handleSaveTask = async ({
    title,
    notes,
    durationMinutes,
    categoryId,
  }) => {
    const startMins =
      targetSlotMinutes ??
      7 * 60;

    const savedTasks =
      await taskService.createTask(
        {
          title,

          notes,

          categoryId:
            categoryId || 'inbox',

          date: selectedDateKey,

          startTime:
            formatTimeFromMinutes(
              startMins
            ),

          durationMinutes
        },
        tasks
      );

    setTasks(savedTasks);

    setTargetSlotMinutes(null);
    setModalVisible(false);
  };


  /* -------------------------------------------------------
     TOQUE NA TIMELINE -> CRIAR
  ------------------------------------------------------- */

  const handleTimelineTouchStart = (
    event
  ) => {
    const touches =
      event
        .nativeEvent
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

    tapStartRef.current = {
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
      event
        .nativeEvent
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
      tapStartRef
        .current
        .pageX;

    const dy =
      touch.pageY -
      tapStartRef
        .current
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
      pinchStartDistance
        .current >
      0
    ) {
      return;
    }

    const touch =
      event
        .nativeEvent
        .changedTouches?.[0];

    if (
      !touch
    ) {
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
      viewportWindowYRef
        .current;

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
          suppressTimelineCreateRef
            .current
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
    useRef(
      ppm
    );

  useEffect(
    () => {
      ppmRef.current =
        ppm;
    },
    [
      ppm,
    ]
  );

  const minPpmRef =
    useRef(
      minPpm
    );

  useEffect(
    () => {
      minPpmRef.current =
        minPpm;
    },
    [
      minPpm,
    ]
  );

  const pinchStartDistance =
    useRef(0);

  const initialPpm =
    useRef(1);

  const zoomResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponderCapture:
            (
              evt
            ) =>
              evt
                .nativeEvent
                .touches
                .length ===
              2,

          onMoveShouldSetPanResponderCapture:
            (
              evt
            ) =>
              evt
                .nativeEvent
                .touches
                .length ===
              2,

          onPanResponderGrant:
            (
              evt
            ) => {
              if (
                evt
                  .nativeEvent
                  .touches
                  .length ===
                2
              ) {
                pinchStartDistance.current =
                  getPinchDistance(
                    evt
                      .nativeEvent
                      .touches
                  );

                initialPpm.current =
                  ppmRef.current;

                tapStartRef.current =
                  null;
              }
            },

          onPanResponderMove:
            (
              evt
            ) => {
              if (
                evt
                  .nativeEvent
                  .touches
                  .length ===
                2 &&
                pinchStartDistance
                  .current >
                0
              ) {
                const currentDistance =
                  getPinchDistance(
                    evt
                      .nativeEvent
                      .touches
                  );

                const scale =
                  currentDistance /
                  pinchStartDistance
                    .current;

                setPpm(
                  clamp(
                    initialPpm
                      .current *
                    scale,

                    minPpmRef
                      .current,

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
        }),
      []
    );

  const isDense =
    ppm < 0.7;

  /* -------------------------------------------------------
     CONTADOR
  ------------------------------------------------------- */

  const totalCompletedTasks =
    visibleTasks.filter(
      (
        task
      ) =>
        task.status ===
        'completed'
    ).length;

/* -------------------------------------------------------
   NOW BUTTON
------------------------------------------------------- */
const handleGoToNow = () => {
  const today = new Date();

  if (!isSameDay(selectedDate, today)) {
    // 1. Se não for hoje, muda a data selecionada para hoje
    setSelectedDate(today);
  } else {
    // 2. Se já for hoje, calcula a posição Y da hora atual e faz scroll
    const targetY = nowTop - viewportHeight * 0.35;
    const maxScroll = Math.max(0, canvasHeight - viewportHeight);
    const y = clamp(targetY, 0, maxScroll);

    scrollRef.current?.scrollTo({
      y,
      animated: true, // Scroll suave até à linha da abelha
    });
  }
};
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
        onMenuPress={handleMenuPress}
        selectedDate={selectedDate}
        onSelectDate={(newDate) => setSelectedDate(newDate)}
        onGoToNow={handleGoToNow} // <-- Nova prop de ação
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
              timelineViewportRef
                .current
                ?.measureInWindow(
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
                  i *
                  30;

                const top =
                  offsetMinutes *
                  ppm +
                  VERTICAL_PADDING;

                const isHalfHour =
                  i %
                  2 !==
                  0;

                const displayHour =
                  (
                    Math.floor(
                      i /
                      2
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
                  onToggle={(taskId) => {
                    suppressTimelineCreateRef.current =
                      true;
                    toggleTaskComplete(taskId);
                  }}
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

            {isViewingToday && (
              <View
                pointerEvents="none"
                style={[
                  styles.nowLine,
                  {
                    top:
                      nowTop,
                  },
                ]}
              >
                <View
                  style={
                    styles.nowDot
                  }
                />

                <Image
                  source={require('../../assets/abelha.png')}
                  style={
                    styles.nowBeeImage
                  }
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

          setDetailsTask({
            ...draft,

            date:
              draft?.date ||
              selectedDateKey,
          });

          setModalVisible(
            false
          );
        }}
      />

      {/* DETAILS */}

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
        onSave={async (
          changes
        ) => {
          const savedTasks =
            detailsMode === 'create'
              ? await taskService.createTask({
                ...changes,

                date:
                  changes.date ||
                  selectedDateKey,
              }, tasks)
              : await taskService.updateTask(
                detailsTask.id,
                changes,
                tasks
              );

          setTasks(savedTasks);

          setDetailsTask(null);
          setTargetSlotMinutes(null);
        }}
        onDelete={
          detailsMode === 'edit'
            ? async () => {
              const savedTasks =
                await taskService.deleteTask(
                  detailsTask.id,
                  tasks
                );

              setTasks(savedTasks);

              setDetailsTask(null);
            }
            : undefined
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

    backgroundColor: colors.surface, 
    },

    timelineViewport: {
      flex: 1,

      position:
        'relative',

      marginTop:
        2,
    },

    timelineCanvas: {
      position:
        'relative',

      backgroundColor:
        '#FFFFFF',
    },

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

      fontSize:
        12,

      fontWeight:
        '500',

      color:
        '#9C948D',
    },

    hourTextOverview: {
      fontSize:
        9,

      color:
        '#C7BFB9',
    },

    railContainer: {
      position:
        'absolute',

      top: 0,
      bottom: 0,

      left:
        AXIS_WIDTH -
        0.5,

      width:
        1,

      zIndex:
        2,
    },

    railSegment: {
      position:
        'absolute',

      left: 0,

      width:
        1,
    },

    hourDot: {
      width:
        4,

      height:
        4,

      borderRadius:
        2,

      marginLeft:
        -2,

      marginRight:
        -2,

      zIndex:
        3,
    },

  /* Estilo da linha horizontal de cada hora na grelha */
hourLine: {
  position: 'absolute',
  left: 50,                  
  right: 20,                
  height: 1,
  backgroundColor: colors.borderSoft,
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

    nowLine: {
      position:
        'absolute',

      left:
        AXIS_WIDTH,

      right:
        20,

      height:
        1.5,

      zIndex:
        90,

      backgroundColor:
        '#ECC94B',
    },

    nowDot: {
      position:
        'absolute',

      left:
        -3,

      top:
        -2.5,

      width:
        6.5,

      height:
        6.5,

      borderRadius:
        4,

      backgroundColor:
        '#ECC94B',
    },

    nowBeeImage: {
      position:
        'absolute',

      right:
        -6,

      top:
        -10,

      width:
        20,

      height:
        20,

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