import React, { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DAY_MINUTES = 24 * 60;
const SNAP_MINUTES = 5;

const CARD_LEFT = 52;
const CARD_RIGHT = 12;

const LONG_PRESS_DELAY_MS = 350;

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

const snap = (minutes) =>
  Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

const formatTimeFromMinutes = (totalMinutes) => {
  const normalized =
    ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) %
    DAY_MINUTES;

  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(
    mins
  ).padStart(2, '0')}`;
};

const CARD_THEMES = [
  {
    bg: '#F4F7FD',
    accent: '#4F75E2',
  },
  {
    bg: '#F7F4FC',
    accent: '#7A55D6',
  },
  {
    bg: '#FDF6F0',
    accent: '#E0783E',
  },
  {
    bg: '#F1F8F4',
    accent: '#38A169',
  },
];

export default function TaskCardClean({
  task,
  ppm,
  onChangeStart,
  onDragStateChange,
  onPress,
  onToggle,
  themeIndex = 0,
  getVisualY,
  getMinuteFromY,
}) {
  const dragY = useRef(
    new Animated.Value(0)
  ).current;

  const scaleAnim = useRef(
    new Animated.Value(1)
  ).current;

  /* -------------------------------------------------------
     ALTURA
  ------------------------------------------------------- */

  const duration = task.timeMinutes || 30;

  const rawHeight = duration * ppm;

  const visualHeight = Math.max(
    rawHeight,
    4
  );

  /* -------------------------------------------------------
     TIPO DE CARTÃO
  ------------------------------------------------------- */

const isMicroTask = visualHeight < 8;

const isNormalTask = visualHeight >= 30;

const isCompactTask =
  !isMicroTask && !isNormalTask;
  const top = getVisualY(
    task.startMinsPlanned || 0
  );

  const theme =
    CARD_THEMES[
      themeIndex %
        CARD_THEMES.length
    ];

  /* -------------------------------------------------------
     DRAG
  ------------------------------------------------------- */

  const longPressTimer =
    useRef(null);

  const isDragActive =
    useRef(false);

  const initialTouch = useRef({
    x: 0,
    y: 0,
  });

  const clearTimer = useCallback(
    () => {
      if (longPressTimer.current) {
        clearTimeout(
          longPressTimer.current
        );

        longPressTimer.current = null;
      }
    },
    []
  );

  const resetAll = useCallback(
    () => {
      clearTimer();

      isDragActive.current = false;

      onDragStateChange?.(false);

      Animated.spring(
        scaleAnim,
        {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
        }
      ).start();
    },
    [
      clearTimer,
      onDragStateChange,
      scaleAnim,
    ]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder:
          () => false,

        onStartShouldSetPanResponderCapture:
          () => false,

        onMoveShouldSetPanResponder:
          () =>
            isDragActive.current,

        onMoveShouldSetPanResponderCapture:
          () =>
            isDragActive.current,

        onPanResponderTerminationRequest:
          () =>
            !isDragActive.current,

        onPanResponderGrant: () => {
          dragY.setValue(0);
        },

        onPanResponderMove: (
          _,
          gesture
        ) => {
          if (
            isDragActive.current
          ) {
            dragY.setValue(
              gesture.dy
            );
          }
        },

        onPanResponderRelease: (
          _,
          gesture
        ) => {
          if (
            isDragActive.current
          ) {
            const finalY =
              top + gesture.dy;

            const finalMins =
              clamp(
                snap(
                  getMinuteFromY(
                    finalY
                  )
                ),
                0,
                DAY_MINUTES -
                  duration
              );

            dragY.setValue(0);

            onChangeStart(
              task.id,
              finalMins
            );
          }

          resetAll();
        },

        onPanResponderTerminate:
          () => {
            dragY.setValue(0);
            resetAll();
          },
      }),
    [
      dragY,
      top,
      getMinuteFromY,
      duration,
      onChangeStart,
      task.id,
      resetAll,
    ]
  );

  const handleTouchStart = (
    e
  ) => {
    const {
      pageX,
      pageY,
    } = e.nativeEvent;

    initialTouch.current = {
      x: pageX,
      y: pageY,
    };

    clearTimer();

    longPressTimer.current =
      setTimeout(() => {
        isDragActive.current =
          true;

        onDragStateChange?.(
          true
        );

        Animated.spring(
          scaleAnim,
          {
            toValue: 1.03,
            useNativeDriver: true,
            friction: 4,
          }
        ).start();
      }, LONG_PRESS_DELAY_MS);
  };

  const handleTouchMove = (e) => {
    if (
      !isDragActive.current
    ) {
      const {
        pageX,
        pageY,
      } = e.nativeEvent;

      const dx = Math.abs(
        pageX -
          initialTouch.current.x
      );

      const dy = Math.abs(
        pageY -
          initialTouch.current.y
      );

      if (dx > 8 || dy > 8) {
        clearTimer();
      }
    }
  };

  const handleTouchEnd = () => {
    if (
      !isDragActive.current
    ) {
      clearTimer();
    }
  };

  /* -------------------------------------------------------
     TEXTO
  ------------------------------------------------------- */

  const formatDuration = (
    minutes
  ) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours =
      Math.floor(minutes / 60);

    const mins =
      minutes % 60;

    if (mins === 0) {
      return `${hours}h`;
    }

    return `${hours}h${String(
      mins
    ).padStart(2, '0')}`;
  };

  const startTimeStr =
    formatTimeFromMinutes(
      task.startMinsPlanned
    );

  const endTimeStr =
    formatTimeFromMinutes(
      task.startMinsPlanned +
        duration
    );

  const durationStr =
    formatDuration(duration);

  /* -------------------------------------------------------
     MICRO
  ------------------------------------------------------- */

  if (isMicroTask) {
    return (
      <Animated.View
        {...responder.panHandlers}
        onTouchStart={
          handleTouchStart
        }
        onTouchMove={
          handleTouchMove
        }
        onTouchEnd={
          handleTouchEnd
        }
        onTouchCancel={
          handleTouchEnd
        }
        style={[
          styles.taskCompact,
          {
            top,
            height:
              visualHeight,
            left: CARD_LEFT,
            right: CARD_RIGHT,
          backgroundColor: task.completed
  ? '#F5F4F2'
  : theme.bg,
            transform: [
              {
                translateY:
                  dragY,
              },
              {
                scale:
                  scaleAnim,
              },
            ],
          },
       
        ]}
      >
        <View
          style={[
            styles.taskCompactBar,
            {
           backgroundColor: task.completed
  ? '#C9C3BD'
  : theme.accent,
            },
          ]}
        />

        <TouchableOpacity
          style={
            StyleSheet.absoluteFill
          }
          onPress={() => {
            if (
              !isDragActive.current
            ) {
              onPress(task);
            }
          }}
        />
      </Animated.View>
    );
  }

  /* -------------------------------------------------------
     COMPACTO
  ------------------------------------------------------- */

  if (isCompactTask) {
    return (
      <Animated.View
        {...responder.panHandlers}
        onTouchStart={
          handleTouchStart
        }
        onTouchMove={
          handleTouchMove
        }
        onTouchEnd={
          handleTouchEnd
        }
        onTouchCancel={
          handleTouchEnd
        }
        style={[
          styles.taskCompact,
          {
            top,
            height:
              visualHeight,
            left: CARD_LEFT,
            right: CARD_RIGHT,
          backgroundColor: task.completed
  ? '#F5F4F2'
  : theme.bg,
            transform: [
              {
                translateY:
                  dragY,
              },
              {
                scale:
                  scaleAnim,
              },
            ],
          },
          task.completed &&
            styles.taskCompletedOpacity,
        ]}
      >
        <View
          style={[
            styles.taskCompactBar,
            {
           backgroundColor: task.completed
  ? '#C9C3BD'
  : theme.accent,
            },
          ]}
        />

        <TouchableOpacity
          style={
            styles.compactClickArea
          }
          onPress={() => {
            if (
              !isDragActive.current
            ) {
              onPress(task);
            }
          }}
        >
          <Text
            style={[
              styles.compactTitle,
              task.completed &&
                styles.taskTitleCompleted,
            ]}
            numberOfLines={1}
          >
            {task.title}{' '}
            <Text
              style={
                styles.compactMeta
              }
            >
              · {startTimeStr}–
              {endTimeStr} (
              {durationStr})
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          hitSlop={{
            top: 8,
            bottom: 8,
            left: 8,
            right: 8,
          }}
          onPress={() =>
            onToggle(task.id)
          }
         style={styles.compactCheckbox}
        >
          {task.completed && (
            <Ionicons
              name="checkmark"
              size={8}
              color={
                theme.accent
              }
            />
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  /* -------------------------------------------------------
     NORMAL
  ------------------------------------------------------- */

  return (
    <Animated.View
      {...responder.panHandlers}
      onTouchStart={
        handleTouchStart
      }
      onTouchMove={
        handleTouchMove
      }
      onTouchEnd={
        handleTouchEnd
      }
      onTouchCancel={
        handleTouchEnd
      }
      style={[
        styles.taskNormal,
        {
          top,
          height:
            visualHeight,
          left: CARD_LEFT,
          right: CARD_RIGHT,
        backgroundColor: task.completed
  ? '#F5F4F2'
  : theme.bg,
          transform: [
            {
              translateY:
                dragY,
            },
            {
              scale:
                scaleAnim,
            },
          ],
        },
    
      ]}
    >
      <View
        style={[
          styles.taskAccentBar,
          {
         backgroundColor: task.completed
  ? '#C9C3BD'
  : theme.accent,
          },
        ]}
      />

      <TouchableOpacity
        style={styles.taskBody}
        onPress={() => {
          if (
            !isDragActive.current
          ) {
            onPress(task);
          }
        }}
      >
        <Text
          style={[
            styles.taskTitle,
            task.completed &&
              styles.taskTitleCompleted,
          ]}
          numberOfLines={1}
        >
          {task.title}
        </Text>

        <Text
          style={styles.taskMeta}
          numberOfLines={1}
        >
          {startTimeStr}–
          {endTimeStr} ·{' '}
          {durationStr}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        hitSlop={{
          top: 10,
          bottom: 10,
          left: 10,
          right: 10,
        }}
        onPress={() =>
          onToggle(task.id)
        }
        style={[
          styles.universalCheckbox,
          {
            marginTop: 8,
          },
        ]}
      >
        {task.completed && (
          <Ionicons
            name="checkmark"
            size={10}
            color={
              theme.accent
            }
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */

const styles =
  StyleSheet.create({
    taskNormal: {
      position: 'absolute',

      borderRadius: 3,

      borderWidth: 0,

      flexDirection: 'row',

      alignItems:
        'flex-start',

      overflow: 'hidden',
    },

    taskAccentBar: {
      width: 3,

      alignSelf:
        'stretch',
    },

    taskBody: {
      flex: 1,

      paddingHorizontal: 8,

      paddingTop: 8,

      paddingBottom: 8,

      justifyContent:
        'flex-start',
    },

    taskTitle: {
      fontSize: 13,

      fontWeight: '600',

      color: '#403B37',

      includeFontPadding:
        false,

      lineHeight: 15,
    },

    taskTitleCompleted: {
      textDecorationLine:
        'line-through',

  color: '#8F8983',
    },

    taskMeta: {
      marginTop: 2,

      fontSize: 10,

      fontWeight: '500',

      color: '#8A827C',

      includeFontPadding:
        false,

      lineHeight: 12,
    },

    taskCompact: {
      position: 'absolute',

      borderRadius: 3,

      borderWidth: 0,

      flexDirection: 'row',

      alignItems: 'center',

      overflow: 'hidden',
    },

    taskCompactBar: {
      width: 3,

      alignSelf:
        'stretch',
    },
compactClickArea: {
  flex: 1,
  height: '100%',
  paddingHorizontal: 7,
  justifyContent: 'center',
},

    compactTitle: {
      fontSize: 10,

      fontWeight: '600',

      color: '#403B37',

      includeFontPadding:
        false,
    },
compactCheckbox: {
  width: 11,
  height: 11,
  marginRight: 6,
  borderRadius: 2.5,
  borderWidth: 1,
  borderColor: '#C7BFB9',
  backgroundColor: '#FFFFFF',
  alignItems: 'center',
  justifyContent: 'center',
},
    compactMeta: {
      fontWeight: '400',

      color: '#8A827C',
    },

    universalCheckbox: {
      width: 14,

      height: 14,

      marginRight: 8,

      borderRadius: 3,

      borderWidth: 1.2,

      borderColor:
        '#C7BFB9',

      backgroundColor:
        '#FFFFFF',

      alignItems:
        'center',

      justifyContent:
        'center',
    },
  });