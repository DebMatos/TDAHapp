import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

import colors from '../../theme/colors';

const DAY_MINUTES = 24 * 60;

const SCREEN_HEIGHT =
  Dimensions.get('window').height;

const NORMAL_SHEET_HEIGHT =
  Math.round(
    SCREEN_HEIGHT * 0.78
  );

const EXPANDED_SHEET_HEIGHT =
  Math.round(
    SCREEN_HEIGHT * 0.94
  );

const MIN_SHEET_HEIGHT = 260;

const DURATION_PRESETS = [
  15,
  30,
  60,
];

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

const REPEAT_OPTIONS = [
  'Nunca',
  'Todos os dias',
  'Dias úteis',
  'Todas as semanas',
];

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

const CATEGORY_OPTIONS = [
  {
    id: 'inbox',
    label: 'Caixa de Entrada',
    icon: 'archive-outline',
    color: colors.categoryInbox,
  },
  {
    id: 'work',
    label: 'Trabalho',
    icon: 'briefcase-outline',
    color: colors.categoryWork,
  },
  {
    id: 'personal',
    label: 'Pessoal',
    icon: 'home-outline',
    color: colors.categoryPersonal,
  },
  {
    id: 'exercise',
    label: 'Exercício',
    icon: 'barbell-outline',
    color: colors.categoryExercise,
  },
  {
    id: 'shopping',
    label: 'Compras',
    icon: 'cube-outline',
    color: colors.categoryShopping,
  },
];

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

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

const normalizeMinutes = (
  minutes
) =>
  ((minutes % DAY_MINUTES) +
    DAY_MINUTES) %
  DAY_MINUTES;

