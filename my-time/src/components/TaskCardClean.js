import React, { useCallback, useMemo, useRef } from 'react';

import {
  formatTimeFromMinutes,
  timeToMinutes,
  formatDuration,
  getDraggedTimelinePosition,
} from '../utils/time';

import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getCategory } from '../config/categories';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const CARD_LEFT = 58;
const CARD_RIGHT = 16;
const LONG_PRESS_DELAY_MS = 350;

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

/* -------------------------------------------------------
   COMPONENTE
------------------------------------------------------- */

export default function TaskCardClean({
  task,
  ppm,
  countdown = null,

  onChangeStart,
  onDragStateChange,
  onDragPreview,

  onPress,
  onToggle,

  getVisualY,
  getMinuteFromY,

  layoutStyle,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dragY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  /* -------------------------------------------------------
     ESTADO
  ------------------------------------------------------- */

  const taskStatus = task.status ?? 'pending';
  const isCompleted = taskStatus === 'completed';
  const isAbandoned = taskStatus === 'abandoned';
  const isNeutralized = isCompleted || isAbandoned;

  const startMinutes = timeToMinutes(task.startTime);

  /* -------------------------------------------------------
     ALTURA
  ------------------------------------------------------- */

  const duration = task.durationMinutes ?? 30;
  const rawHeight = duration * ppm;
  const visualHeight = Math.max(rawHeight, 4);

  /* -------------------------------------------------------
     POSIÇÃO
  ------------------------------------------------------- */

  const top = getVisualY(startMinutes);

  const horizontalStyle = layoutStyle || {
    left: CARD_LEFT,
    right: CARD_RIGHT,
  };

  /* -------------------------------------------------------
     LARGURA / OVERLAP
  ------------------------------------------------------- */

  const cardWidth = layoutStyle?.width ?? null;
  const hasRoomForMeta = visualHeight >= 32;
  const showCheckbox = visualHeight >= 14 && (cardWidth == null || cardWidth >= 42);
  const showCountdown = Boolean(countdown) && visualHeight >= 14;

  /* -------------------------------------------------------
     TEMA DINÂMICO
  ------------------------------------------------------- */
  const categoryId = task.categoryId ?? task.category ?? 'inbox';

  const category = getCategory(categoryId, colors);

  const cardBackground = isNeutralized ? colors.taskCardNeutral : category.surface;
  const accentColor = category.color;

  const titleColor = isAbandoned ? colors.textFaint : colors.text;
  const metaColor = isAbandoned ? colors.taskCardMuted : colors.textMuted;
  const countdownAccessibility = countdown ? ` ${countdown.label}.` : '';

  const renderCountdown = () => (
    <View style={styles.countdownIndicator}>
      {countdown.phase === 'current' && (
        <Ionicons
          name="hourglass-outline"
          size={14}
          color={colors.selectionText}
          style={styles.countdownIcon}
        />
      )}
      <Text
        style={styles.countdownText}
        numberOfLines={1}
      >
        {countdown.label}
      </Text>
    </View>
  );


  /* -------------------------------------------------------
     DRAG
  ------------------------------------------------------- */

  const longPressTimer = useRef(null);
  const isDragActive = useRef(false);
  const initialTouch = useRef({ x: 0, y: 0 });
  const dragPosition = useRef(null);

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
    onDragPreview?.(null);
    dragPosition.current = null;

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [clearTimer, onDragPreview, onDragStateChange, scaleAnim]);

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

        onPanResponderMove: (event, gesture) => {
          if (isDragActive.current) {
            const pointerY = event.nativeEvent.pageY ?? gesture.moveY;
            const deltaY = pointerY - initialTouch.current.y;
            const position = getDraggedTimelinePosition(
              startMinutes,
              deltaY,
              ppm,
              duration,
              dragPosition.current?.magnetMinute,
              dragPosition.current?.suppressedMagnetMinute,
            );
            const visualDelta = getVisualY(position.minute) - getVisualY(startMinutes);

            dragPosition.current = position;
            dragY.setValue(visualDelta);
            onDragPreview?.(position);
          }
        },

        onPanResponderRelease: (event, gesture) => {
          if (isDragActive.current) {
            const pointerY = event.nativeEvent.pageY ?? gesture.moveY;
            const deltaY = pointerY - initialTouch.current.y;
            const position = dragPosition.current ?? getDraggedTimelinePosition(
              startMinutes,
              deltaY,
              ppm,
              duration,
            );

            dragY.setValue(0);
            onChangeStart(task.id, position.minute);
          }
          resetAll();
        },

        onPanResponderTerminate: () => {
          dragY.setValue(0);
          resetAll();
        },
      }),
    [
      dragY,
      duration,
      getVisualY,
      onChangeStart,
      onDragPreview,
      ppm,
      resetAll,
      startMinutes,
      task.id,
    ],
  );

  /* -------------------------------------------------------
     TOUCH
  ------------------------------------------------------- */

  const handleTouchStart = (e) => {
    const { pageX, pageY } = e.nativeEvent;
    initialTouch.current = { x: pageX, y: pageY };
    clearTimer();

    longPressTimer.current = setTimeout(() => {
      isDragActive.current = true;
      onDragStateChange?.(true);
      const position = {
        minute: startMinutes,
        isMagnetized: false,
        magnetMinute: startMinutes % 30 === 0 ? startMinutes : null,
        suppressedMagnetMinute: null,
      };

      dragPosition.current = position;
      onDragPreview?.(position);

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

      if (dx > 8 || dy > 8) {
        clearTimer();
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDragActive.current) {
      clearTimer();
    }
  };

  /* -------------------------------------------------------
     TEXTO
  ------------------------------------------------------- */

  const startTimeStr = formatTimeFromMinutes(startMinutes);
  const endTimeStr = formatTimeFromMinutes(startMinutes + duration);
  const durationStr = formatDuration(duration);
  const statusLabel = isCompleted ? 'Concluída' : isAbandoned ? 'Abandonada' : 'Pendente';

  /* -------------------------------------------------------
     ÍCONE DE ESTADO
  ------------------------------------------------------- */

  const renderStatusIcon = (size = 10) => {
    if (isCompleted) {
      return <Ionicons name="checkmark" size={size} color={colors.success} />;
    }

    if (isAbandoned) {
      return <Ionicons name="close" size={size + 1} color={colors.completed} />;
    }

    return null;
  };

  const contentTop = (visualHeight - (hasRoomForMeta ? 28 : 15)) / 2;

  return (
    <Animated.View
      {...responder.panHandlers}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={[
        styles.taskCard,
        {
          top,
          height: visualHeight,
          backgroundColor: cardBackground,
          transform: [{ translateY: dragY }, { scale: scaleAnim }],
        },
        horizontalStyle,
      ]}
    >
      <View style={[styles.taskAccentBar, { backgroundColor: accentColor }]} />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Abrir tarefa ${task.title}. ${category.label}. ${statusLabel}. ${startTimeStr}, ${durationStr}.${countdownAccessibility}`}
        style={[
          styles.taskBody,
          { paddingTop: visualHeight < 14 ? Math.max(0, (visualHeight - 9) / 2) : Math.max(0, contentTop) },
          showCheckbox && styles.taskBodyWithCheckbox,
        ]}
        onPress={() => {
          if (!isDragActive.current) onPress(task);
        }}
      >
        {visualHeight >= 8 && (
          <View style={styles.cardTopRow}>
            <Text
              style={[
                styles.taskTitle,
                visualHeight < 15 && styles.taskTitleTiny,
                { color: titleColor },
                isCompleted && styles.taskTitleCompleted,
                isAbandoned && styles.taskTitleAbandoned,
              ]}
              numberOfLines={1}
            >
              {task.title}
            </Text>
            {showCountdown && renderCountdown()}
          </View>
        )}
        {hasRoomForMeta && (
          <Text style={[styles.taskMeta, { color: metaColor }]} numberOfLines={1}>
            {`${startTimeStr}–${endTimeStr} · ${durationStr}`}
          </Text>
        )}
      </TouchableOpacity>
      {showCheckbox && (
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isCompleted }}
          accessibilityLabel={`Conclusão de ${task.title}. Estado: ${statusLabel}.`}
          hitSlop={hasRoomForMeta ? 10 : 8}
          onPress={() => onToggle(task.id)}
          style={[
            styles.checkbox,
            { top: Math.max(0, contentTop + 0.5) },
            isAbandoned && styles.abandonedCheckbox,
          ]}
        >
          {renderStatusIcon(8)}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  taskCard: {
    position: 'absolute',
    borderRadius: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.taskCardBorder,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  taskAccentBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 9,
    paddingRight: 8,
  },
  taskBodyWithCheckbox: {
    paddingRight: 28,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 15,
  },
  taskTitleTiny: {
    fontSize: 8,
    lineHeight: 9,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.completed,
  },
  taskTitleAbandoned: {
    color: colors.textFaint,
  },
  taskMeta: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '500',
    includeFontPadding: false,
    lineHeight: 12,
  },
  countdownIndicator: {
    maxWidth: '65%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  countdownText: {
    flexShrink: 1,
    color: colors.selectionText,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  countdownIcon: {
    marginRight: 3,
  },
  checkbox: {
    position: 'absolute',
    right: 8,
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.taskCardMuted,
    backgroundColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abandonedCheckbox: {
    borderColor: colors.textFaint,
    backgroundColor: colors.surfaceSoft,
  },
});
