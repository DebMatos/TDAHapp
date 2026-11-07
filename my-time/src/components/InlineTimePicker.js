import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { createTaskSheetStyles } from '../theme/styles/taskSheets.styles';
import { isValidTime, splitTimeInput } from '../utils/time';

const ROW_HEIGHT = 44;
const CYCLES = 7;
const pad = value => String(value).padStart(2, '0');

function TimeWheel({ value, range, label, disabled, editing = false, onChange, onEdit, styles }) {
  const list = useRef(null);
  const dragging = useRef(false);
  const endTimer = useRef(null);
  const longPressed = useRef(false);
  const latest = useRef({ value, disabled, onChange });
  latest.current = { value, disabled, onChange };
  const center = Math.floor(CYCLES / 2) * range;
  const offset = useRef((center + value) * ROW_HEIGHT);
  const initialOffset = useRef({ x: 0, y: offset.current });
  const data = useMemo(() => Array.from({ length: range * CYCLES }, (_, index) => index % range), [range]);

  const cancelEndTimer = () => { clearTimeout(endTimer.current); endTimer.current = null; };
  useEffect(() => () => clearTimeout(endTimer.current), []);
  useEffect(() => {
    if (!dragging.current) {
      const currentRow = Math.round(offset.current / ROW_HEIGHT);
      const nearestRow = Math.max(0, Math.min(data.length - 1,
        Math.round((currentRow - value) / range) * range + value));
      const target = nearestRow * ROW_HEIGHT;
      if (Math.abs(target - offset.current) > 0.5) {
        offset.current = target;
        list.current?.scrollTo({ y: target, animated: true });
      }
    }
  }, [value, range, data.length]);

  const settle = () => {
    cancelEndTimer();
    dragging.current = false;
    const selected = latest.current.disabled ? latest.current.value
      : ((Math.round(offset.current / ROW_HEIGHT) % range) + range) % range;
    const row = Math.round(offset.current / ROW_HEIGHT);
    const nearEdge = row < range || row >= range * (CYCLES - 1);
    const targetRow = nearEdge ? center + selected
      : Math.round((row - selected) / range) * range + selected;
    const target = targetRow * ROW_HEIGHT;
    // Ordinary selection stays in the current cycle. Only recycle near an edge.
    if (Math.abs(target - offset.current) > 0.5) {
      offset.current = target;
      list.current?.scrollTo({ y: target, animated: !nearEdge && !latest.current.disabled });
    }
    if (!latest.current.disabled && selected !== latest.current.value) latest.current.onChange(selected);
  };

  return (
    <View style={styles.column}>
      <ScrollView
        ref={list}
        contentOffset={initialOffset.current}
        removeClippedSubviews
        style={styles.wheel}
        contentContainerStyle={styles.wheelContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        scrollEnabled={!disabled}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }}
        onScrollBeginDrag={() => { cancelEndTimer(); dragging.current = true; Keyboard.dismiss(); }}
        onScrollEndDrag={() => { endTimer.current = setTimeout(settle, 140); }}
        onMomentumScrollBegin={cancelEndTimer}
        onMomentumScrollEnd={settle}
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        accessibilityState={{ disabled }}
        accessibilityValue={{ min: 0, max: range - 1, now: value, text: pad(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => {
          if (!disabled) onChange((value + (event.nativeEvent.actionName === 'increment' ? 1 : range - 1)) % range);
        }}
      >
        {data.map((item, index) => (
          <Text key={index} accessibilityRole="button" accessibilityLabel={`${label}: ${pad(item)}`}
            accessibilityState={{ disabled, selected: item === value }}
            style={[styles.row, styles.number, item === value && styles.selectedNumber, editing && item === value && styles.hiddenNumber]}
            accessibilityHint={item === value ? 'Mantém premido para escrever a hora' : undefined}
            onPressIn={() => { longPressed.current = false; }}
            onLongPress={() => {
              if (!disabled && item === value) {
                longPressed.current = true;
                onEdit();
              }
            }}
            onPress={() => {
              if (!disabled && !longPressed.current && item !== value) onChange(item);
            }}>{pad(item)}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

export default function InlineTimePicker({ value, disabled = false, onChange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => ({ hours: value.slice(0, 2), minutes: value.slice(3) }));
  const [focusTarget, setFocusTarget] = useState({ field: 'hours', selectAll: true });
  const hoursInput = useRef(null);
  const minutesInput = useRef(null);
  const latestInput = useRef({ disabled, onChange });
  latestInput.current = { disabled, onChange };
  const translateY = useRef(new Animated.Value(-48)).current;
  const [hours, minutes] = value.split(':').map(Number);

  useEffect(() => {
    const animation = Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [translateY]);

  useEffect(() => {
    if (editing) (focusTarget.field === 'hours' ? hoursInput : minutesInput).current?.focus();
  }, [editing, focusTarget]);

  const edit = (field) => {
    setDraft({ hours: value.slice(0, 2), minutes: value.slice(3) });
    setFocusTarget({ field, selectAll: true });
    setEditing(true);
  };
  const applyTime = (next) => {
    if (latestInput.current.disabled || !isValidTime(next)) return;
    latestInput.current.onChange(next);
    setEditing(false);
    Keyboard.dismiss();
  };
  const confirm = () => {
    if (!draft.hours || !draft.minutes) return;
    applyTime(`${draft.hours.padStart(2, '0')}:${draft.minutes.padStart(2, '0')}`);
  };
  const changeHours = (text) => {
    const result = splitTimeInput(text);
    setDraft({ hours: result.hours, minutes: result.minutes });
    setFocusTarget({ field: result.hourComplete ? 'minutes' : 'hours', selectAll: false });
    if (result.complete) applyTime(result.time);
  };
  const changeMinutes = (text) => {
    const next = text.replace(/\D/g, '').slice(0, 2);
    setDraft(previous => ({ ...previous, minutes: next }));
    setFocusTarget({ field: 'minutes', selectAll: false });
    if (draft.hours && next && (next.length === 2 || Number(next) >= 6)) {
      applyTime(`${draft.hours.padStart(2, '0')}:${next.padStart(2, '0')}`);
    }
  };
  const changeWheel = (hour, minute) => {
    setEditing(false);
    Keyboard.dismiss();
    onChange(`${pad(hour)}:${pad(minute)}`);
  };

  return (
    <Animated.View style={[styles.panel, { transform: [{ translateY }] }]} testID="inline-time-picker">
      {editing && !isValidTime(`${draft.hours}:${draft.minutes}`) && (
        <Text style={styles.muted} accessibilityLiveRegion="polite">Introduz uma hora entre 00:00 e 23:59.</Text>
      )}
      <View style={styles.wheels}>
        <TimeWheel value={hours} range={24} label="Horas" styles={styles}
          disabled={disabled || editing} editing={editing}
          onEdit={() => edit('hours')} onChange={hour => changeWheel(hour, minutes)} />
        <Text style={styles.separator}>:</Text>
        <TimeWheel value={minutes} range={60} label="Minutos" styles={styles}
          disabled={disabled || editing} editing={editing}
          onEdit={() => edit('minutes')} onChange={minute => changeWheel(hours, minute)} />
        {editing && (
          <View style={styles.centerEditor} pointerEvents="box-none">
            {['hours', 'minutes'].map((field, index) => (
              <React.Fragment key={field}>
                {index === 1 && <View style={styles.separatorSpace} pointerEvents="none" />}
                <TextInput
                  ref={index === 0 ? hoursInput : minutesInput}
                  accessibilityLabel={index === 0 ? 'Editar horas' : 'Editar minutos'}
                  editable={!disabled}
                  style={styles.input}
                  value={draft[field]}
                  selection={focusTarget.field === field ? {
                    start: focusTarget.selectAll ? 0 : draft[field].length, end: draft[field].length,
                  } : undefined}
                  onFocus={() => {
                    if (focusTarget.field !== field) setFocusTarget({ field, selectAll: true });
                  }}
                  onPressOut={() => setFocusTarget({ field, selectAll: true })}
                  onChangeText={index === 0 ? changeHours : changeMinutes}
                  onKeyPress={event => {
                    if (field === 'minutes' && event.nativeEvent.key === 'Backspace' && !draft.minutes) {
                      setDraft(previous => ({ hours: previous.hours.slice(0, -1), minutes: '' }));
                      setFocusTarget({ field: 'hours', selectAll: false });
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={index === 0 ? 4 : 2}
                  onSubmitEditing={index === 0
                    ? () => setFocusTarget({ field: 'minutes', selectAll: true }) : confirm}
                  returnKeyType={index === 0 ? 'next' : 'done'}
                />
              </React.Fragment>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const createStyles = colors => StyleSheet.create({
  panel: createTaskSheetStyles(colors).pickerPanel,
  input: { width: 96, height: ROW_HEIGHT, color: colors.selectionText, fontSize: 24, fontWeight: '700', textAlign: 'center', padding: 0 },
  muted: { color: colors.textMuted, fontSize: 12 },
  wheels: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', width: 256 },
  column: { width: 96, alignItems: 'center' },
  wheel: { height: ROW_HEIGHT * 3, flexGrow: 0, width: '100%' },
  wheelContent: { paddingVertical: ROW_HEIGHT },
  row: { height: ROW_HEIGHT, textAlign: 'center', textAlignVertical: 'center' },
  number: { color: colors.textMuted, fontSize: 20 },
  selectedNumber: { color: colors.selectionText, fontSize: 24, fontWeight: '700' },
  separator: { width: 64, textAlign: 'center', color: colors.textSecondary, fontSize: 24 },
  separatorSpace: { width: 64 },
  centerEditor: { flexDirection: 'row', position: 'absolute', top: ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT },
  hiddenNumber: { opacity: 0 },
});