const formatTime = (
  minutes
) => {
  const normalized =
    normalizeMinutes(
      minutes
    );

  const hours =
    Math.floor(
      normalized / 60
    );

  const mins =
    normalized % 60;

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

const parseTime = (
  value,
  fallback = 7 * 60
) => {
  if (
    !value ||
    !value.includes(':')
  ) {
    return fallback;
  }

  const [
    hours,
    minutes,
  ] =
    value
      .split(':')
      .map(Number);

  if (
    Number.isNaN(
      hours
    ) ||
    Number.isNaN(
      minutes
    )
  ) {
    return fallback;
  }

  return normalizeMinutes(
    hours * 60 +
      minutes
  );
};

const formatDuration = (
  minutes
) => {
  if (
    minutes < 60
  ) {
    return `${minutes} min`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const mins =
    minutes % 60;

  if (
    mins === 0
  ) {
    return `${hours} h`;
  }

  return `${hours} h ${mins} min`;
};

/* -------------------------------------------------------
   TIME
------------------------------------------------------- */

const formatTimeInput = (
  value
) => {
  const digits =
    value
      .replace(
        /\D/g,
        ''
      )
      .slice(
        0,
        4
      );

  if (
    digits.length <= 2
  ) {
    return digits;
  }

  return `${digits.slice(
    0,
    2
  )}:${digits.slice(2)}`;
};

const isValidTime = (
  value
) => {
  if (
    !/^\d{2}:\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const [
    hours,
    minutes,
  ] =
    value
      .split(':')
      .map(Number);

  return (
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );
};

/* -------------------------------------------------------
   DATE
------------------------------------------------------- */

const formatDateForInput = (
  date
) => {
  const d =
    date instanceof Date
      ? date
      : new Date(date);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return '';
  }

  const day =
    String(
      d.getDate()
    ).padStart(
      2,
      '0'
    );

  const month =
    String(
      d.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const year =
    d.getFullYear();

  return `${day}/${month}/${year}`;
};

const getTodayDateInput =
  () =>
    formatDateForInput(
      new Date()
    );

const formatDateInput = (
  value
) => {
  const digits =
    value
      .replace(
        /\D/g,
        ''
      )
      .slice(
        0,
        8
      );

  if (
    digits.length <= 2
  ) {
    return digits;
  }

  if (
    digits.length <= 4
  ) {
    return `${digits.slice(
      0,
      2
    )}/${digits.slice(2)}`;
  }

  return `${digits.slice(
    0,
    2
  )}/${digits.slice(
    2,
    4
  )}/${digits.slice(4)}`;
};

const isValidDateInput = (
  value
) => {
  if (
    !/^\d{2}\/\d{2}\/\d{4}$/.test(
      value
    )
  ) {
    return false;
  }

  const [
    day,
    month,
    year,
  ] =
    value
      .split('/')
      .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  return (
    date.getFullYear() ===
      year &&
    date.getMonth() ===
      month - 1 &&
    date.getDate() ===
      day
  );
};

const parseDateInput = (
  value
) => {
  if (
    !isValidDateInput(
      value
    )
  ) {
    return null;
  }

  const [
    day,
    month,
    year,
  ] =
    value
      .split('/')
      .map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
};

const addDaysToDateInput = (
  value,
  days
) => {
  const date =
    parseDateInput(
      value
    );

  if (!date) {
    return value;
  }

  date.setDate(
    date.getDate() +
      days
  );

  return formatDateForInput(
    date
  );
};

const getDateDisplayLabel = (
  value
) => {
  if (
    value ===
    getTodayDateInput()
  ) {
    return 'Hoje';
  }

  const tomorrow =
    addDaysToDateInput(
      getTodayDateInput(),
      1
    );

  if (
    value ===
    tomorrow
  ) {
    return 'Amanhã';
  }

  return value;
};

/* -------------------------------------------------------
   STATUS
------------------------------------------------------- */

function StatusSquare({
  type,
  selected,
}) {
  return (
    <View
      style={[
        styles.statusSquare,

        selected &&
          styles.statusSquareSelected,
      ]}
    >
      <View
        style={[
          styles.statusInnerSquare,

          selected &&
            styles.statusInnerSquareSelected,
        ]}
      >
        {type ===
          'completed' && (
          <Ionicons
            name="checkmark"
            size={15}
            color={
              selected
                ? colors.selection
                : colors.textMuted
            }
          />
        )}

        {type ===
          'abandoned' && (
          <Ionicons
            name="close"
            size={16}
            color={
              selected
                ? colors.selection
                : colors.textMuted
            }
          />
        )}
      </View>
    </View>
  );
}

/* -------------------------------------------------------
   COMPONENT
------------------------------------------------------- */

export default function TaskDetailsModal({
  visible,
  mode = 'create',
  initialValues = null,
  onClose,
  onSave,
  onDelete,
}) {
  const isEdit =
    mode === 'edit';

  /* -------------------------------------------------------
     TITLE
  ------------------------------------------------------- */

  const [
    title,
    setTitle,
  ] =
    useState('');

  const [
    isEditingTitle,
    setIsEditingTitle,
  ] =
    useState(false);

  /* -------------------------------------------------------
     SCHEDULE
  ------------------------------------------------------- */

  const [
    dateValue,
    setDateValue,
  ] =
    useState(
      getTodayDateInput()
    );

  const [
    startTime,
    setStartTime,
  ] =
    useState(
      '07:00'
    );

  const [
    endTime,
    setEndTime,
  ] =
    useState(
      '07:30'
    );

  const [
    duration,
    setDuration,
  ] =
    useState(30);

  const [
    customDuration,
    setCustomDuration,
  ] =
    useState('');

  const [
    activeScheduleField,
    setActiveScheduleField,
  ] =
    useState(null);

  const [
    postponeSelection,
    setPostponeSelection,
  ] =
    useState(null);

  /* -------------------------------------------------------
     META
  ------------------------------------------------------- */

  const [
    categoryId,
    setCategoryId,
  ] =
    useState(
      'inbox'
    );

  const [
    status,
    setStatus,
  ] =
    useState(
      'pending'
    );

  const [
    repeat,
    setRepeat,
  ] =
    useState(
      'Nunca'
    );

  const [
    notes,
    setNotes,
  ] =
    useState('');

  /* -------------------------------------------------------
     DIRTY STATE
  ------------------------------------------------------- */

  const [
    savedSnapshot,
    setSavedSnapshot,
  ] =
    useState(null);

  /* -------------------------------------------------------
     PICKERS
  ------------------------------------------------------- */

  const [
    categoryPickerVisible,
    setCategoryPickerVisible,
  ] =
    useState(false);

  const [
    repeatPickerVisible,
    setRepeatPickerVisible,
  ] =
    useState(false);

  /* -------------------------------------------------------
     SHEET
  ------------------------------------------------------- */

  const [
    isExpanded,
    setIsExpanded,
  ] =
    useState(false);

  const [
    keyboardHeight,
    setKeyboardHeight,
  ] =
    useState(0);

  const titleInputRef =
    useRef(null);

  const dateInputRef =
    useRef(null);

  const startInputRef =
    useRef(null);

  const scrollRef =
    useRef(null);

  const scheduleBaseRef =
    useRef({
      date:
        getTodayDateInput(),

      startTime:
        '07:00',
    });

  const sheetHeight =
    useRef(
      new Animated.Value(
        NORMAL_SHEET_HEIGHT
      )
    ).current;

  const sheetBottom =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const dragStartHeightRef =
    useRef(
      NORMAL_SHEET_HEIGHT
    );

  /* -------------------------------------------------------
     SELECTED
  ------------------------------------------------------- */

  const selectedCategory =
    useMemo(
      () =>
        CATEGORY_OPTIONS.find(
          (item) =>
            item.id ===
            categoryId
        ) ||
        CATEGORY_OPTIONS[0],
      [categoryId]
    );

  const selectedStatus =
    useMemo(
      () =>
        STATUS_OPTIONS.find(
          (item) =>
            item.id ===
            status
        ) ||
        STATUS_OPTIONS[0],
      [status]
    );

  /* -------------------------------------------------------
     CURRENT SNAPSHOT / DIRTY
  ------------------------------------------------------- */

  const currentSnapshot =
    useMemo(
      () =>
        JSON.stringify({
          title:
            title.trim(),

          date:
            dateValue,

          startTime,

          endTime,

          duration,

          categoryId,

          status,

          repeat,

          notes:
            notes.trim(),
        }),
      [
        title,
        dateValue,
        startTime,
        endTime,
        duration,
        categoryId,
        status,
        repeat,
        notes,
      ]
    );

  const canSave =
    title.trim().length >
      0 &&
    isValidDateInput(
      dateValue
    ) &&
    isValidTime(
      startTime
    ) &&
    isValidTime(
      endTime
    );

  const isDirty =
    savedSnapshot !== null &&
    currentSnapshot !==
      savedSnapshot;

  const saveIconColor =
    !canSave
      ? colors.textFaint
      : isDirty
        ? colors.categoryWork
        : colors.textMuted;

  /* -------------------------------------------------------
     SHEET GEOMETRY
  ------------------------------------------------------- */

  const animateGeometry = (
    baseHeight,
    bottomValue
  ) => {
    const height =
      Math.max(
        MIN_SHEET_HEIGHT,

        baseHeight -
          bottomValue
      );

    Animated.parallel([
      Animated.spring(
        sheetHeight,
        {
          toValue:
            height,

          useNativeDriver:
            false,

          tension:
            70,

          friction:
            11,
        }
      ),

      Animated.spring(
        sheetBottom,
        {
          toValue:
            bottomValue,

          useNativeDriver:
            false,

          tension:
            70,

          friction:
            11,
        }
      ),
    ]).start();
  };

  const animateSheetTo = (
    expanded
  ) => {
    const baseHeight =
      expanded
        ? EXPANDED_SHEET_HEIGHT
        : NORMAL_SHEET_HEIGHT;

    setIsExpanded(
      expanded
    );

    animateGeometry(
      baseHeight,
      keyboardHeight
    );
  };

  const closeFromDrag =
    () => {
      Animated.parallel([
        Animated.timing(
          sheetHeight,
          {
            toValue:
              0,

            duration:
              180,

            useNativeDriver:
              false,
          }
        ),

        Animated.timing(
          sheetBottom,
          {
            toValue:
              0,

            duration:
              180,

            useNativeDriver:
              false,
          }
        ),
      ]).start(
        () => {
          sheetHeight.setValue(
            NORMAL_SHEET_HEIGHT
          );

          sheetBottom.setValue(
            0
          );

          setIsExpanded(
            false
          );

          setKeyboardHeight(
            0
          );

          onClose?.();
        }
      );
    };

  /* -------------------------------------------------------
     DRAG
  ------------------------------------------------------- */

  const sheetPanResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () =>
              keyboardHeight ===
              0,

          onMoveShouldSetPanResponder:
            (
              _,
              gesture
            ) =>
              keyboardHeight ===
                0 &&
              Math.abs(
                gesture.dy
              ) >
                3,

          onPanResponderGrant:
            () => {
              dragStartHeightRef.current =
                isExpanded
                  ? EXPANDED_SHEET_HEIGHT
                  : NORMAL_SHEET_HEIGHT;
            },

          onPanResponderMove:
            (
              _,
              gesture
            ) => {
              const nextHeight =
                clamp(
                  dragStartHeightRef.current -
                    gesture.dy,

                  MIN_SHEET_HEIGHT,

                  EXPANDED_SHEET_HEIGHT
                );

              sheetHeight.setValue(
                nextHeight
              );
            },

          onPanResponderRelease:
            (
              _,
              gesture
            ) => {
              const draggedUp =
                gesture.dy <
                  -45 ||
                gesture.vy <
                  -0.55;

              const draggedDown =
                gesture.dy >
                  55 ||
                gesture.vy >
                  0.65;

              if (
                !isExpanded
              ) {
                if (
                  draggedUp
                ) {
                  animateSheetTo(
                    true
                  );

                  return;
                }

                if (
                  draggedDown
                ) {
                  closeFromDrag();

                  return;
                }

                animateSheetTo(
                  false
                );

                return;
              }

              if (
                draggedDown
              ) {
                animateSheetTo(
                  false
                );

                return;
              }

              animateSheetTo(
                true
              );
            },

          onPanResponderTerminate:
            () => {
              animateSheetTo(
                isExpanded
              );
            },
        }),
      [
        isExpanded,
        keyboardHeight,
        sheetHeight,
      ]
    );

  /* -------------------------------------------------------
     KEYBOARD
  ------------------------------------------------------- */

  useEffect(() => {
    if (
      !visible
    ) {
      return;
    }

    const showEvent =
      Platform.OS ===
      'ios'
        ? 'keyboardWillShow'
        : 'keyboardDidShow';

    const hideEvent =
      Platform.OS ===
      'ios'
        ? 'keyboardWillHide'
        : 'keyboardDidHide';

    const showSub =
      Keyboard.addListener(
        showEvent,
        (
          event
        ) => {
          const height =
            event
              .endCoordinates
              ?.height ||
            0;

          setKeyboardHeight(
            height
          );

          const baseHeight =
            isExpanded
              ? EXPANDED_SHEET_HEIGHT
              : NORMAL_SHEET_HEIGHT;

          animateGeometry(
            baseHeight,
            height
          );

          if (
            isEditingTitle
          ) {
            requestAnimationFrame(
              () => {
                scrollRef.current?.scrollTo(
                  {
                    y:
                      0,

                    animated:
                      false,
                  }
                );
              }
            );
          }
        }
      );

    const hideSub =
      Keyboard.addListener(
        hideEvent,
        () => {
          setKeyboardHeight(
            0
          );

          const baseHeight =
            isExpanded
              ? EXPANDED_SHEET_HEIGHT
              : NORMAL_SHEET_HEIGHT;

          animateGeometry(
            baseHeight,
            0
          );
        }
      );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [
    visible,
    isExpanded,
    isEditingTitle,
  ]);

  /* -------------------------------------------------------
     TITLE FOCUS
  ------------------------------------------------------- */

  useEffect(() => {
    if (
      !isEdit ||
      !isEditingTitle
    ) {
      return;
    }

    scrollRef.current?.scrollTo({
      y:
        0,

      animated:
        false,
    });

    const timer =
      setTimeout(
        () => {
          titleInputRef.current?.focus();
        },
        80
      );

    return () =>
      clearTimeout(
        timer
      );
  }, [
    isEdit,
    isEditingTitle,
  ]);

  /* -------------------------------------------------------
     INLINE FIELD FOCUS
  ------------------------------------------------------- */

  useEffect(() => {
    if (
      activeScheduleField ===
      'date'
    ) {
      const timer =
        setTimeout(
          () => {
            dateInputRef.current?.focus();
          },
          60
        );

      return () =>
        clearTimeout(
          timer
        );
    }

    if (
      activeScheduleField ===
      'time'
    ) {
      const timer =
        setTimeout(
          () => {
            startInputRef.current?.focus();
          },
          60
        );

      return () =>
        clearTimeout(
          timer
        );
    }

    return undefined;
  }, [
    activeScheduleField,
  ]);

  /* -------------------------------------------------------
     RESET
  ------------------------------------------------------- */

  useEffect(() => {
    if (
      !visible
    ) {
      return;
    }

    setIsEditingTitle(
      false
    );

    setActiveScheduleField(
      null
    );

    setPostponeSelection(
      null
    );

    setIsExpanded(
      false
    );

    setKeyboardHeight(
      0
    );

    setSavedSnapshot(
      null
    );

    sheetHeight.setValue(
      NORMAL_SHEET_HEIGHT
    );

    sheetBottom.setValue(
      0
    );
  }, [
    visible,
    sheetHeight,
    sheetBottom,
  ]);

  /* -------------------------------------------------------
     LOAD
  ------------------------------------------------------- */

  useEffect(() => {
    if (
      !visible
    ) {
      return;
    }

    const initialStart =
      initialValues?.timeOfDay ||
      (
        initialValues?.startMinsPlanned !=
        null
          ? formatTime(
              initialValues.startMinsPlanned
            )
          : '07:00'
      );

    const initialDuration =
      Math.max(
        1,

        Number(
          initialValues?.timeMinutes ??
            initialValues?.duration
        ) ||
          30
      );

    const startMinutes =
      parseTime(
        initialStart
      );

    const initialEnd =
      formatTime(
        startMinutes +
          initialDuration
      );

    const initialStatus =
      initialValues?.status ||
      (
        initialValues?.completed
          ? 'completed'
          : 'pending'
      );

    let initialDate =
      getTodayDateInput();

    if (
      initialValues?.date
    ) {
      if (
        /^\d{2}\/\d{2}\/\d{4}$/.test(
          initialValues.date
        )
      ) {
        initialDate =
          initialValues.date;
      } else {
        const formatted =
          formatDateForInput(
            initialValues.date
          );

        if (
          formatted
        ) {
          initialDate =
            formatted;
        }
      }
    }

    const initialTitle =
      initialValues?.title ||
      '';

    const initialCategory =
      initialValues?.categoryId ||
      'inbox';

    const initialRepeat =
      initialValues?.repeat ||
      'Nunca';

    const initialNotes =
      initialValues?.notes ||
      initialValues?.description ||
      '';

    scheduleBaseRef.current = {
      date:
        initialDate,

      startTime:
        initialStart,
    };

    setTitle(
      initialTitle
    );

    setDateValue(
      initialDate
    );

    setStartTime(
      initialStart
    );

    setDuration(
      initialDuration
    );

    setEndTime(
      initialEnd
    );

    setCategoryId(
      initialCategory
    );

    setStatus(
      initialStatus
    );

    setRepeat(
      initialRepeat
    );

    setNotes(
      initialNotes
    );

    setPostponeSelection(
      null
    );

    setActiveScheduleField(
      null
    );

    if (
      DURATION_PRESETS.includes(
        initialDuration
      )
    ) {
      setCustomDuration(
        ''
      );
    } else {
      setCustomDuration(
        String(
          initialDuration
        )
      );
    }

    setSavedSnapshot(
      JSON.stringify({
        title:
          initialTitle.trim(),

        date:
          initialDate,

        startTime:
          initialStart,

        endTime:
          initialEnd,

        duration:
          initialDuration,

        categoryId:
          initialCategory,

        status:
          initialStatus,

        repeat:
          initialRepeat,

        notes:
          initialNotes.trim(),
      })
    );
  }, [
    visible,
    initialValues,
  ]);

  /* -------------------------------------------------------
     MANUAL SCHEDULE EDIT
  ------------------------------------------------------- */

  const commitManualScheduleBase =
    (
      nextDate =
        dateValue,

      nextStart =
        startTime
    ) => {
      if (
        isValidDateInput(
          nextDate
        ) &&
        isValidTime(
          nextStart
        )
      ) {
        scheduleBaseRef.current = {
          date:
            nextDate,

          startTime:
            nextStart,
        };

        setPostponeSelection(
          null
        );
      }
    };

  const updateDate = (
    value
  ) => {
    const formatted =
      formatDateInput(
        value
      );

    setDateValue(
      formatted
    );

    if (
      isValidDateInput(
        formatted
      )
    ) {
      commitManualScheduleBase(
        formatted,
        startTime
      );
    }
  };

  const updateStartTime = (
    value
  ) => {
    const formatted =
      formatTimeInput(
        value
      );

    setStartTime(
      formatted
    );

    if (
      !isValidTime(
        formatted
      )
    ) {
      return;
    }

    const startMinutes =
      parseTime(
        formatted
      );

    setEndTime(
      formatTime(
        startMinutes +
          duration
      )
    );

    commitManualScheduleBase(
      dateValue,
      formatted
    );
  };

  const updateEndTime = (
    value
  ) => {
    const formatted =
      formatTimeInput(
        value
      );

    setEndTime(
      formatted
    );

    if (
      !isValidTime(
        formatted
      ) ||
      !isValidTime(
        startTime
      )
    ) {
      return;
    }

    const startMinutes =
      parseTime(
        startTime
      );

    let endMinutes =
      parseTime(
        formatted
      );

    if (
      endMinutes <=
      startMinutes
    ) {
      endMinutes +=
        DAY_MINUTES;
    }

    const nextDuration =
      Math.max(
        1,

        endMinutes -
          startMinutes
      );

    setDuration(
      nextDuration
    );

    if (
      DURATION_PRESETS.includes(
        nextDuration
      )
    ) {
      setCustomDuration(
        ''
      );
    } else {
      setCustomDuration(
        String(
          nextDuration
        )
      );
    }
  };

  const updateDuration = (
    value
  ) => {
    const safeValue =
      Math.max(
        1,

        Number(
          value
        ) ||
          1
      );

    setDuration(
      safeValue
    );

    if (
      !isValidTime(
        startTime
      )
    ) {
      return;
    }

    const startMinutes =
      parseTime(
        startTime
      );

    setEndTime(
      formatTime(
        startMinutes +
          safeValue
      )
    );
  };

  const handlePresetDuration =
    (
      preset
    ) => {
      setCustomDuration(
        ''
      );

      updateDuration(
        preset
      );

      setActiveScheduleField(
        null
      );

      Keyboard.dismiss();
    };

  const handleCustomDuration =
    (
      value
    ) => {
      const digits =
        value
          .replace(
            /\D/g,
            ''
          )
          .slice(
            0,
            4
          );

      setCustomDuration(
        digits
      );

      if (
        !digits
      ) {
        return;
      }

      updateDuration(
        Number(
          digits
        )
      );
    };

  /* -------------------------------------------------------
     POSTPONE
  ------------------------------------------------------- */

  const restoreScheduleBase =
    () => {
      const base =
        scheduleBaseRef.current;

      const baseStart =
        parseTime(
          base.startTime
        );

      setDateValue(
        base.date
      );

      setStartTime(
        base.startTime
      );

      setEndTime(
        formatTime(
          baseStart +
            duration
        )
      );

      setPostponeSelection(
        null
      );
    };

  const selectPostponeMinutes =
    (
      option
    ) => {
      setActiveScheduleField(
        null
      );

      Keyboard.dismiss();

      if (
        postponeSelection ===
        option.id
      ) {
        restoreScheduleBase();

        return;
      }

      const base =
        scheduleBaseRef.current;

      if (
        !isValidDateInput(
          base.date
        ) ||
        !isValidTime(
          base.startTime
        )
      ) {
        return;
      }

      const baseStart =
        parseTime(
          base.startTime
        );

      const rawStart =
        baseStart +
        option.minutes;

      const dayOffset =
        Math.floor(
          rawStart /
            DAY_MINUTES
        );

      const nextStart =
        normalizeMinutes(
          rawStart
        );

      setDateValue(
        addDaysToDateInput(
          base.date,
          dayOffset
        )
      );

      setStartTime(
        formatTime(
          nextStart
        )
      );

      setEndTime(
        formatTime(
          nextStart +
            duration
        )
      );

      setPostponeSelection(
        option.id
      );
    };

  const selectPostponeTomorrow =
    () => {
      setActiveScheduleField(
        null
      );

      Keyboard.dismiss();

      const id =
        'tomorrow';

      if (
        postponeSelection ===
        id
      ) {
        restoreScheduleBase();

        return;
      }

      const base =
        scheduleBaseRef.current;

      if (
        !isValidDateInput(
          base.date
        ) ||
        !isValidTime(
          base.startTime
        )
      ) {
        return;
      }

      const baseStart =
        parseTime(
          base.startTime
        );

      setDateValue(
        addDaysToDateInput(
          base.date,
          1
        )
      );

      setStartTime(
        base.startTime
      );

      setEndTime(
        formatTime(
          baseStart +
            duration
        )
      );

      setPostponeSelection(
        id
      );
    };

  /* -------------------------------------------------------
     SAVE
  ------------------------------------------------------- */

  const handleSave =
    () => {
      if (
        !canSave
      ) {
        return;
      }

      const startMinutes =
        parseTime(
          startTime
        );

      setSavedSnapshot(
        currentSnapshot
      );

      onSave({
        title:
          title.trim(),

        date:
          dateValue,

        startMinsPlanned:
          startMinutes,

        timeOfDay:
          formatTime(
            startMinutes
          ),

        timeMinutes:
          duration,

        duration,

        categoryId,

        notes:
          notes.trim(),

        description:
          notes.trim(),

        repeat,

        status,

        completed:
          status ===
          'completed',
      });
    };

  /* -------------------------------------------------------
     CLOSE INLINE EDIT
  ------------------------------------------------------- */

  const closeInlineEditor =
    () => {
      if (
        activeScheduleField
      ) {
        setActiveScheduleField(
          null
        );

        Keyboard.dismiss();
      }
    };

  /* -------------------------------------------------------
     INLINE SCHEDULE
  ------------------------------------------------------- */

  const renderScheduleLine =
    () => {
      const dateContent =
        activeScheduleField ===
        'date' ? (
          <TextInput
            ref={
              dateInputRef
            }
            style={
              styles.inlineDateInput
            }
            value={
              dateValue
            }
            onChangeText={
              updateDate
            }
            keyboardType="number-pad"
            maxLength={
              10
            }
            onBlur={() =>
              setActiveScheduleField(
                null
              )
            }
          />
        ) : (
          <TouchableOpacity
            activeOpacity={
              0.65
            }
            onPress={() => {
              Keyboard.dismiss();

              setActiveScheduleField(
                'date'
              );
            }}
          >
            <Text
              style={
                styles.inlineDateText
              }
            >
              {getDateDisplayLabel(
                dateValue
              )}
            </Text>
          </TouchableOpacity>
        );

      const timeContent =
        activeScheduleField ===
        'time' ? (
          <View
            style={
              styles.inlineTimeEditor
            }
          >
            <TextInput
              ref={
                startInputRef
              }
              style={
                styles.inlineTimeInput
              }
              value={
                startTime
              }
              onChangeText={
                updateStartTime
              }
              keyboardType="number-pad"
              maxLength={
                5
              }
            />

            <Text
              style={
                styles.inlineArrow
              }
            >
              →
            </Text>

            <TextInput
              style={
                styles.inlineTimeInput
              }
              value={
                endTime
              }
              onChangeText={
                updateEndTime
              }
              keyboardType="number-pad"
              maxLength={
                5
              }
              onSubmitEditing={() =>
                setActiveScheduleField(
                  null
                )
              }
            />
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={
              0.65
            }
            onPress={() => {
              Keyboard.dismiss();

              setActiveScheduleField(
                'time'
              );
            }}
          >
            <Text
              style={
                styles.inlineTimeText
              }
            >
              {startTime}
              {'  →  '}
              {endTime}
            </Text>
          </TouchableOpacity>
        );

      const durationContent =
        activeScheduleField ===
        'duration' ? (
          <View
            style={
              styles.inlineDurationEditor
            }
          >
            {DURATION_PRESETS.map(
              (
                preset
              ) => {
                const selected =
                  duration ===
                    preset &&
                  customDuration ===
                    '';

                return (
                  <TouchableOpacity
                    key={
                      preset
                    }
                    style={[
                      styles.inlineDurationPreset,

                      selected &&
                        styles.inlineDurationPresetSelected,
                    ]}
                    activeOpacity={
                      0.7
                    }
                    onPress={() =>
                      handlePresetDuration(
                        preset
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.inlineDurationPresetText,

                        selected &&
                          styles.inlineDurationPresetTextSelected,
                      ]}
                    >
                      {preset ===
                      60
                        ? '1 h'
                        : `${preset} min`}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}

            <View
              style={
                styles.inlineCustomDuration
              }
            >
              <TextInput
                style={
                  styles.inlineCustomDurationInput
                }
                value={
                  customDuration
                }
                onChangeText={
                  handleCustomDuration
                }
                keyboardType="number-pad"
                maxLength={
                  4
                }
                placeholder="45"
                placeholderTextColor={
                  colors.textFaint
                }
                onBlur={() => {
                  setActiveScheduleField(
                    null
                  );

                  Keyboard.dismiss();
                }}
                onSubmitEditing={() => {
                  setActiveScheduleField(
                    null
                  );

                  Keyboard.dismiss();
                }}
              />

              <Text
                style={
                  styles.inlineCustomDurationUnit
                }
              >
                min
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={
              0.65
            }
            onPress={() => {
              Keyboard.dismiss();

              setActiveScheduleField(
                'duration'
              );
            }}
          >
            <Text
              style={
                styles.inlineDurationText
              }
            >
              {formatDuration(
                duration
              )}
            </Text>
          </TouchableOpacity>
        );

      if (
        activeScheduleField ===
        'duration'
      ) {
        return (
          <View
            style={
              styles.scheduleBlock
            }
          >
            <View
              style={
                styles.scheduleLine
              }
            >
              {dateContent}

              <Text
                style={
                  styles.scheduleDot
                }
              >
                ·
              </Text>

              {timeContent}
            </View>

            {durationContent}
          </View>
        );
      }

      return (
        <View
          style={
            styles.scheduleLine
          }
        >
          {dateContent}

          <Text
            style={
              styles.scheduleDot
            }
          >
            ·
          </Text>

          {timeContent}

          <Text
            style={
              styles.scheduleDot
            }
          >
            ·
          </Text>

          {durationContent}
        </View>
      );
    };

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <>
      <Modal
        visible={
          visible
        }
        transparent
        animationType="fade"
        onRequestClose={
          onClose
        }
        statusBarTranslucent
      >
        <View
          style={
            styles.overlay
          }
        >
          <Pressable
            style={
              styles.backdrop
            }
            onPress={
              onClose
            }
          />

          <Animated.View
            style={[
              styles.sheet,

              {
                height:
                  sheetHeight,

                bottom:
                  sheetBottom,
              },
            ]}
          >
            {/* TOP BAR */}

            <View
              style={
                styles.topBar
              }
            >
              <View
                {...sheetPanResponder.panHandlers}
                style={
                  styles.dragZone
                }
              >
                <View
                  style={
                    styles.handle
                  }
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.saveIconButton,

                  !canSave &&
                    styles.saveIconButtonDisabled,
                ]}
                disabled={
                  !canSave
                }
                activeOpacity={
                  0.65
                }
                onPress={
                  handleSave
                }
              >
                <Ionicons
                  name="save-outline"
                  size={22}
                  color={
                    saveIconColor
                  }
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={
                scrollRef
              }
              style={
                styles.scroll
              }
              contentContainerStyle={
                styles.scrollContent
              }
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={
                closeInlineEditor
              }
            >
              {/* TITLE */}

              {isEdit ? (
                <View
                  style={
                    styles.titleRow
                  }
                >
                  <Ionicons
                    name={
                      selectedCategory.icon
                    }
                    size={24}
                    color={
                      selectedCategory.color
                    }
                    style={
                      styles.titleCategoryIcon
                    }
                  />

                  {isEditingTitle ? (
                    <TextInput
                      ref={
                        titleInputRef
                      }
                      style={[
                        styles.titleInput,
                        styles.editTitleInput,
                      ]}
                      value={
                        title
                      }
                      onChangeText={
                        setTitle
                      }
                      returnKeyType="done"
                      onBlur={() =>
                        setIsEditingTitle(
                          false
                        )
                      }
                      onSubmitEditing={() =>
                        setIsEditingTitle(
                          false
                        )
                      }
                      placeholder="O que vais fazer?"
                      placeholderTextColor={
                        colors.textFaint
                      }
                    />
                  ) : (
                    <TouchableOpacity
                      style={
                        styles.editTitleTouch
                      }
                      activeOpacity={
                        0.7
                      }
                      onPress={() => {
                        closeInlineEditor();

                        scrollRef.current?.scrollTo({
                          y:
                            0,

                          animated:
                            false,
                        });

                        setIsEditingTitle(
                          true
                        );
                      }}
                    >
                      <Text
                        style={
                          styles.editTitle
                        }
                        numberOfLines={
                          3
                        }
                      >
                        {title ||
                          'O que vais fazer?'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TextInput
                  style={
                    styles.titleInput
                  }
                  value={
                    title
                  }
                  onChangeText={
                    setTitle
                  }
                  placeholder="O que vais fazer?"
                  placeholderTextColor={
                    colors.textFaint
                  }
                  autoFocus
                />
              )}

              {/* SCHEDULE */}

              <View
                style={
                  styles.scheduleArea
                }
              >
                {renderScheduleLine()}
              </View>

              {/* POSTPONE */}

              {isEdit && (
                <>
                  <Text
                    style={
                      styles.postponeLabel
                    }
                  >
                    Adiar
                  </Text>

                  <View
                    style={
                      styles.postponeRow
                    }
                  >
                    {POSTPONE_OPTIONS.map(
                      (
                        option
                      ) => {
                        const selected =
                          postponeSelection ===
                          option.id;

                        return (
                          <TouchableOpacity
                            key={
                              option.id
                            }
                            style={[
                              styles.postponeButton,

                              selected &&
                                styles.postponeButtonSelected,
                            ]}
                            activeOpacity={
                              0.7
                            }
                            onPress={() => {
                              closeInlineEditor();

                              selectPostponeMinutes(
                                option
                              );
                            }}
                          >
                            <Text
                              style={[
                                styles.postponeButtonText,

                                selected &&
                                  styles.postponeButtonTextSelected,
                              ]}
                            >
                              {
                                option.label
                              }
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}

                    <TouchableOpacity
                      style={[
                        styles.postponeButton,

                        postponeSelection ===
                          'tomorrow' &&
                          styles.postponeButtonSelected,
                      ]}
                      activeOpacity={
                        0.7
                      }
                      onPress={() => {
                        closeInlineEditor();

                        selectPostponeTomorrow();
                      }}
                    >
                      <Ionicons
                        name="sunny-outline"
                        size={14}
                        color={
                          postponeSelection ===
                          'tomorrow'
                            ? colors.selection
                            : colors.textMuted
                        }
                      />

                      <Text
                        style={[
                          styles.postponeButtonText,

                          postponeSelection ===
                            'tomorrow' &&
                            styles.postponeButtonTextSelected,
                        ]}
                      >
                        Amanhã
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* CATEGORY */}

              <Text
                style={
                  styles.sectionLabel
                }
              >
                Categoria
              </Text>

              <TouchableOpacity
                style={
                  styles.singleOptionRow
                }
                activeOpacity={
                  0.7
                }
                onPress={() => {
                  closeInlineEditor();

                  setCategoryPickerVisible(
                    true
                  );
                }}
              >
                <View
                  style={
                    styles.optionLeft
                  }
                >
                  <Ionicons
                    name={
                      selectedCategory.icon
                    }
                    size={20}
                    color={
                      selectedCategory.color
                    }
                  />

                  <Text
                    style={
                      styles.optionText
                    }
                  >
                    {
                      selectedCategory.label
                    }
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={
                    colors.textFaint
                  }
                />
              </TouchableOpacity>

              {/* STATUS */}

              <Text
                style={
                  styles.sectionLabel
                }
              >
                Estado
              </Text>

              <View
                style={
                  styles.statusRow
                }
              >
                <View
                  style={
                    styles.statusIcons
                  }
                >
                  {STATUS_OPTIONS.map(
                    (
                      item
                    ) => {
                      const selected =
                        status ===
                        item.id;

                      return (
                        <TouchableOpacity
                          key={
                            item.id
                          }
                          style={
                            styles.statusButton
                          }
                          activeOpacity={
                            0.7
                          }
                          onPress={() => {
                            closeInlineEditor();

                            setStatus(
                              item.id
                            );
                          }}
                        >
                          <StatusSquare
                            type={
                              item.id
                            }
                            selected={
                              selected
                            }
                          />
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                <Text
                  style={
                    styles.selectedStatusLabel
                  }
                >
                  {
                    selectedStatus.label
                  }
                </Text>
              </View>

              {/* REPEAT */}

              <Text
                style={
                  styles.sectionLabel
                }
              >
                Repetir
              </Text>

              <TouchableOpacity
                style={
                  styles.singleOptionRow
                }
                activeOpacity={
                  0.7
                }
                onPress={() => {
                  closeInlineEditor();

                  setRepeatPickerVisible(
                    true
                  );
                }}
              >
                <View
                  style={
                    styles.optionLeft
                  }
                >
                  <Ionicons
                    name="repeat-outline"
                    size={20}
                    color={
                      colors.textMuted
                    }
                  />

                  <Text
                    style={
                      styles.optionText
                    }
                  >
                    {
                      repeat
                    }
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={
                    colors.textFaint
                  }
                />
              </TouchableOpacity>

              {/* NOTES */}

              <Text
                style={
                  styles.notesLabel
                }
              >
                Notas
              </Text>

              <TextInput
                style={
                  styles.notesInput
                }
                value={
                  notes
                }
                onChangeText={
                  setNotes
                }
                multiline
                placeholder="Adicionar notas..."
                placeholderTextColor={
                  colors.textFaint
                }
                textAlignVertical="top"
                onFocus={
                  closeInlineEditor
                }
              />

              {/* DELETE */}

              {isEdit &&
                onDelete && (
                  <TouchableOpacity
                    style={
                      styles.deleteTaskButton
                    }
                    activeOpacity={
                      0.7
                    }
                    onPress={
                      onDelete
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={
                        colors.danger
                      }
                    />

                    <Text
                      style={
                        styles.deleteTaskText
                      }
                    >
                      Apagar tarefa
                    </Text>
                  </TouchableOpacity>
                )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* CATEGORY PICKER */}

      <Modal
        visible={
          categoryPickerVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setCategoryPickerVisible(
            false
          )
        }
      >
        <Pressable
          style={
            styles.pickerOverlay
          }
          onPress={() =>
            setCategoryPickerVisible(
              false
            )
          }
        >
          <View
            style={
              styles.pickerCard
            }
          >
            <Text
              style={
                styles.pickerTitle
              }
            >
              Categoria
            </Text>

            {CATEGORY_OPTIONS.map(
              (
                item
              ) => (
                <TouchableOpacity
                  key={
                    item.id
                  }
                  style={
                    styles.pickerRow
                  }
                  onPress={() => {
                    setCategoryId(
                      item.id
                    );

                    setCategoryPickerVisible(
                      false
                    );
                  }}
                >
                  <View
                    style={
                      styles.optionLeft
                    }
                  >
                    <Ionicons
                      name={
                        item.icon
                      }
                      size={20}
                      color={
                        item.color
                      }
                    />

                    <Text
                      style={
                        styles.pickerText
                      }
                    >
                      {
                        item.label
                      }
                    </Text>
                  </View>

                  {item.id ===
                    categoryId && (
                    <Ionicons
                      name="checkmark"
                      size={19}
                      color={
                        colors.selection
                      }
                    />
                  )}
                </TouchableOpacity>
              )
            )}
          </View>
        </Pressable>
      </Modal>

      {/* REPEAT PICKER */}

      <Modal
        visible={
          repeatPickerVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setRepeatPickerVisible(
            false
          )
        }
      >
        <Pressable
          style={
            styles.pickerOverlay
          }
          onPress={() =>
            setRepeatPickerVisible(
              false
            )
          }
        >
          <View
            style={
              styles.pickerCard
            }
          >
            <Text
              style={
                styles.pickerTitle
              }
            >
              Repetir
            </Text>

            {REPEAT_OPTIONS.map(
              (
                item
              ) => (
                <TouchableOpacity
                  key={
                    item
                  }
                  style={
                    styles.pickerRow
                  }
                  onPress={() => {
                    setRepeat(
                      item
                    );

                    setRepeatPickerVisible(
                      false
                    );
                  }}
                >
                  <Text
                    style={[
                      styles.pickerText,

                      item ===
                        repeat &&
                        styles.pickerTextActive,
                    ]}
                  >
                    {
                      item
                    }
                  </Text>

                  {item ===
                    repeat && (
                    <Ionicons
                      name="checkmark"
                      size={19}
                      color={
                        colors.selection
                      }
                    />
                  )}
                </TouchableOpacity>
              )
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */

const styles =
  StyleSheet.create({
    overlay: {
      flex:
        1,
    },

    backdrop: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(32, 28, 25, 0.30)',
    },

    sheet: {
      position:
        'absolute',

      left:
        0,

      right:
        0,

      backgroundColor:
        colors.surface,

      borderTopLeftRadius:
        22,

      borderTopRightRadius:
        22,

      overflow:
        'hidden',
    },

    /* TOP */

    topBar: {
      height:
        38,

      position:
        'relative',

      justifyContent:
        'center',
    },

    dragZone: {
      height:
        38,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    handle: {
      width:
        42,

      height:
        4,

      borderRadius:
        2,

      backgroundColor:
        '#C8C2BE',
    },

    saveIconButton: {
      position:
        'absolute',

      right:
        14,

      top:
        3,

      width:
        34,

      height:
        34,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        17,
    },

    saveIconButtonDisabled: {
      opacity:
        0.35,
    },

    scroll: {
      flex:
        1,
    },

    scrollContent: {
      paddingHorizontal:
        18,

      paddingTop:
        2,

      paddingBottom:
        Platform.OS ===
        'ios'
          ? 40
          : 56,
    },

    /* TITLE */

    titleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,
    },

    titleCategoryIcon: {
      flexShrink:
        0,
    },

    titleInput: {
      height:
        42,

      borderRadius:
        8,

      backgroundColor:
        colors.surfaceSoft,

      paddingHorizontal:
        11,

      fontSize:
        15,

      fontWeight:
        '500',

      color:
        colors.text,
    },

    editTitleTouch: {
      flex:
        1,

      minHeight:
        48,

      justifyContent:
        'center',

      paddingVertical:
        3,
    },

    editTitle: {
      fontSize:
        24,

      lineHeight:
        30,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    editTitleInput: {
      flex:
        1,

      minWidth:
        0,

      fontSize:
        20,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    /* SCHEDULE */

    scheduleArea: {
      marginTop:
        11,

      minHeight:
        36,

      justifyContent:
        'center',
    },

    scheduleBlock: {
      gap:
        9,
    },

    scheduleLine: {
      minHeight:
        34,

      flexDirection:
        'row',

      alignItems:
        'center',

      flexWrap:
        'wrap',

      gap:
        7,
    },

    scheduleDot: {
      fontSize:
        14,

      color:
        colors.textFaint,
    },

    inlineDateText: {
      fontSize:
        14,

      lineHeight:
        20,

      fontWeight:
        '700',

      color:
        colors.selection,
    },

    inlineTimeText: {
      fontSize:
        14,

      lineHeight:
        20,

      fontWeight:
        '600',

      color:
        colors.text,
    },

    inlineDurationText: {
      fontSize:
        13,

      lineHeight:
        20,

      fontWeight:
        '700',

      color:
        colors.selectionText,
    },

    inlineDateInput: {
      width:
        104,

      minHeight:
        34,

      paddingHorizontal:
        7,

      paddingVertical:
        4,

      borderBottomWidth:
        1,

      borderBottomColor:
        colors.selection,

      fontSize:
        14,

      fontWeight:
        '600',

      color:
        colors.text,
    },

    inlineTimeEditor: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        5,
    },

    inlineTimeInput: {
      width:
        54,

      minHeight:
        34,

      paddingHorizontal:
        4,

      paddingVertical:
        4,

      borderBottomWidth:
        1,

      borderBottomColor:
        colors.selection,

      textAlign:
        'center',

      fontSize:
        14,

      fontWeight:
        '600',

      color:
        colors.text,
    },

    inlineArrow: {
      fontSize:
        14,

      color:
        colors.textMuted,
    },

    inlineDurationEditor: {
      flexDirection:
        'row',

      alignItems:
        'center',

      flexWrap:
        'wrap',

      gap:
        6,
    },

    inlineDurationPreset: {
      minHeight:
        34,

      paddingHorizontal:
        9,

      borderRadius:
        8,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.surfaceSoft,

      borderWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        colors.border,
    },

    inlineDurationPresetSelected: {
      backgroundColor:
        colors.selectionSoft,

      borderColor:
        colors.selection,
    },

    inlineDurationPresetText: {
      fontSize:
        11,

      fontWeight:
        '500',

      color:
        colors.textMuted,
    },

    inlineDurationPresetTextSelected: {
      fontWeight:
        '700',

      color:
        colors.selectionText,
    },

    inlineCustomDuration: {
      width:
        70,

      minHeight:
        34,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        7,

      borderRadius:
        8,

      backgroundColor:
        colors.surfaceSoft,

      borderWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        colors.border,
    },

    inlineCustomDurationInput: {
      width:
        36,

      padding:
        0,

      textAlign:
        'center',

      fontSize:
        13,

      fontWeight:
        '600',

      color:
        colors.text,
    },

    inlineCustomDurationUnit: {
      marginLeft:
        2,

      fontSize:
        9,

      color:
        colors.textMuted,
    },

    /* POSTPONE */

    postponeLabel: {
      marginTop:
        14,

      marginBottom:
        7,

      fontSize:
        12,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    postponeRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      flexWrap:
        'wrap',

      gap:
        7,
    },

    postponeButton: {
      minHeight:
        36,

      paddingHorizontal:
        11,

      borderRadius:
        9,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        5,

      backgroundColor:
        colors.surfaceSoft,

      borderWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        colors.border,
    },

    postponeButtonSelected: {
      backgroundColor:
        colors.selectionSoft,

      borderColor:
        colors.selection,

      shadowColor:
        colors.shadow,

      shadowOpacity:
        0.07,

      shadowRadius:
        3,

      shadowOffset: {
        width:
          0,

        height:
          1,
      },

      elevation:
        1,
    },

    postponeButtonText: {
      fontSize:
        11,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    postponeButtonTextSelected: {
      fontWeight:
        '700',

      color:
        colors.selectionText,
    },

    /* SECTIONS */

    sectionLabel: {
      marginTop:
        17,

      marginBottom:
        6,

      fontSize:
        12,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    singleOptionRow: {
      minHeight:
        46,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        colors.border,
    },

    optionLeft: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,
    },

    optionText: {
      fontSize:
        14,

      fontWeight:
        '500',

      color:
        colors.text,
    },

    /* STATUS */

    statusRow: {
      minHeight:
        42,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        14,
    },

    statusIcons: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        7,
    },

    statusButton: {
      width:
        38,

      height:
        38,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    statusSquare: {
      width:
        32,

      height:
        32,

      borderRadius:
        8,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    statusSquareSelected: {
      backgroundColor:
        colors.selectionSoft,

      shadowColor:
        colors.shadow,

      shadowOpacity:
        0.10,

      shadowRadius:
        4,

      shadowOffset: {
        width:
          0,

        height:
          2,
      },

      elevation:
        3,
    },

    statusInnerSquare: {
      width:
        19,

      height:
        19,

      borderRadius:
        4,

      borderWidth:
        1.4,

      borderColor:
        colors.checkboxBorder,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.background,
    },

    statusInnerSquareSelected: {
      borderColor:
        colors.selection,
    },

    selectedStatusLabel: {
      fontSize:
        14,

      fontWeight:
        '600',

      color:
        colors.selectionText,
    },

    /* NOTES */

    notesLabel: {
      marginTop:
        17,

      marginBottom:
        7,

      fontSize:
        12,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    notesInput: {
      minHeight:
        68,

      maxHeight:
        120,

      borderRadius:
        10,

      backgroundColor:
        colors.surfaceSoft,

      paddingHorizontal:
        11,

      paddingVertical:
        9,

      fontSize:
        14,

      color:
        colors.text,
    },

    /* DELETE */

    deleteTaskButton: {
      alignSelf:
        'flex-start',

      marginTop:
        20,

      minHeight:
        40,

      paddingHorizontal:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        7,

      borderRadius:
        8,
    },

    deleteTaskText: {
      fontSize:
        13,

      fontWeight:
        '600',

      color:
        colors.danger,
    },

    /* PICKERS */

    pickerOverlay: {
      flex:
        1,

      justifyContent:
        'flex-end',

      backgroundColor:
        'rgba(32, 28, 25, 0.28)',
    },

    pickerCard: {
      backgroundColor:
        colors.surface,

      borderTopLeftRadius:
        20,

      borderTopRightRadius:
        20,

      paddingHorizontal:
        18,

      paddingTop:
        17,

      paddingBottom:
        Platform.OS ===
        'ios'
          ? 30
          : 22,
    },

    pickerTitle: {
      fontSize:
        17,

      fontWeight:
        '700',

      color:
        colors.text,

      marginBottom:
        8,
    },

    pickerRow: {
      minHeight:
        45,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    pickerText: {
      fontSize:
        14,

      color:
        colors.textSecondary,
    },

    pickerTextActive: {
      fontWeight:
        '700',

      color:
        colors.selectionText,
    },
  });