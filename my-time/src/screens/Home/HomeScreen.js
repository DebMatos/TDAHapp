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
  ScrollView,
  Text,
  View,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  DAY_MINUTES,
  TIMELINE_START_MINUTES,
  MAX_PPM,
  DEFAULT_PPM,
} from '../../constants/timeline';

import {
  formatTimeFromMinutes,
  timeToMinutes,
  snapMinutes,
} from '../../utils/time';

import {useNavigation} from '@react-navigation/native';

import { getDateKey, isSameDay, addDays } from '../../utils/date';
import * as taskService from '../../services/taskService';
import { SafeAreaView } from 'react-native-safe-area-context';

import TaskDetailsModal from '../../components/modals/TaskDetailsModal';
import TaskCardClean from '../../components/TaskCardClean';
import Header from '../../components/Header';
import TaskBanner from '../../components/TaskBanner';
import ActiveTaskBar from '../../components/ActiveTaskBar';
import * as taskExecution from '../../services/taskExecutionService';
import { syncTaskSessions } from '../../services/taskSessionSyncService';
import { subscribeTaskSyncStatus } from '../../data/taskSyncStatus';
import { createTaskSyncNoticeTracker } from '../../data/taskSyncNotices';
import CreateTaskModal from '../../components/modals/CreateTaskModal';
import { useTheme } from '../../theme/ThemeContext';
import NetInfo from '@react-native-community/netinfo';
import {
  loadTasksSnapshot,
  subscribeTasks,
  pullRemoteTasks,
} from '../../data/taskRepository';
import {
  getTimelineDate,
  getCivilDateForTimelineSlot,
} from '../../utils/timelineDate';
import { getHomeScreenStyles } from './HomeScreen.styles';
import { getFloatingButtonStyles } from '../../theme/styles/buttons.styles';

/* -------------------------------------------------------
   TIMELINE
------------------------------------------------------- */

const VERTICAL_PADDING = 20;

const TASK_CARD_LEFT = 56;

const TASK_CARD_RIGHT = 22;

const OVERLAP_GAP = 4;

const CREATE_LONG_PRESS_MS = 300;

/* -------------------------------------------------------
   CORES DA ESPINHA DORSAL
------------------------------------------------------- */

const getRailColor = (hour, colors) => {
  if (hour >= 7 && hour < 9) {
    return colors.timeOfDay[0];
  }

  if (hour >= 9 && hour < 12) {
    return colors.timeOfDay[1];
  }

  if (hour >= 12 && hour < 14) {
    return colors.timeOfDay[2];
  }

  if (hour >= 14 && hour < 18) {
    return colors.timeOfDay[3];
  }

  if (hour >= 18 && hour < 23) {
    return colors.timeOfDay[4];
  }

  return colors.timeOfDay[5];
};

const getVerticalSegments = (colors) => [
  { start: 7, duration: 2, color: colors.timelineSegments[0] },
  { start: 9, duration: 3, color: colors.timelineSegments[1] },
  { start: 12, duration: 2, color: colors.timelineSegments[2] },
  { start: 14, duration: 4, color: colors.timelineSegments[3] },
  { start: 18, duration: 5, color: colors.timelineSegments[4] },
  { start: 23, duration: 8, color: colors.timelineSegments[5] },
];

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getPinchDistance = (touches) => {
  const [t1, t2] = touches;

  const dx = t1.pageX - t2.pageX;

  const dy = t1.pageY - t2.pageY;

  return Math.sqrt(dx * dx + dy * dy);
};

/* -------------------------------------------------------
   OVERLAP
------------------------------------------------------- */

const getTaskTimelineInterval = (task) => {
  const startMinute = timeToMinutes(task.startTime);

  let start = startMinute - TIMELINE_START_MINUTES;

  if (start < 0) {
    start += DAY_MINUTES;
  }

  const duration = Math.max(1, Number(task.durationMinutes) || 30);

  return {
    id: task.id,

    start,

    end: start + duration,
  };
};

