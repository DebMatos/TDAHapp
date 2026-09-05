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

const CARD_LEFT = 56;
const CARD_RIGHT = 12;

const LONG_PRESS_DELAY_MS = 350;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const snap = (minutes) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

const formatTimeFromMinutes = (totalMinutes) => {
  const normalized =
    ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const CARD_THEMES = [
  {
    bg: '#F1F5FD',
    border: '#DCE6FA',
    accent: '#4F75E2',
    text: '#2A437E',
  },
  {
    bg: '#F5F2FC',
    border: '#E5DCFA',
    accent: '#7A55D6',
    text: '#4C328E',
  },
  {
    bg: '#FDF4EC',
    border: '#FAE0CC',
    accent: '#E0783E',
    text: '#8F471B',
  },
  {
    bg: '#EDF8F2',
    border: '#D0EFE0',
    accent: '#38A169',
    text: '#216340',
  },
];

/* -------------------------------------------------------
   TASK CARD CLEAN
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
}) {
  const dragY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
const duration = task.timeMinutes || 30;

 const realHeight = duration * ppm;
 const visualHeight =  duration * ppm;
 const isShortTask = visualHeight < 44;

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

  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return `${hours}h`;
    }

    return `${hours}h${String(mins).padStart(2, '0')}`;
  };

  const startTimeStr = formatTimeFromMinutes(task.startMinsPlanned);
  const endTimeStr = formatTimeFromMinutes(task.startMinsPlanned + duration);
  const durationStr = formatDuration(duration);

  if (isShortTask) {
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
            {task.title} · {durationStr}
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
        <Text style={styles.taskMeta} numberOfLines={1}>
          {startTimeStr}–{endTimeStr} · {durationStr}
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

const styles = StyleSheet.create({
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

});