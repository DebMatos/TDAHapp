import TaskBanner from '../TaskBanner';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { getCategory, getCategoryOptions } from '../../config/categories';
import { useTheme } from '../../theme/ThemeContext';
import { createTaskSheetStyles, TASK_DETAILS_HEIGHT_RATIO } from '../../theme/styles/taskSheets.styles';
import {
  formatDateForInput, getTodayDateInput, formatDateInput, isValidDateInput,
  dateInputToStorageDate, addDaysToDateInput, getDateDisplayLabel,
} from '../../utils/taskDateInput';

const DAY_MINUTES = 24 * 60;

const SCREEN_HEIGHT = Dimensions.get('window').height;

const NORMAL_SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * TASK_DETAILS_HEIGHT_RATIO);

const EXPANDED_SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.94);

const MIN_SHEET_HEIGHT = 260;

const DURATION_PRESETS = [15, 30, 60];

const POSTPONE_OPTIONS = [
  {
    id: '15',
    label: '+15 min',
    minutes: 15,
  },
  {
    id: '30',
    label: '+30 min',
    minutes: 30,
  },
  {
    id: '60',
    label: '+1 h',
    minutes: 60,
  },
];

const REPEAT_OPTIONS = ['never', 'daily', 'weekdays', 'weekly'];

const REPEAT_LABELS = {
  never: 'Nunca',
  daily: 'Todos os dias',
  weekdays: 'Dias úteis',
  weekly: 'Todas as semanas',
};

const STATUS_OPTIONS = [
  {
    id: 'pending',
    label: 'Pendente',
  },
  {
    id: 'completed',
    label: 'Concluída',
  },
  {
    id: 'abandoned',
    label: 'Abandonada',
  },
];

const getPriorityOptions = (colors) => [
  {
    id: null,
    label: 'Sem prioridade',
    icon: 'flag-outline',
    color: colors.textMuted,
  },
  {
    id: 'low',
    label: 'Baixa',
    icon: 'flag-outline',
    color: colors.priority.low,
  },
  {
    id: 'medium',
    label: 'Média',
    icon: 'flag-outline',
    color: colors.priority.medium,
  },
  {
    id: 'high',
    label: 'Alta',
    icon: 'flag-outline',
    color: colors.priority.high,
  },
];

const getPriorityLabel = (priority, options) =>
  options.find((item) => item.id === priority)?.label ??
  'Sem prioridade';

const getPriorityColor = (priority, options, colors) =>
  options.find((item) => item.id === priority)?.color ?? colors.textMuted;

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeMinutes = (minutes) =>
  ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

const formatTime = (minutes) => {
  const normalized = normalizeMinutes(minutes);

  const hours = Math.floor(normalized / 60);

  const mins = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const parseTime = (value, fallback = 7 * 60) => {
  if (!value || !value.includes(':')) {
    return fallback;
  }

  const [hours, minutes] = value.split(':').map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return fallback;
  }

  return normalizeMinutes(hours * 60 + minutes);
};

