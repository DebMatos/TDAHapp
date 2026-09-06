import React, {
  useCallback,
  useMemo,
  useRef,
} from 'react';

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

const CARD_LEFT = 56;
const CARD_RIGHT = 16;

const LONG_PRESS_DELAY_MS = 350;

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

const snap = (minutes) =>
  Math.round(minutes / SNAP_MINUTES) *
  SNAP_MINUTES;

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

/* -------------------------------------------------------
   TEMAS
------------------------------------------------------- */

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

/* -------------------------------------------------------
   COMPONENTE
------------------------------------------------------- */

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

  layoutStyle,
}) {
  const dragY = useRef(
    new Animated.Value(0)
  ).current;

  const scaleAnim = useRef(
    new Animated.Value(1)
  ).current;

  /* -------------------------------------------------------
     ESTADO
  ------------------------------------------------------- */

  const taskStatus =
    task.status ||
    (task.completed
      ? 'completed'
      : 'pending');

  const isCompleted =
    taskStatus === 'completed';

  const isAbandoned =
    taskStatus === 'abandoned';

  const isNeutralized =
    isCompleted || isAbandoned;

  /* -------------------------------------------------------
     ALTURA
  ------------------------------------------------------- */

  const duration =
    task.timeMinutes || 30;

  const rawHeight =
    duration * ppm;

  const visualHeight =
    Math.max(
      rawHeight,
      4
    );

  /* -------------------------------------------------------
     TIPO DE CARTÃO
  ------------------------------------------------------- */

  const isMicroTask =
    visualHeight < 8;

  const isTinyTask =
    visualHeight >= 8 &&
    visualHeight < 12;

  const isCompactTask =
    visualHeight >= 12 &&
    visualHeight < 30;

  const isNormalTask =
    visualHeight >= 30;

  /* -------------------------------------------------------
     POSIÇÃO
  ------------------------------------------------------- */

  const top =
    getVisualY(
      task.startMinsPlanned || 0
    );

  const horizontalStyle =
    layoutStyle || {
      left: CARD_LEFT,
      right: CARD_RIGHT,
    };

  /* -------------------------------------------------------
     LARGURA / OVERLAP
  ------------------------------------------------------- */

  const cardWidth =
    layoutStyle?.width ?? null;

  const isNarrow =
    cardWidth != null &&
    cardWidth < 180;

  const isVeryNarrow =
    cardWidth != null &&
    cardWidth < 105;

  const hasRoomForMeta =
    visualHeight >= 30;

  const hasRoomForCompactMeta =
    visualHeight >= 18;

  const showCheckbox =
    !isVeryNarrow;

  /* -------------------------------------------------------
     TEMA
  ------------------------------------------------------- */

  const theme =
    CARD_THEMES[
      themeIndex %
        CARD_THEMES.length
    ];

  const cardBackground =
    isNeutralized
      ? '#F5F4F2'
      : theme.bg;

  const accentColor =
    isNeutralized
      ? '#C9C3BD'
      : theme.accent;

  const titleColor =
    isAbandoned
      ? '#AAA39D'
      : '#403B37';

  const metaColor =
    isAbandoned
      ? '#B5AEA8'
      : '#8A827C';

  /* -------------------------------------------------------
     DRAG
  ------------------------------------------------------- */

  const longPressTimer =
    useRef(null);

  const isDragActive =
    useRef(false);

  const initialTouch =
    useRef({
      x: 0,
      y: 0,
    });

  const clearTimer =
    useCallback(() => {
      if (
        longPressTimer.current
      ) {
        clearTimeout(
          longPressTimer.current
        );

        longPressTimer.current =
          null;
      }
    }, []);

  const resetAll =
    useCallback(() => {
      clearTimer();

      isDragActive.current =
        false;

      onDragStateChange?.(
        false
      );

      Animated.spring(
        scaleAnim,
        {
          toValue: 1,
          useNativeDriver:
            true,
          friction: 6,
        }
      ).start();
    }, [
      clearTimer,
      onDragStateChange,
      scaleAnim,
    ]);

  const responder =
    useMemo(
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

          onPanResponderGrant:
            () => {
              dragY.setValue(
                0
              );
            },

          onPanResponderMove:
            (
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

          onPanResponderRelease:
            (
              _,
              gesture
            ) => {
              if (
                isDragActive.current
              ) {
                const finalY =
                  top +
                  gesture.dy;

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

                dragY.setValue(
                  0
                );

                onChangeStart(
                  task.id,
                  finalMins
                );
              }

              resetAll();
            },

          onPanResponderTerminate:
            () => {
              dragY.setValue(
                0
              );

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

  /* -------------------------------------------------------
     TOUCH
  ------------------------------------------------------- */

  const handleTouchStart =
    (e) => {
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
              useNativeDriver:
                true,
              friction: 4,
            }
          ).start();
        }, LONG_PRESS_DELAY_MS);
    };

  const handleTouchMove =
    (e) => {
      if (
        !isDragActive.current
      ) {
        const {
          pageX,
          pageY,
        } = e.nativeEvent;

        const dx =
          Math.abs(
            pageX -
              initialTouch.current.x
          );

        const dy =
          Math.abs(
            pageY -
              initialTouch.current.y
          );

        if (
          dx > 8 ||
          dy > 8
        ) {
          clearTimer();
        }
      }
    };

  const handleTouchEnd =
    () => {
      if (
        !isDragActive.current
      ) {
        clearTimer();
      }
    };

  /* -------------------------------------------------------
     TEXTO
  ------------------------------------------------------- */

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
    formatDuration(
      duration
    );

  /* -------------------------------------------------------
     ÍCONE DE ESTADO
  ------------------------------------------------------- */

  const renderStatusIcon =
    (size = 10) => {
      if (isCompleted) {
        return (
          <Ionicons
            name="checkmark"
            size={size}
            color="#7F9B87"
          />
        );
      }

      if (isAbandoned) {
        return (
          <Ionicons
            name="close"
            size={size + 1}
            color="#8F8983"
          />
        );
      }

      return null;
    };

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

            backgroundColor:
              cardBackground,

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
          horizontalStyle,
        ]}
      >
        <View
          style={[
            styles.taskCompactBar,
            {
              backgroundColor:
                accentColor,
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
     TINY
  ------------------------------------------------------- */

  if (isTinyTask) {
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
          styles.taskTiny,
          {
            top,
            height:
              visualHeight,

            backgroundColor:
              cardBackground,

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
          horizontalStyle,
        ]}
      >
        <View
          style={[
            styles.taskTinyBar,
            {
              backgroundColor:
                accentColor,
            },
          ]}
        />

        <TouchableOpacity
          style={
            styles.tinyClickArea
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
              styles.tinyTitle,

              {
                color:
                  titleColor,
              },

              isVeryNarrow &&
                styles.tinyTitleVeryNarrow,

              isCompleted &&
                styles.taskTitleCompleted,

              isAbandoned &&
                styles.taskTitleAbandoned,
            ]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
        </TouchableOpacity>
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

            backgroundColor:
              cardBackground,

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
          horizontalStyle,
        ]}
      >
        <View
          style={[
            styles.taskCompactBar,
            {
              backgroundColor:
                accentColor,
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

              {
                color:
                  titleColor,
              },

              isVeryNarrow &&
                styles.compactTitleVeryNarrow,

              isCompleted &&
                styles.taskTitleCompleted,

              isAbandoned &&
                styles.taskTitleAbandoned,
            ]}
            numberOfLines={1}
          >
            {task.title}
          </Text>

          {hasRoomForCompactMeta &&
            !isVeryNarrow && (
              <Text
                style={[
                  styles.compactMetaLine,
                  {
                    color:
                      metaColor,
                  },
                ]}
                numberOfLines={1}
              >
                {isNarrow
                  ? durationStr
                  : `${startTimeStr} · ${durationStr}`}
              </Text>
            )}
        </TouchableOpacity>

        {showCheckbox && (
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
            style={[
              styles.compactCheckbox,

              isAbandoned &&
                styles.abandonedCheckbox,
            ]}
          >
            {renderStatusIcon(
              8
            )}
          </TouchableOpacity>
        )}
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

          backgroundColor:
            cardBackground,

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
        horizontalStyle,
      ]}
    >
      <View
        style={[
          styles.taskAccentBar,
          {
            backgroundColor:
              accentColor,
          },
        ]}
      />

      <TouchableOpacity
        style={
          styles.taskBody
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
            styles.taskTitle,

            {
              color:
                titleColor,
            },

            isNarrow &&
              styles.taskTitleNarrow,

            isVeryNarrow &&
              styles.taskTitleVeryNarrow,

            isCompleted &&
              styles.taskTitleCompleted,

            isAbandoned &&
              styles.taskTitleAbandoned,
          ]}
          numberOfLines={1}
        >
          {task.title}
        </Text>

        {hasRoomForMeta && (
          <Text
            style={[
              styles.taskMeta,

              {
                color:
                  metaColor,
              },

              isNarrow &&
                styles.taskMetaNarrow,
            ]}
            numberOfLines={1}
          >
            {isVeryNarrow
              ? durationStr
              : isNarrow
                ? `${startTimeStr} · ${durationStr}`
                : `${startTimeStr}–${endTimeStr} · ${durationStr}`}
          </Text>
        )}
      </TouchableOpacity>

      {showCheckbox && (
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

            isAbandoned &&
              styles.abandonedCheckbox,

            {
              marginTop: 8,
            },
          ]}
        >
          {renderStatusIcon(
            10
          )}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */

const styles =
  StyleSheet.create({
    /* ---------------------------------------------------
       NORMAL
    --------------------------------------------------- */

    taskNormal: {
      position: 'absolute',

      borderRadius: 3,

      borderWidth: 0,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        '#E7E3DF',

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
alignSelf: 'stretch',
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

    taskTitleNarrow: {
      fontSize: 12,
    },

    taskTitleVeryNarrow: {
      fontSize: 10,
    },

    taskTitleCompleted: {
      textDecorationLine:
        'line-through',

      color: '#8F8983',
    },

    taskTitleAbandoned: {
      textDecorationLine:
        'none',

      color: '#AAA39D',
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

    taskMetaNarrow: {
      fontSize: 9,
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

    abandonedCheckbox: {
      borderColor:
        '#AAA39D',

      backgroundColor:
        '#F7F5F3',
    },

    /* ---------------------------------------------------
       COMPACT
    --------------------------------------------------- */

    taskCompact: {
      position: 'absolute',

      borderRadius: 3,

      borderWidth: 0,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        '#E4E0DC',

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

      justifyContent:
        'center',
    },

    compactTitle: {
      fontSize: 10,

      fontWeight: '600',

      color: '#403B37',

      includeFontPadding:
        false,
    },

    compactTitleVeryNarrow: {
      fontSize: 9,
    },

    compactMetaLine: {
      marginTop: 1,

      fontSize: 8,

      lineHeight: 9,

      fontWeight: '400',

      color: '#8A827C',

      includeFontPadding:
        false,
    },

    compactCheckbox: {
      width: 11,

      height: 11,

      marginRight: 6,

      borderRadius: 2.5,

      borderWidth: 1,

      borderColor:
        '#C7BFB9',

      backgroundColor:
        '#FFFFFF',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    /* ---------------------------------------------------
       TINY
    --------------------------------------------------- */

    taskTiny: {
      position: 'absolute',

      borderRadius: 2,

      borderWidth: 0,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        '#E4E0DC',

      flexDirection: 'row',

      alignItems: 'center',

      overflow: 'hidden',
    },

    taskTinyBar: {
      width: 3,

      height: '100%',
    },

    tinyClickArea: {
      flex: 1,

      height: '100%',

      paddingHorizontal: 6,

      justifyContent:
        'center',
    },

    tinyTitle: {
      fontSize: 8,

      lineHeight: 9,

      fontWeight: '600',

      color: '#403B37',

      includeFontPadding:
        false,
    },

    tinyTitleVeryNarrow: {
      fontSize: 7,
    },
  });