const calculateOverlapColumns = (tasks) => {
  const intervals = tasks.map(getTaskTimelineInterval).sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }

    return b.end - a.end;
  });

  const result = new Map();

  let group = [];

  let groupEnd = -1;

  const processGroup = () => {
    if (group.length === 0) {
      return;
    }

    const active = [];

    const assignments = [];

    let maxColumns = 1;

    group.forEach((event) => {
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].end <= event.start) {
          active.splice(i, 1);
        }
      }

      const usedColumns = new Set(active.map((item) => item.column));

      let column = 0;

      while (usedColumns.has(column)) {
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

      maxColumns = Math.max(maxColumns, active.length, column + 1);
    });

    assignments.forEach(({ id, column }) => {
      result.set(id, {
        column,

        columnCount: maxColumns,
      });
    });
  };

  intervals.forEach((event) => {
    if (group.length > 0 && event.start >= groupEnd) {
      processGroup();

      group = [];

      groupEnd = -1;
    }

    group.push(event);

    groupEnd = Math.max(groupEnd, event.end);
  });

  processGroup();

  return result;
};
/* -------------------------------------------------------
   SCREEN
------------------------------------------------------- */

export default function TimelineScreen() {
  const navigation = useNavigation();
  const handleMenuPress = () => {
        navigation.openDrawer();

  };
  const { colors, isDark } = useTheme();
  const styles = getHomeScreenStyles(isDark);
  const buttonStyles = getFloatingButtonStyles(isDark);
  const verticalSegments = useMemo(() => getVerticalSegments(colors), [colors]);
  const [taskError, setTaskError] = useState(null);
  const [syncNotice, setSyncNotice] = useState(null);
  const banner = taskError ?? syncNotice;
  const dismissBanner = () => {
    if (taskError) setTaskError(null);
    else setSyncNotice(null);
  };
  useEffect(() => {
    const track = createTaskSyncNoticeTracker();
    return subscribeTaskSyncStatus((status) => {
      const event = track(status);
      if (event?.kind === 'notice') setSyncNotice(event.notice);
      if (event?.kind === 'clear') setSyncNotice(null);
    });
  }, []);
  const showTaskError = (title, error) => {
    setTaskError({
      title,
      message:
        error.code === 'TASK_NOT_FOUND'
          ? 'Esta tarefa já não existe neste dispositivo. Fecha os detalhes e verifica a lista.'
          : 'Não foi possível guardar a alteração neste dispositivo. Tenta novamente.',
    });
  };


  const [selectedTimelineDate, setSelectedTimelineDate] = useState(() =>
    getTimelineDate(new Date()),
  );

  const now = new Date();

  const currentTimelineDate = getTimelineDate(now);

  const isViewingToday = isSameDay(selectedTimelineDate, currentTimelineDate);

  const selectedTimelineDateKey = getDateKey(selectedTimelineDate);

  const scrollRef = useRef(null);

  const timelineViewportRef = useRef(null);

  const scrollYRef = useRef(0);

  const viewportWindowYRef = useRef(0);

  const tapStartRef = useRef(null);

  const touchMovedRef = useRef(false);

  const suppressTimelineCreateRef = useRef(false);

  const [detailsTask, setDetailsTask] = useState(null);
  const [detailsTrackedDurationMs, setDetailsTrackedDurationMs] = useState(null);


  const [detailsMode, setDetailsMode] = useState('create');
  const [detailsFromQuick, setDetailsFromQuick] = useState(false);


  const [viewportHeight, setViewportHeight] = useState(0);

  const [viewportWidth, setViewportWidth] = useState(0);

  const [isDragging, setIsDragging] = useState(false);

  const [ppm, setPpm] = useState(DEFAULT_PPM);

  const [tasks, setTasks] = useState([]);
  const [trackedTaskId, setTrackedTaskId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [trackedDurationMs, setTrackedDurationMs] = useState(0);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingNow, setTrackingNow] = useState(Date.now());
  const [trackingBaselineAt, setTrackingBaselineAt] = useState(Date.now());

  // Tempo real das sessões, independentemente do horário planeado.
  useEffect(() => {
    const taskId = detailsTask?.id;
    if (!taskId) {
      setDetailsTrackedDurationMs(null);
      return;
    }
    let current = true;
    setDetailsTrackedDurationMs(null);
    taskExecution.getRecordedDurationMs(taskId)
      .then((milliseconds) => {
        if (current) setDetailsTrackedDurationMs(milliseconds);
      })
      .catch((error) => {
        console.warn('[Tracking] Falha ao carregar duração:', error);
      });
    return () => { current = false; };
  }, [detailsTask?.id, activeSession?.id, trackingBusy]);


  const refreshTracking = useCallback(async (preferredTaskId = null) => {
    const active = await taskExecution.getActiveSession();
    const taskId = active?.taskId ?? preferredTaskId;
    const duration = taskId
      ? await taskExecution.getTrackedDurationMs(taskId)
      : 0;
    setActiveSession(active);
    setTrackedTaskId(taskId ?? null);
    setTrackedDurationMs(duration);
    setTrackingBaselineAt(Date.now());
    setTrackingNow(Date.now());
  }, []);

  useEffect(() => {
    let mounted = true;
    refreshTracking().catch((error) => {
      console.warn('[Tracking] Falha ao recuperar sessão:', error);
      if (mounted) setTaskError({
        title: 'Não foi possível carregar o registo de tempo',
        message: 'Os dados locais não foram apagados.',
      });
    });
    syncTaskSessions().then(() => {
      if (mounted) return refreshTracking();
    }).catch((error) => {
      console.warn('[Sessions] Não foi possível recuperar sessões remotas:', error);
    });
    return () => { mounted = false; };
  }, [refreshTracking]);

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => setTrackingNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleTrackingAction = async (taskId, action) => {
    if (trackingBusy) return;
    // O estado da tarefa vem da lista atual, não do snapshot antigo dos detalhes.
    if (action !== 'pause' && tasks.find((task) => task.id === taskId)?.status === 'completed') {
      Alert.alert('Tarefa concluída', 'Reabre a tarefa antes de iniciares um novo registo.');
      return;
    }
    setTrackingBusy(true);
    try {
      if (action === 'pause') {
        await taskExecution.pauseTask(taskId);
      } else {
        await taskExecution.startTask(taskId);
      }
      await refreshTracking(taskId);
      // O registo local já está confirmado; falhas de rede não bloqueiam o controlo.
      syncTaskSessions().catch((error) => {
        console.warn('[Sessions] Envio pendente:', error);
      });
    } catch (error) {
      Alert.alert('Registo de tempo', error.message ?? 'Não foi possível guardar a sessão.');
    } finally {
      setTrackingBusy(false);
    }
  };

  // Terminar a execução fecha a sessão ativa (se existir) e retira a barra.
  // O histórico de tempo mantém-se na persistência local.
  const finishTrackingForTask = async (taskId) => {
    await taskExecution.finishTask(taskId);
    if (trackedTaskId === taskId) {
      await refreshTracking();
    }
    syncTaskSessions().catch((error) => {
      console.warn('[Sessions] Fecho pendente de sincronização:', error);
    });
  };

  const handleFinishTracking = async (taskId) => {
    if (trackingBusy) return;
    setTrackingBusy(true);
    try {
      await finishTrackingForTask(taskId);
    } catch (error) {
      Alert.alert('Registo de tempo', error.message ?? 'Não foi possível terminar o registo.');
    } finally {
      setTrackingBusy(false);
    }
  };

  const trackedTask = tasks.find((task) => task.id === trackedTaskId) ?? null;
  const liveDurationMs = activeSession
    ? trackedDurationMs + Math.max(0, trackingNow - trackingBaselineAt)
    : trackedDurationMs;


  const visibleTasks = useMemo(() => {
    const todayKey = getDateKey(new Date());

    return tasks.filter((task) => {
      const taskDate = task.date || todayKey;

      const taskStartTime = task.startTime || '07:00';

      const taskDateTime = new Date(`${taskDate}T${taskStartTime}:00`);

      const taskTimelineDate = getTimelineDate(taskDateTime);

      return getDateKey(taskTimelineDate) === selectedTimelineDateKey;
    });
  }, [tasks, selectedTimelineDateKey]);

  const [modalVisible, setModalVisible] = useState(false);

  const [targetSlotMinutes, setTargetSlotMinutes] = useState(null);
  const goToPreviousDay = () => {
    setSelectedTimelineDate((current) => addDays(current, -1));
  };

  const goToNextDay = () => {
    setSelectedTimelineDate((current) => addDays(current, 1));
  };

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
    [ppm],
  );

  const getMinuteFromY = useCallback(
    (y) => {
      const rawY = y - VERTICAL_PADDING;

      const offset = rawY / ppm;

      let realMinute = (offset + TIMELINE_START_MINUTES) % DAY_MINUTES;

      if (realMinute < 0) {
        realMinute += DAY_MINUTES;
      }

      return realMinute;
    },
    [ppm],
  );

  const canvasHeight = useMemo(
    () => DAY_MINUTES * ppm + VERTICAL_PADDING * 2,
    [ppm],
  );

  /* -------------------------------------------------------
     OVERLAPS
  ------------------------------------------------------- */

  const overlapColumns = useMemo(
    () => calculateOverlapColumns(visibleTasks),
    [visibleTasks],
  );

  const taskHorizontalLayouts = useMemo(() => {
    const layouts = new Map();

    const availableWidth = Math.max(
      0,
      viewportWidth - TASK_CARD_LEFT - TASK_CARD_RIGHT,
    );

    visibleTasks.forEach((task) => {
      const overlap = overlapColumns.get(task.id) || {
        column: 0,

        columnCount: 1,
      };

      const { column, columnCount } = overlap;

      if (columnCount <= 1 || availableWidth <= 0) {
        layouts.set(task.id, {
          left: TASK_CARD_LEFT,

          right: TASK_CARD_RIGHT,
        });

        return;
      }

      const gaps = OVERLAP_GAP * (columnCount - 1);

      const columnWidth = (availableWidth - gaps) / columnCount;

      layouts.set(task.id, {
        left: TASK_CARD_LEFT + column * (columnWidth + OVERLAP_GAP),

        width: columnWidth,

        right: undefined,
      });
    });

    return layouts;
  }, [visibleTasks, overlapColumns, viewportWidth]);

  /* -------------------------------------------------------
     AGORA
  ------------------------------------------------------- */

  const currentAbsMins = now.getHours() * 60 + now.getMinutes();

  const nowTop = getVisualY(currentAbsMins);

  /* -------------------------------------------------------
     SCROLL INICIAL
  ------------------------------------------------------- */

  const initialScrollDone = useRef(false);

  useEffect(() => {
    if (viewportHeight > 0 && !initialScrollDone.current && scrollRef.current) {
      initialScrollDone.current = true;

      const targetY = nowTop - viewportHeight * 0.35;

      const maxScroll = Math.max(0, canvasHeight - viewportHeight);

      const y = clamp(targetY, 0, maxScroll);

      scrollYRef.current = y;

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
    let active = true;
    let latestRevision = -1;

    const applySnapshot = ({ tasks: savedTasks, revision }) => {
      if (!active || revision <= latestRevision) return;
      latestRevision = revision;
      setTasks(savedTasks);
    };

    // Subscribe before reading so writes during initial loading are observed.
    const unsubscribe = subscribeTasks(applySnapshot);
    const loadStoredData = async () => {
      try {
        applySnapshot(await loadTasksSnapshot());
      } catch (error) {
        if (active)
          setTaskError({
            title: 'Não foi possível carregar as tarefas locais',
            message:
              'Não foi possível ler as tarefas deste dispositivo. Os dados não foram apagados.',
            retry: loadStoredData,
          });
        return false;
      }
      if (!active) return;
      try {
        await pullRemoteTasks();
      } catch (error) {
        console.warn('[Sync] Falha ao recuperar tarefas:', error);
      }
      return true;
    };
    loadStoredData();

    let wasReachable = false;
    const unsubscribeNetwork = NetInfo.addEventListener((network) => {
      const reachable =
        network.isConnected === true && network.isInternetReachable === true;
      if (reachable && !wasReachable) {
        pullRemoteTasks().catch((error) => {
          console.warn(
            '[Sync] Falha ao recuperar tarefas na reconexão:',
            error,
          );
        });
      }
      wasReachable = reachable;
    });

    return () => {
      active = false;
      unsubscribe();
      unsubscribeNetwork();
    };
  }, []);
  /* -------------------------------------------------------
     DRAG
  ------------------------------------------------------- */

  const handleDragEnd = async (taskId, newMins) => {
    const taskDate = getDateKey(
      getCivilDateForTimelineSlot(selectedTimelineDate, newMins),
    );

    try {
      await taskService.moveTask({
        taskId,
        schedule: {
          date: taskDate,
          startTime: formatTimeFromMinutes(newMins),
        },
      });
    } catch (error) {
      showTaskError('Não foi possível mover a tarefa', error);
    }
  };

  /* -------------------------------------------------------
     CHECKBOX
  ------------------------------------------------------- */

  const toggleTaskComplete = async (taskId) => {
    try {
      const updatedTasks = await taskService.toggleCompletion(taskId);
      if (updatedTasks.find((task) => task.id === taskId)?.status === 'completed') {
        await finishTrackingForTask(taskId);
      }
    } catch (error) {
      showTaskError('Não foi possível alterar o estado da tarefa ou terminar o registo', error);
    }
  };
  /* -------------------------------------------------------
     QUICK CREATE
  ------------------------------------------------------- */

  const handleSaveTask = async ({
    title,
    notes,
    durationMinutes,
    categoryId,
    priority,
    date,
    startTime,
  }) => {
    setTaskError(null);
    try {
      await taskService.createTask({
        title,
        notes,
        categoryId: categoryId || 'inbox',
        priority,

        date,

        startTime,

        durationMinutes,
      });

      setTargetSlotMinutes(null);

      setModalVisible(false);
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);

      showTaskError('Não foi possível criar a tarefa', error);
    }
  };

  /* -------------------------------------------------------
     TOQUE NA TIMELINE -> CRIAR
  ------------------------------------------------------- */

  const handleTimelineTouchStart = (event) => {
    const touches = event.nativeEvent.touches;

    if (!touches || touches.length !== 1) {
      tapStartRef.current = null;

      return;
    }

    const touch = touches[0];

    tapStartRef.current = {
      pageX: touch.pageX,

      pageY: touch.pageY,

      time: Date.now(),
    };

    touchMovedRef.current = false;

    suppressTimelineCreateRef.current = false;
  };

  const handleTimelineTouchMove = (event) => {
    if (!tapStartRef.current) {
      return;
    }

    const touches = event.nativeEvent.touches;

    if (!touches || touches.length !== 1) {
      touchMovedRef.current = true;

      return;
    }

    const touch = touches[0];

    const dx = touch.pageX - tapStartRef.current.pageX;

    const dy = touch.pageY - tapStartRef.current.pageY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 8) {
      touchMovedRef.current = true;
    }
  };

  const handleTimelineTouchEnd = (event) => {
    const start = tapStartRef.current;

    tapStartRef.current = null;

    if (
      !start ||
      touchMovedRef.current ||
      isDragging ||
      pinchStartDistance.current > 0
    ) {
      return;
    }

    const touch = event.nativeEvent.changedTouches?.[0];

    if (!touch) {
      return;
    }

    const elapsed = Date.now() - start.time;

    if (elapsed < CREATE_LONG_PRESS_MS) {
      return;
    }

    const viewportY = touch.pageY - viewportWindowYRef.current;

    if (viewportY < 0 || viewportY > viewportHeight) {
      return;
    }

    const contentY = scrollYRef.current + viewportY;

    const rawMinute = getMinuteFromY(contentY);

    let snappedMinute = snapMinutes(rawMinute);

    snappedMinute = ((snappedMinute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

    requestAnimationFrame(() => {
      if (suppressTimelineCreateRef.current) {
        suppressTimelineCreateRef.current = false;

        return;
      }

      setTargetSlotMinutes(snappedMinute);

      setModalVisible(true);
    });
  };

  /* -------------------------------------------------------
     ZOOM
  ------------------------------------------------------- */

  const minPpm = (viewportHeight - VERTICAL_PADDING * 2) / DAY_MINUTES;

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
        onStartShouldSetPanResponderCapture: (evt) =>
          evt.nativeEvent.touches.length === 2,

        onMoveShouldSetPanResponderCapture: (evt) =>
          evt.nativeEvent.touches.length === 2,

        onPanResponderGrant: (evt) => {
          if (evt.nativeEvent.touches.length === 2) {
            pinchStartDistance.current = getPinchDistance(
              evt.nativeEvent.touches,
            );

            initialPpm.current = ppmRef.current;

            tapStartRef.current = null;
          }
        },

        onPanResponderMove: (evt) => {
          if (
            evt.nativeEvent.touches.length === 2 &&
            pinchStartDistance.current > 0
          ) {
            const currentDistance = getPinchDistance(evt.nativeEvent.touches);

            const scale = currentDistance / pinchStartDistance.current;

            setPpm(
              clamp(
                initialPpm.current * scale,

                minPpmRef.current,

                MAX_PPM,
              ),
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
    [],
  );

  const isDense = ppm < 0.7;

  /* -------------------------------------------------------
     CONTADOR
  ------------------------------------------------------- */

  const totalCompletedTasks = visibleTasks.filter(
    (task) => task.status === 'completed',
  ).length;

  /* -------------------------------------------------------
   NOW BUTTON
------------------------------------------------------- */
  const handleGoToNow = () => {
    const currentTimelineDate = getTimelineDate(new Date());

    const targetY = nowTop - viewportHeight * 0.35;

    const maxScroll = Math.max(0, canvasHeight - viewportHeight);

    const y = clamp(targetY, 0, maxScroll);

    setSelectedTimelineDate(currentTimelineDate);

    scrollYRef.current = y;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y,
        animated: true,
      });
    });
  };
  const closeDetails = () => {
    setTaskError(null);
    setDetailsTask(null);
    setDetailsFromQuick(false);
    if (detailsMode === 'create') setTargetSlotMinutes(null);
  };
  const detailsContent = (
      <TaskDetailsModal
        visible={Boolean(detailsTask)}
        embedded={detailsFromQuick}
        banner={banner}
        onDismissBanner={dismissBanner}
        mode={detailsMode}
        initialValues={detailsTask}
        onClose={closeDetails}
        onSave={async (changes) => {
          setTaskError(null);
          try {
            detailsMode === 'create'
              ? await taskService.createTask({
                  ...changes,
                  date:
                    changes.date ||
                    getDateKey(
                      getCivilDateForTimelineSlot(
                        selectedTimelineDate,
                        timeToMinutes(
                          changes.startTime,
                          TIMELINE_START_MINUTES,
                        ),
                      ),
                    ),
                })
              : await taskService.updateTask(detailsTask.id, changes);

            if (detailsMode === 'edit' && changes.status === 'completed') {
              await finishTrackingForTask(detailsTask.id);
            }

            setDetailsTask(null);
            setDetailsFromQuick(false);

            setTargetSlotMinutes(null);
          } catch (error) {
            console.error('Erro ao guardar tarefa:', error);

            showTaskError('Não foi possível guardar a tarefa', error);

            throw error;
          }
        }}
        onStartTracking={detailsMode === 'edit' ? async () => {
          await handleTrackingAction(detailsTask.id, 'start');
        } : undefined}
        isTracking={activeSession?.taskId === detailsTask?.id}
        trackingBusy={trackingBusy}
        trackedDurationMs={detailsTrackedDurationMs}
        onDelete={
          detailsMode === 'edit'
            ? async () => {
                setTaskError(null);
                try {
                  await taskService.deleteTask(detailsTask.id);
                  await finishTrackingForTask(detailsTask.id);
                  setDetailsTask(null);
                } catch (error) {
                  showTaskError('Não foi possível apagar a tarefa', error);
                }
              }
            : undefined
        }
      />
  );

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <Header
        onMenuPress={handleMenuPress}
        selectedDate={selectedTimelineDate}
        onSelectDate={setSelectedTimelineDate}
        onGoToNow={handleGoToNow}
        completedTasks={totalCompletedTasks}
        totalTasks={visibleTasks.length}
      />
     
      <TaskBanner
        notice={!modalVisible && !detailsTask ? banner : null}
        onDismiss={dismissBanner}
      />

      <View
        ref={timelineViewportRef}
        {...zoomResponder.panHandlers}
        style={styles.timelineViewport}
        onTouchStart={handleTimelineTouchStart}
        onTouchMove={handleTimelineTouchMove}
        onTouchEnd={handleTimelineTouchEnd}
        onLayout={(event) => {
          setViewportHeight(event.nativeEvent.layout.height);

          setViewportWidth(event.nativeEvent.layout.width);

          requestAnimationFrame(() => {
            timelineViewportRef.current?.measureInWindow((x, y) => {
              viewportWindowYRef.current = y;
            });
          });
        }}
      >
        <ScrollView
          ref={scrollRef}
          scrollEnabled={!isDragging}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollYRef.current = event.nativeEvent.contentOffset.y;
          }}
          onScrollBeginDrag={() => {
            touchMovedRef.current = true;
          }}
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

            <View pointerEvents="none" style={styles.railContainer}>
              {verticalSegments.map((segment, index) => {
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
                        top: offsetHour * 60 * ppm + VERTICAL_PADDING,

                        height: segment.duration * 60 * ppm,

                        backgroundColor: segment.color,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* HORAS / MEIAS HORAS */}

            {Array.from({
              length: 49,
            }).map((_, i) => {
              const offsetMinutes = i * 30;

              const top = offsetMinutes * ppm + VERTICAL_PADDING;

              const isHalfHour = i % 2 !== 0;

              const displayHour = (Math.floor(i / 2) + 7) % 24;

              const hideText = isHalfHour;

              return (
                <View
                  pointerEvents="none"
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

                      isDense && styles.hourTextOverview,
                    ]}
                  >
                    {!hideText ? String(displayHour).padStart(2, '0') : ''}
                  </Text>

                  {!isHalfHour && (
                    <View
                      style={[
                        styles.hourDot,
                        {
                          backgroundColor:
                            i === 48
                              ? colors.timeOfDay[5]
                              : getRailColor(displayHour, colors),
                        },
                      ]}
                    />
                  )}

                  <View
                    style={[
                      styles.hourLine,

                      isHalfHour
                        ? styles.halfHourLine
                        : (isDense || hideText) && styles.hourLineOverview,
                    ]}
                  />
                </View>
              );
            })}

            {/* TAREFAS */}

            {visibleTasks.map((task, index) => (
              <TaskCardClean
                key={task.id}
                task={task}
                ppm={ppm}
                themeIndex={index}
                layoutStyle={taskHorizontalLayouts.get(task.id)}
                onChangeStart={handleDragEnd}
                onDragStateChange={setIsDragging}
                onToggle={(taskId) => {
                  suppressTimelineCreateRef.current = true;
                  toggleTaskComplete(taskId);
                }}
                onPress={(selectedTask) => {
                  suppressTimelineCreateRef.current = true;

                  setDetailsMode('edit');

                  setDetailsTask(selectedTask);
                }}
                getVisualY={getVisualY}
                getMinuteFromY={getMinuteFromY}
              />
            ))}

            {/* LINHA AGORA */}

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
                <View style={styles.nowDot} />

                <Image
                  source={require('../../../assets/abelha.png')}
                  style={styles.nowBeeImage}
                />
              </View>
            )}
          </View>
        </ScrollView>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Ir para agora"
          onPress={handleGoToNow}
          style={buttonStyles.floatingButton}
          activeOpacity={0.8}
        >
          <Image
            style={buttonStyles.icon}
            source={require('../../../assets/abelha.png')}
          />
        </TouchableOpacity>
      </View>

      <ActiveTaskBar
        task={trackedTask}
        running={Boolean(activeSession)}
        durationMs={liveDurationMs}
        busy={trackingBusy}
        onToggle={() => handleTrackingAction(trackedTaskId, activeSession ? 'pause' : 'start')}
        onFinish={() => handleFinishTracking(trackedTaskId)}
        onPress={() => {
          setDetailsMode('edit');
          setDetailsFromQuick(false);
          setDetailsTask(trackedTask);
        }}
      />

      {/* QUICK CREATE */}

      <CreateTaskModal
        visible={modalVisible || (detailsFromQuick && Boolean(detailsTask))}
        expandedContent={detailsFromQuick ? detailsContent : null}
        onExpandedClose={closeDetails}
        banner={banner}
        onDismissBanner={dismissBanner}
        initialMinutes={targetSlotMinutes}
        initialDate={getDateKey(getCivilDateForTimelineSlot(
          selectedTimelineDate, targetSlotMinutes ?? TIMELINE_START_MINUTES,
        ))}
        onClose={() => {
          setTaskError(null);
          setModalVisible(false);

          setTargetSlotMinutes(null);
        }}
        onSave={handleSaveTask}
        onExpand={(draft) => {
          setTaskError(null);
          setDetailsMode('create');
          setDetailsFromQuick(true);
          setDetailsTask(draft);
          setModalVisible(false);
        }}
      />

      {/* DETAILS */}

      {!detailsFromQuick && detailsContent}
    </SafeAreaView>
  );
}