const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);

  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${mins} min`;
};

/* -------------------------------------------------------
   TIME
------------------------------------------------------- */

const formatTimeInput = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const isValidTime = (value) => {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hours, minutes] = value.split(':').map(Number);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

/* -------------------------------------------------------
   DATE
------------------------------------------------------- */

/* -------------------------------------------------------
   STATUS ICON
------------------------------------------------------- */

function StatusIcon({ type, selected }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const iconColor = selected ? colors.selectionText : colors.textMuted;

  return (
    <View
      style={[
        styles.statusIconSquare,

        selected && styles.statusIconSquareSelected,
      ]}
    >
      {type === 'completed' && (
        <Ionicons name="checkmark" size={15} color={iconColor} />
      )}

      {type === 'abandoned' && (
        <Ionicons name="close" size={15} color={iconColor} />
      )}
    </View>
  );
}

/* -------------------------------------------------------
   COMPONENT
------------------------------------------------------- */

export default function TaskDetailsModal({
  visible,
  embedded = false,
  mode = 'create',
  initialValues = null,
  onClose,
  onSave,
  banner,
  onDismissBanner,
  onDelete,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const categoryOptions = useMemo(() => getCategoryOptions(colors), [colors]);
  const priorityOptions = useMemo(() => getPriorityOptions(colors), [colors]);
  const isEdit = mode === 'edit';

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isBusy = isSaving || isDeleting;

  const [title, setTitle] = useState('');

  // One inline editor at a time; task values remain in their existing state.
  const [activeField, setActiveField] = useState(null);
  const isEditingTitle = activeField === 'title';
  const isEditingPriority = activeField === 'priority';
  const isEditingRepeat = activeField === 'repeat';

  const [dateValue, setDateValue] = useState(getTodayDateInput());

  const [startTime, setStartTime] = useState('07:00');

  const [endTime, setEndTime] = useState('07:30');

  const [duration, setDuration] = useState(30);

  const [customDuration, setCustomDuration] = useState('');

  const [postponeSelection, setPostponeSelection] = useState(null);

  const [categoryId, setCategoryId] = useState('inbox');

  const [status, setStatus] = useState('pending');

  const [priority, setPriority] = useState(null);

  const [repeat, setRepeat] = useState('never');

  const [notes, setNotes] = useState('');

  const [savedSnapshot, setSavedSnapshot] = useState(null);

  const [isExpanded, setIsExpanded] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const titleInputRef = useRef(null);

  const dateInputRef = useRef(null);

  const startInputRef = useRef(null);

  const scrollRef = useRef(null);

  const scheduleBaseRef = useRef({
    date: getTodayDateInput(),

    startTime: '07:00',
  });

  const sheetHeight = useRef(new Animated.Value(NORMAL_SHEET_HEIGHT)).current;

  const sheetBottom = useRef(new Animated.Value(0)).current;
  const activeAnimation = useRef(null);

  const stopSheetAnimation = useCallback(() => {
    const animation = activeAnimation.current;
    activeAnimation.current = null;
    animation?.stop();
  }, []);

  const dismissDetails = () => {
    stopSheetAnimation();
    onClose?.();
  };

  const dragStartHeightRef = useRef(NORMAL_SHEET_HEIGHT);
  const selectedCategory = useMemo(() => getCategory(categoryId, colors), [categoryId, colors]);

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        title: title.trim(),
        date: dateValue,
        startTime,
        endTime,
        duration,
        categoryId,
        priority,
        status,
        repeat,
        notes: notes.trim(),
      }),
    [
      title,
      dateValue,
      startTime,
      endTime,
      duration,
      categoryId,
      priority,
      status,
      repeat,
      notes,
    ],
  );

  const canSave =
    title.trim().length > 0 &&
    isValidDateInput(dateValue) &&
    isValidTime(startTime) &&
    isValidTime(endTime);

  const isDirty = savedSnapshot !== null && currentSnapshot !== savedSnapshot;

  const saveIconColor = !canSave
    ? colors.textFaint
    : isDirty
      ? colors.saveAction
      : colors.textMuted;

  /* -------------------------------------------------------
     SHEET
  ------------------------------------------------------- */

  const animateGeometry = (baseHeight, bottomValue) => {
    stopSheetAnimation();
    const height = Math.max(
      MIN_SHEET_HEIGHT,

      baseHeight - bottomValue,
    );

    const animation = Animated.parallel([
      Animated.spring(sheetHeight, {
        toValue: height,

        useNativeDriver: false,

        tension: 70,

        friction: 11,
      }),

      Animated.spring(sheetBottom, {
        toValue: bottomValue,

        useNativeDriver: false,

        tension: 70,

        friction: 11,
      }),
    ]);
    activeAnimation.current = animation;
    animation.start(() => {
      if (activeAnimation.current === animation) activeAnimation.current = null;
    });
  };

  const animateSheetTo = (expanded) => {
    const baseHeight = expanded ? EXPANDED_SHEET_HEIGHT : NORMAL_SHEET_HEIGHT;

    setIsExpanded(expanded);

    animateGeometry(baseHeight, keyboardHeight);
  };

  const closeFromDrag = () => {
    stopSheetAnimation();
    const animation = Animated.parallel([
      Animated.timing(sheetHeight, {
        toValue: 0,

        duration: 180,

        useNativeDriver: false,
      }),

      Animated.timing(sheetBottom, {
        toValue: 0,

        duration: 180,

        useNativeDriver: false,
      }),
    ]);
    activeAnimation.current = animation;
    animation.start(({ finished }) => {
      if (activeAnimation.current !== animation) return;
      activeAnimation.current = null;
      if (!finished) return;
      sheetHeight.setValue(NORMAL_SHEET_HEIGHT);

      sheetBottom.setValue(0);

      setIsExpanded(false);

      setKeyboardHeight(0);

      onClose?.();
    });
  };

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => keyboardHeight === 0,

        onMoveShouldSetPanResponder: (_, gesture) =>
          keyboardHeight === 0 && Math.abs(gesture.dy) > 3,

        onPanResponderGrant: () => {
          stopSheetAnimation();
          sheetHeight.stopAnimation((height) => {
            dragStartHeightRef.current = height;
          });
        },

        onPanResponderMove: (_, gesture) => {
          const nextHeight = clamp(
            dragStartHeightRef.current - gesture.dy,

            MIN_SHEET_HEIGHT,

            EXPANDED_SHEET_HEIGHT,
          );

          sheetHeight.setValue(nextHeight);
        },

        onPanResponderRelease: (_, gesture) => {
          const draggedUp = gesture.dy < -45 || gesture.vy < -0.55;

          const draggedDown = gesture.dy > 55 || gesture.vy > 0.65;

          if (!isExpanded) {
            if (draggedUp) {
              animateSheetTo(true);

              return;
            }

            if (draggedDown) {
              closeFromDrag();

              return;
            }

            animateSheetTo(false);

            return;
          }

          if (draggedDown) {
            animateSheetTo(false);

            return;
          }

          animateSheetTo(true);
        },

        onPanResponderTerminate: () => {
          animateSheetTo(isExpanded);
        },
      }),
    [isExpanded, keyboardHeight, sheetHeight, stopSheetAnimation],
  );

  /* -------------------------------------------------------
     KEYBOARD
  ------------------------------------------------------- */

  useEffect(() => {
    if (!visible) {
      return;
    }

    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = event.endCoordinates?.height || 0;

      setKeyboardHeight(height);

      const baseHeight = isExpanded
        ? EXPANDED_SHEET_HEIGHT
        : NORMAL_SHEET_HEIGHT;

      animateGeometry(baseHeight, height);

      if (isEditingTitle) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({
            y: 0,

            animated: false,
          });
        });
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);

      const baseHeight = isExpanded
        ? EXPANDED_SHEET_HEIGHT
        : NORMAL_SHEET_HEIGHT;

      animateGeometry(baseHeight, 0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible, isExpanded, isEditingTitle]);

  /* -------------------------------------------------------
     FOCUS
  ------------------------------------------------------- */

  useEffect(() => {
    if (!isEditingTitle) {
      return;
    }

    scrollRef.current?.scrollTo({
      y: 0,

      animated: false,
    });

    const timer = setTimeout(() => {
      titleInputRef.current?.focus();
    }, 80);

    return () => clearTimeout(timer);
  }, [isEditingTitle]);

  useEffect(() => {
    if (activeField === 'date') {
      const timer = setTimeout(() => {
        dateInputRef.current?.focus();
      }, 60);

      return () => clearTimeout(timer);
    }

    if (activeField === 'time') {
      const timer = setTimeout(() => {
        startInputRef.current?.focus();
      }, 60);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [activeField]);

  /* -------------------------------------------------------
     RESET
  ------------------------------------------------------- */

  useLayoutEffect(() => {
    stopSheetAnimation();
    if (!visible) {
      return;
    }

    setActiveField(null);

    setPostponeSelection(null);

    setIsExpanded(false);

    setKeyboardHeight(0);

    setSavedSnapshot(null);

    sheetHeight.setValue(NORMAL_SHEET_HEIGHT);

    sheetBottom.setValue(0);
    return stopSheetAnimation;
  }, [visible, sheetHeight, sheetBottom, stopSheetAnimation]);

  /* -------------------------------------------------------
     LOAD
  ------------------------------------------------------- */

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }

    const initialStart = initialValues?.startTime ?? '07:00';

    const initialDuration = Math.max(
      1,

      Number(initialValues?.durationMinutes) || 30,
    );

    const startMinutes = parseTime(initialStart);

    const initialEnd = formatTime(startMinutes + initialDuration);

    const initialStatus = initialValues?.status ?? 'pending';

    let initialDate = getTodayDateInput();

    if (initialValues?.date) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(initialValues.date)) {
        initialDate = initialValues.date;
      } else {
        const formatted = formatDateForInput(initialValues.date);

        if (formatted) {
          initialDate = formatted;
        }
      }
    }

    const initialTitle = initialValues?.title || '';

    const initialCategory = initialValues?.categoryId || 'inbox';

    const initialPriority = initialValues?.priority ?? null;

    const initialRepeat = initialValues?.repeat ?? 'never';

    const initialNotes = initialValues?.notes ?? '';

    scheduleBaseRef.current = {
      date: initialDate,

      startTime: initialStart,
    };

    setTitle(initialTitle);

    setDateValue(initialDate);

    setStartTime(initialStart);

    setDuration(initialDuration);

    setEndTime(initialEnd);

    setCategoryId(initialCategory);

    setStatus(initialStatus);

    setRepeat(initialRepeat);

    setActiveField(null);

    setNotes(initialNotes);

    setPostponeSelection(null);

    setPriority(initialPriority);

    if (DURATION_PRESETS.includes(initialDuration)) {
      setCustomDuration('');
    } else {
      setCustomDuration(String(initialDuration));
    }

    setSavedSnapshot(
      JSON.stringify({
        title: initialTitle.trim(),

        date: initialDate,

        startTime: initialStart,

        endTime: initialEnd,

        duration: initialDuration,

        categoryId: initialCategory,

        priority: initialPriority,

        status: initialStatus,

        repeat: initialRepeat,

        notes: initialNotes.trim(),
      }),
    );
  }, [visible, initialValues]);

  /* -------------------------------------------------------
     SCHEDULE EDIT
  ------------------------------------------------------- */

  const commitManualScheduleBase = (
    nextDate = dateValue,

    nextStart = startTime,
  ) => {
    if (isValidDateInput(nextDate) && isValidTime(nextStart)) {
      scheduleBaseRef.current = {
        date: nextDate,

        startTime: nextStart,
      };

      setPostponeSelection(null);
    }
  };

  const updateDate = (value) => {
    const formatted = formatDateInput(value);

    setDateValue(formatted);

    if (isValidDateInput(formatted)) {
      commitManualScheduleBase(formatted, startTime);
    }
  };

  const updateStartTime = (value) => {
    const formatted = formatTimeInput(value);

    setStartTime(formatted);

    if (!isValidTime(formatted)) {
      return;
    }

    const startMinutes = parseTime(formatted);

    setEndTime(formatTime(startMinutes + duration));

    commitManualScheduleBase(dateValue, formatted);
  };

  const updateEndTime = (value) => {
    const formatted = formatTimeInput(value);

    setEndTime(formatted);

    if (!isValidTime(formatted) || !isValidTime(startTime)) {
      return;
    }

    const startMinutes = parseTime(startTime);

    let endMinutes = parseTime(formatted);

    if (endMinutes <= startMinutes) {
      endMinutes += DAY_MINUTES;
    }

    const nextDuration = Math.max(
      1,

      endMinutes - startMinutes,
    );

    setDuration(nextDuration);

    if (DURATION_PRESETS.includes(nextDuration)) {
      setCustomDuration('');
    } else {
      setCustomDuration(String(nextDuration));
    }
  };

  const updateDuration = (value) => {
    const safeValue = Math.max(
      1,

      Number(value) || 1,
    );

    setDuration(safeValue);

    if (!isValidTime(startTime)) {
      return;
    }

    const startMinutes = parseTime(startTime);

    setEndTime(formatTime(startMinutes + safeValue));
  };

  const handlePresetDuration = (preset) => {
    setCustomDuration('');

    updateDuration(preset);

    setActiveField(null);

    Keyboard.dismiss();
  };

  const handleCustomDuration = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);

    setCustomDuration(digits);

    if (!digits) {
      return;
    }

    updateDuration(Number(digits));
  };

  /* -------------------------------------------------------
     POSTPONE
  ------------------------------------------------------- */

  const restoreScheduleBase = () => {
    const base = scheduleBaseRef.current;

    const baseStart = parseTime(base.startTime);

    setDateValue(base.date);

    setStartTime(base.startTime);

    setEndTime(formatTime(baseStart + duration));

    setPostponeSelection(null);
  };

  const selectPostponeMinutes = (option) => {
    setActiveField(null);

    Keyboard.dismiss();

    if (postponeSelection === option.id) {
      restoreScheduleBase();

      return;
    }

    const base = scheduleBaseRef.current;

    if (!isValidDateInput(base.date) || !isValidTime(base.startTime)) {
      return;
    }

    const baseStart = parseTime(base.startTime);

    const rawStart = baseStart + option.minutes;

    const dayOffset = Math.floor(rawStart / DAY_MINUTES);

    const nextStart = normalizeMinutes(rawStart);

    setDateValue(addDaysToDateInput(base.date, dayOffset));

    setStartTime(formatTime(nextStart));

    setEndTime(formatTime(nextStart + duration));

    setPostponeSelection(option.id);
  };

  const selectPostponeTomorrow = () => {
    setActiveField(null);

    Keyboard.dismiss();

    const id = 'tomorrow';

    if (postponeSelection === id) {
      restoreScheduleBase();

      return;
    }

    const base = scheduleBaseRef.current;

    if (!isValidDateInput(base.date) || !isValidTime(base.startTime)) {
      return;
    }

    const baseStart = parseTime(base.startTime);

    setDateValue(addDaysToDateInput(base.date, 1));

    setStartTime(base.startTime);

    setEndTime(formatTime(baseStart + duration));

    setPostponeSelection(id);
  };

  /* -------------------------------------------------------
     SAVE
  ------------------------------------------------------- */

  const handleSave = async () => {
    if (!canSave || isBusy) {
      return;
    }

    const startMinutes = parseTime(startTime);

    try {
      setIsSaving(true);

      await onSave({
        title: title.trim(),
        date: dateInputToStorageDate(dateValue),
        startTime: formatTime(startMinutes),
        durationMinutes: duration,
        categoryId,
        notes: notes.trim(),
        repeat,
        status,
        priority,
      });

      setSavedSnapshot(currentSnapshot);
    } catch (error) {
      // O HomeScreen já mostra o erro ao utilizador.
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isBusy || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } catch {
      // The parent presents the local error; keep the form open.
    } finally {
      setIsDeleting(false);
    }
  };

  const closeInlineEditor = () => {
    setActiveField(null);
    Keyboard.dismiss();
  };

  const openInlineEditor = (field) => {
    Keyboard.dismiss();
    setActiveField(field);
  };

  const canConfirmField =
    activeField === 'title' ? Boolean(title.trim()) :
    activeField === 'date' ? isValidDateInput(dateValue) :
    activeField === 'time' ? isValidTime(startTime) && isValidTime(endTime) : true;

  const confirmInlineEditor = () => {
    if (!isBusy && canConfirmField) closeInlineEditor();
  };

  /* -------------------------------------------------------
     SCHEDULE RENDER
  ------------------------------------------------------- */

  const renderScheduleLine = () => {
    const dateContent =
      activeField === 'date' ? (
        <TextInput
          editable={!isBusy}
          accessibilityLabel="Data, dia mês e ano"
          ref={dateInputRef}
          style={styles.inlineDateInput}
          value={dateValue}
          onChangeText={updateDate}
          keyboardType="number-pad"
          onBlur={() => setActiveField((field) => field === 'date' ? null : field)}
          maxLength={10}
        />
      ) : (
        <TouchableOpacity
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy }}
          activeOpacity={0.7}
          style={styles.propertyTouch}
          accessibilityLabel="Editar data"
          onPress={() => openInlineEditor('date')}
        >
          <Text style={styles.inlineDateText}>
            {getDateDisplayLabel(dateValue)}
          </Text>
        </TouchableOpacity>
      );

    const timeContent =
      activeField === 'time' ? (
        <View style={styles.inlineTimeEditor}>
          <TextInput
            editable={!isBusy}
            accessibilityLabel="Hora de início"
            ref={startInputRef}
            style={styles.inlineTimeInput}
            value={startTime}
            onBlur={() => requestAnimationFrame(() => {
              if (!TextInput.State.currentlyFocusedInput()) {
                setActiveField((field) => field === 'time' ? null : field);
              }
            })}
            onChangeText={updateStartTime}
            keyboardType="number-pad"
            maxLength={5}
          />

          <Text style={styles.inlineArrow}>→</Text>

          <TextInput
            editable={!isBusy}
            accessibilityLabel="Hora de fim"
            style={styles.inlineTimeInput}
            value={endTime}
            onBlur={() => requestAnimationFrame(() => {
              if (!TextInput.State.currentlyFocusedInput()) {
                setActiveField((field) => field === 'time' ? null : field);
              }
            })}
            onChangeText={updateEndTime}
            keyboardType="number-pad"
            maxLength={5}
            onSubmitEditing={confirmInlineEditor}
          />
        </View>
      ) : (
        <TouchableOpacity
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy }}
          activeOpacity={0.7}
          style={styles.propertyTouch}
          accessibilityLabel="Editar horário"
          onPress={() => openInlineEditor('time')}
        >
          <Text style={styles.inlineTimeText}>
            {startTime}
            {'  →  '}
            {endTime}
          </Text>
        </TouchableOpacity>
      );

    const durationContent =
      activeField === 'duration' ? (
        <View style={styles.inlineDurationEditor}>
          {DURATION_PRESETS.map((preset) => {
            const selected = duration === preset && customDuration === '';

            return (
              <TouchableOpacity
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy, selected: selected }}
                key={preset}
                style={[
                  styles.inlineDurationPreset,

                  selected && styles.inlineDurationPresetSelected,
                ]}
                activeOpacity={0.7}
                onPress={() => handlePresetDuration(preset)}
              >
                <Text
                  style={[
                    styles.inlineDurationPresetText,

                    selected && styles.inlineDurationPresetTextSelected,
                  ]}
                >
                  {preset === 60 ? '1 h' : `${preset} min`}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.inlineCustomDuration}>
            <TextInput
              editable={!isBusy}
              accessibilityLabel="Duração em minutos"
              style={styles.inlineCustomDurationInput}
              value={customDuration}
              onBlur={() => setActiveField((field) => field === 'duration' ? null : field)}
              onChangeText={handleCustomDuration}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="45"
              placeholderTextColor={colors.textFaint}
              onSubmitEditing={confirmInlineEditor}
            />

            <Text style={styles.inlineCustomDurationUnit}>min</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy }}
          activeOpacity={0.7}
          style={styles.propertyTouch}
          accessibilityLabel="Editar duração"
          onPress={() => openInlineEditor('duration')}
        >
          <Text style={styles.inlineDurationText}>
            {formatDuration(duration)}
          </Text>
        </TouchableOpacity>
      );

    return (
      <View style={styles.scheduleLine}>
        {[
          { field: 'date', icon: 'calendar-outline', content: dateContent },
          { field: 'time', icon: 'time-outline', content: timeContent },
          { field: 'duration', icon: 'timer-outline', content: durationContent },
        ].map(({ field, icon, content }) => (
          <View key={field} style={[styles.scheduleItem, field === 'duration' && activeField === 'duration' && styles.scheduleDurationEditing]}>
            <Ionicons name={icon} size={16} color={colors.textMuted} />
            {content}
          </View>
        ))}
      </View>
    );
  };

  const content = (
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={dismissDetails} />
        <TaskBanner notice={visible ? banner : null} onDismiss={onDismissBanner} placement="top" />

        <Animated.View
          testID="task-details-sheet"
          style={[
            styles.sheet,

            {
              height: sheetHeight,

              bottom: sheetBottom,
            },
          ]}
        >
          {/* TOP */}

          <View style={styles.topBar}>
            <View {...sheetPanResponder.panHandlers} style={styles.dragZone}>
              <View style={styles.handle} />
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave || isBusy, busy: isSaving }}
              accessibilityLabel={isSaving ? 'A guardar tarefa' : 'Guardar tarefa'}
              style={[
                styles.saveIconButton,

                (!canSave || isBusy) && styles.saveIconButtonDisabled,
              ]}
              disabled={!canSave || isBusy}
              activeOpacity={0.7}
              onPress={handleSave}
            >
              <Ionicons
                name={isSaving ? 'hourglass-outline' : 'save-outline'}
                size={22}
                color={isSaving ? colors.textFaint : saveIconColor}
              />
            </TouchableOpacity>
          </View>

            {/* TITLE */}

            <View style={[styles.titleRow, styles.stickyTitle]}>
              <Ionicons
                name={selectedCategory.icon}
                size={24}
                color={selectedCategory.color}
                style={styles.titleCategoryIcon}
              />

              {isEditingTitle ? (
                <TextInput
                  editable={!isBusy}
                  accessibilityLabel="Título da tarefa"
                  ref={titleInputRef}
                  style={[styles.titleInput, styles.editTitleInput]}
                  value={title}
                  onChangeText={setTitle}
                  autoFocus={!embedded}
                  returnKeyType="done"
                  onBlur={() => setActiveField((field) => field === 'title' ? null : field)}
                  onSubmitEditing={confirmInlineEditor}
                  placeholder="O que vais fazer?"
                  placeholderTextColor={colors.textFaint}
                />
              ) : (
                <TouchableOpacity
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isBusy }}
                  style={styles.editTitleTouch}
                  accessibilityLabel="Editar título da tarefa"
                  activeOpacity={0.7}
                  onPress={() => {
                    closeInlineEditor();

                    scrollRef.current?.scrollTo({
                      y: 0,

                      animated: false,
                    });

                    setActiveField('title');
                  }}
                >
                  <Text style={styles.editTitle} numberOfLines={3}>
                    {title || 'O que vais fazer?'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={closeInlineEditor}
          >
            {/* POSTPONE */}

            {isEdit && (
              <View style={styles.postponeRow}>
                {POSTPONE_OPTIONS.map((option) => {
                  const selected = postponeSelection === option.id;

                  return (
                    <TouchableOpacity
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isBusy, selected }}
                      key={option.id}
                      style={[
                        styles.postponeButton,

                        selected && styles.postponeButtonSelected,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        closeInlineEditor();

                        selectPostponeMinutes(option);
                      }}
                    >
                      <Text
                        style={[
                          styles.postponeButtonText,

                          selected && styles.postponeButtonTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isBusy, selected: postponeSelection === 'tomorrow' }}
                  accessibilityLabel="Amanhã"
                  style={[
                    styles.postponeButton,

                    postponeSelection === 'tomorrow' &&
                      styles.postponeButtonSelected,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    closeInlineEditor();

                    selectPostponeTomorrow();
                  }}
                >
                  <Ionicons
                    name="sunny-outline"
                    size={14}
                    color={
                      postponeSelection === 'tomorrow'
                        ? colors.selection
                        : colors.text
                    }
                  />

                  <Text
                    style={[
                      styles.postponeButtonText,

                      postponeSelection === 'tomorrow' &&
                        styles.postponeButtonTextSelected,
                    ]}
                  >
                    Amanhã
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* SCHEDULE */}

            <View style={styles.scheduleArea}>{renderScheduleLine()}</View>

            {/* CATEGORY */}

            {activeField !== 'category' ? (
              <TouchableOpacity
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Editar categoria"
                accessibilityState={{ disabled: isBusy }}
                style={styles.propertyRow}
                activeOpacity={0.7}
                onPress={() => openInlineEditor('category')}
              >
                <View style={styles.propertyIcon}><Ionicons name={selectedCategory.icon} size={20} color={selectedCategory.color} /></View>
                <View style={styles.propertyContent}>
                  <Text style={styles.propertyLabel}>Categoria</Text>
                  <Text style={[styles.propertyText, { color: selectedCategory.color }]}>{selectedCategory.label}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.selectorRow}>
                {categoryOptions.map((item) => {
                  const selected = item.id === categoryId;

                  return (
                    <TouchableOpacity
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isBusy, selected: selected }}
                      accessibilityLabel={item.label}
                      key={item.id}
                      activeOpacity={0.7}
                      style={[
                        styles.selectorItem,

                        selected && styles.selectorItemSelected,
                      ]}
                      onPress={() => {
                        closeInlineEditor();

                        setCategoryId(item.id);
                      }}
                    >
                      <Ionicons
                        name={item.icon}
                        size={selected ? 24 : 21}
                        color={selected ? item.color : colors.textMuted}
                      />

                      {selected && (
                        <Text
                          style={[styles.selectorLabel, { color: item.color }]}
                        >
                          {item.label}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* PRIORITY */}

            {!isEditingPriority ? (
              <TouchableOpacity
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy }}
                style={styles.propertyRow}
                accessibilityLabel="Editar prioridade"
                activeOpacity={0.7}
                onPress={() => {
                  closeInlineEditor();
                  setActiveField('priority');
                }}
              >
                <Ionicons
                  name="flag-outline"
                  style={styles.propertyIcon}
                  size={20}
                  color={getPriorityColor(priority, priorityOptions, colors)}
                />

                <View style={styles.propertyContent}>
                  <Text style={styles.propertyLabel}>Prioridade</Text>
                  <Text style={[styles.propertyText, { color: getPriorityColor(priority, priorityOptions, colors) }]}>
                    {getPriorityLabel(priority, priorityOptions)}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.priorityOptionsRow}>
                {priorityOptions.map((item) => {
                  const selected = item.id === priority;

                  return (
                    <TouchableOpacity
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isBusy, selected: selected }}
                      accessibilityLabel={item.label}
                      key={item.id ?? 'none'}
                      activeOpacity={0.7}
                      style={[
                        styles.selectorItem,
                        selected && styles.selectorItemSelected,
                      ]}
                      onPress={() => {
                        setPriority(item.id);
                        setActiveField(null);
                      }}
                    >
                      <Ionicons
                        name={item.icon}
                        size={selected ? 23 : 20}
                        color={item.color}
                      />

                      {selected && (
                        <Text
                          style={[styles.selectorLabel, { color: item.color }]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* STATUS */}

            {activeField !== 'status' ? (
              <TouchableOpacity
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Editar estado"
                accessibilityState={{ disabled: isBusy }}
                style={styles.propertyRow}
                activeOpacity={0.7}
                onPress={() => openInlineEditor('status')}
              >
                <View style={styles.propertyIcon}><StatusIcon type={status} selected /></View>
                <View style={styles.propertyContent}>
                  <Text style={styles.propertyLabel}>Estado</Text>
                  <Text style={[styles.propertyText, { color: colors.selectionText }]}>{STATUS_OPTIONS.find((item) => item.id === status)?.label}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.selectorRow, styles.statusSelectorRow]}>
                {STATUS_OPTIONS.map((item) => {
                  const selected = item.id === status;

                  return (
                    <TouchableOpacity
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isBusy, selected: selected }}
                      accessibilityLabel={item.label}
                      key={item.id}
                      activeOpacity={0.7}
                      style={[
                        styles.selectorItem,

                        selected && styles.selectorItemSelected,
                      ]}
                      onPress={() => {
                        closeInlineEditor();

                        setStatus(item.id);
                      }}
                    >
                      <StatusIcon type={item.id} selected={selected} />

                      {selected && (
                        <Text
                          style={[
                            styles.selectorLabel,
                            styles.statusSelectorLabel,
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* REPEAT */}

            {!isEditingRepeat ? (
              <TouchableOpacity
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy }}
                style={styles.propertyRow}
                accessibilityLabel="Editar repetição"
                activeOpacity={0.7}
                onPress={() => {
                  openInlineEditor('repeat');
                }}
              >
                <Ionicons
                  name="repeat-outline"
                  style={styles.propertyIcon}
                  size={20}
                  color={colors.textMuted}
                />

                <View style={styles.propertyContent}>
                  <Text style={styles.propertyLabel}>Repetição</Text>
                  <Text style={[styles.propertyText, repeat === 'never' && styles.neutralText]}>
                    {REPEAT_LABELS[repeat]}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.repeatEditor}>
                <View style={styles.repeatEditorHeader}>
                  <Ionicons
                    name="repeat-outline"
                    size={20}
                    color={colors.textMuted}
                  />
                </View>

                <View style={styles.repeatOptionsRow}>
                  {REPEAT_OPTIONS.map((item) => {
                    const selected = item === repeat;

                    return (
                      <TouchableOpacity
                        disabled={isBusy}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isBusy, selected: selected }}
                        key={item}
                        style={[
                          styles.repeatOption,

                          selected && styles.repeatOptionSelected,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setRepeat(item);

                          setActiveField(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.repeatOptionText,

                            selected && styles.repeatOptionTextSelected,
                          ]}
                        >
                          {REPEAT_LABELS[item]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* NOTES */}

            {activeField !== 'notes' ? (
              <TouchableOpacity
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Editar notas"
                accessibilityState={{ disabled: isBusy }}
                style={styles.propertyRow}
                activeOpacity={0.7}
                onPress={() => openInlineEditor('notes')}
              >
                <Ionicons name="document-text-outline" size={20} color={colors.textMuted} style={styles.propertyIcon} />
                <View style={styles.propertyContent}>
                  <Text style={styles.propertyLabel}>Notas</Text>
                  <Text style={[styles.propertyText, !notes && styles.neutralText]}>
                    {notes || 'Adicionar notas…'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.propertyRow}>
                <Ionicons name="document-text-outline" size={20} color={colors.textMuted} style={styles.propertyIcon} />
                <View style={styles.propertyContent}>
                  <Text style={styles.propertyLabel}>Notas</Text>
                  <TextInput
                    editable={!isBusy}
                    accessibilityLabel="Notas"
                    style={styles.notesInput}
                    value={notes}
                    onBlur={() => setActiveField((field) => field === 'notes' ? null : field)}
                    onChangeText={setNotes}
                    multiline
                    autoFocus
                    placeholder="Adicionar notas..."
                    placeholderTextColor={colors.textFaint}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            )}

            {/* DELETE */}

            {isEdit && onDelete && (
              <TouchableOpacity
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy, busy: isDeleting }}
                accessibilityLabel={isDeleting ? 'A apagar tarefa' : 'Apagar tarefa'}
                style={styles.deleteTaskButton}
                activeOpacity={0.7}
                onPress={handleDelete}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={colors.danger}
                />

                <Text style={styles.deleteTaskText}>{isDeleting ? 'A apagar…' : 'Apagar tarefa'}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Animated.View>
      </View>
  );
  if (embedded) return visible ? content : null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismissDetails} statusBarTranslucent>
      {content}
    </Modal>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */

const createStyles = (colors) => {
  const sheetStyles = createTaskSheetStyles(colors);
  return StyleSheet.create({
  overlay: sheetStyles.overlay,

  backdrop: sheetStyles.backdrop,

  sheet: { ...sheetStyles.surface, position: 'absolute', left: 0, right: 0 },

  topBar: sheetStyles.topBar,

  dragZone: sheetStyles.dragZone,

  handle: sheetStyles.handle,

  saveIconButton: {
    ...sheetStyles.button,
    position: 'absolute',

    right: 14,

    top: 0,

    width: 44,

    borderRadius: 17,
  },

  saveIconButtonDisabled: {
    opacity: 0.35,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    ...sheetStyles.content,

    paddingTop: 2,

    paddingBottom: Platform.OS === 'ios' ? 40 : 56,
  },

  propertyRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  propertyIcon: { width: 24, alignItems: 'center', textAlign: 'center' },
  propertyContent: { flex: 1, minWidth: 0 },
  propertyLabel: { fontSize: 11, lineHeight: 16, color: colors.textMuted },
  propertyText: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: colors.text },
  neutralText: { color: colors.textMuted, fontWeight: '400' },
  propertyTouch: { minHeight: 44, justifyContent: 'center' },
  stickyTitle: { paddingHorizontal: 18 },
  scheduleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  scheduleDurationEditing: { maxWidth: '100%', flexShrink: 1 },
  scheduleItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },

  /* TITLE */

  titleRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,
  },

  titleCategoryIcon: {
    flexShrink: 0,
  },

  titleInput: {
    height: 42,

    borderRadius: 8,

    backgroundColor: colors.surfaceSoft,

    paddingHorizontal: 11,

    fontSize: 15,

    fontWeight: '500',

    color: colors.text,
  },

  editTitleTouch: {
    flex: 1,

    minHeight: 48,

    justifyContent: 'center',

    paddingVertical: 3,
  },

  editTitle: {
    fontSize: 24,

    lineHeight: 30,

    fontWeight: '700',

    color: colors.text,
  },

  editTitleInput: {
    flex: 1,

    minWidth: 0,

    fontSize: 20,

    fontWeight: '700',

    color: colors.text,
  },

  /* SCHEDULE */

  scheduleArea: {
    marginTop: 11,

    minHeight: 36,

    justifyContent: 'center',
  },


  inlineDateText: {
    fontSize: 14,

    lineHeight: 20,

    fontWeight: '700',

    color: colors.selection,
  },

  inlineTimeText: {
    fontSize: 14,

    lineHeight: 20,

    fontWeight: '600',

    color: colors.text,
  },

  inlineDurationText: {
    fontSize: 13,

    lineHeight: 20,

    fontWeight: '700',

    color: colors.selectionText,
  },

  inlineDateInput: {
    width: 104,

    minHeight: 44,

    paddingHorizontal: 7,

    paddingVertical: 4,

    borderBottomWidth: 1,

    borderBottomColor: colors.selection,

    fontSize: 14,

    fontWeight: '600',

    color: colors.text,
  },

  inlineTimeEditor: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 5,
  },

  inlineTimeInput: {
    width: 54,

    minHeight: 44,

    paddingHorizontal: 4,

    paddingVertical: 4,

    borderBottomWidth: 1,

    borderBottomColor: colors.selection,

    textAlign: 'center',

    fontSize: 14,

    fontWeight: '600',

    color: colors.text,
  },

  inlineArrow: {
    fontSize: 14,

    color: colors.textMuted,
  },

  inlineDurationEditor: {
    flexDirection: 'row',

    alignItems: 'center',

    flexWrap: 'wrap',

    gap: 6,
  },

  inlineDurationPreset: {
    minHeight: 44,

    paddingHorizontal: 9,

    borderRadius: 8,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: colors.surfaceSoft,

    borderWidth: StyleSheet.hairlineWidth,

    borderColor: colors.border,
  },

  inlineDurationPresetSelected: {
    backgroundColor: colors.selectionSoft,
    borderColor: colors.selection,
  },

  inlineDurationPresetText: {
    fontSize: 11,

    fontWeight: '500',

    color: colors.textMuted,
  },

  inlineDurationPresetTextSelected: {
    fontWeight: '700',

    color: colors.selectionText,
  },

  inlineCustomDuration: {
    width: 70,

    minHeight: 44,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 7,

    borderRadius: 8,

    backgroundColor: colors.surfaceSoft,

    borderWidth: StyleSheet.hairlineWidth,

    borderColor: colors.border,
  },

  inlineCustomDurationInput: {
    width: 36,
    minHeight: 44,
    padding: 0,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  inlineCustomDurationUnit: {
    marginLeft: 2,
    fontSize: 9,
    color: colors.textMuted,
  },

  /* POSTPONE */

  postponeRow: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },

  postponeButton: {
    minHeight: 44,
    flex: 1,
    paddingHorizontal: 4,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },

  postponeButtonSelected: {
    backgroundColor: colors.selectionSoft,

    borderColor: colors.selection,
  },

  postponeButtonText: {
    fontSize: 12,

    fontWeight: '700',

    color: colors.text,
  },

  postponeButtonTextSelected: {
    fontWeight: '700',

    color: colors.selectionText,
  },

  /* SECTIONS */

  /* CATEGORY + STATUS */

  selectorRow: {
    minHeight: 52,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,
    flexWrap: 'wrap',
  },

  selectorItem: {
    minWidth: 44,

    height: 44,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    paddingHorizontal: 4,

    borderRadius: 14,
  },

  selectorItemSelected: {
    height: 46,

    paddingHorizontal: 16,

    backgroundColor: colors.surfaceSoft,

    borderRadius: 15,
  },

  selectorLabel: {
    maxWidth: 92,

    fontSize: 13,

    fontWeight: '700',
  },

  statusSelectorRow: {
    gap: 10,
  },

  statusSelectorLabel: {
    color: colors.selectionText,
  },

  /* STATUS ICONS */

  statusIconSquare: {
    width: 21,

    height: 21,

    borderRadius: 4,

    borderWidth: 1.5,

    borderColor: colors.textMuted,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: 'transparent',
  },

  statusIconSquareSelected: {
    width: 23,

    height: 23,

    borderColor: colors.selectionText,
  },

  /* REPEAT */

  repeatEditor: {
    gap: 8,
  },

  repeatEditorHeader: {
    minHeight: 24,

    flexDirection: 'row',

    alignItems: 'center',
  },

  repeatOptionsRow: {
    flexDirection: 'row',

    alignItems: 'center',

    flexWrap: 'wrap',

    gap: 7,
  },

  repeatOption: {
    minHeight: 44,

    paddingHorizontal: 11,

    borderRadius: 10,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: colors.surfaceSoft,
  },

  repeatOptionSelected: {
    backgroundColor: colors.selectionSoft,
  },

  repeatOptionText: {
    fontSize: 12,

    fontWeight: '600',

    color: colors.textSecondary,
  },

  repeatOptionTextSelected: {
    color: colors.selectionText,

    fontWeight: '700',
  },

  /* NOTES */

  notesInput: {
    minHeight: 68,

    maxHeight: 120,

    borderRadius: 10,

    backgroundColor: colors.surfaceSoft,

    paddingHorizontal: 11,

    paddingVertical: 9,

    fontSize: 14,

    color: colors.text,
  },

  /* DELETE */

  deleteTaskButton: {
    alignSelf: 'flex-start',

    marginTop: 20,

    minHeight: 44,

    paddingHorizontal: 10,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 7,

    borderRadius: 8,
  },

  deleteTaskText: {
    fontSize: 13,

    fontWeight: '600',

    color: colors.danger,
  },

  /* PRIORITY */

  priorityOptionsRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  });
};
