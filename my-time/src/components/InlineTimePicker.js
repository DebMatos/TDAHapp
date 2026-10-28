import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { createTaskSheetStyles } from '../theme/styles/taskSheets.styles';
import { formatTimeInput, isValidTime } from '../utils/time';

const ROW_HEIGHT = 44;
const CYCLES = 7;
const pad = value => String(value).padStart(2, '0');

function TimeWheel({ value, range, label, disabled, onChange, onEdit, styles }) {
  const list = useRef(null);
  const dragging = useRef(false);
  const endTimer = useRef(null);
  const latest = useRef({ value, disabled, onChange });
  latest.current = { value, disabled, onChange };
  const center = Math.floor(CYCLES / 2) * range;
  const offset = useRef((center + value) * ROW_HEIGHT);
  const data = useMemo(() => Array.from({ length: range * CYCLES }, (_, index) => index % range), [range]);

  const cancelEndTimer = () => { clearTimeout(endTimer.current); endTimer.current = null; };
  useEffect(() => () => clearTimeout(endTimer.current), []);
  useEffect(() => {
    if (!dragging.current) {
      offset.current = (center + value) * ROW_HEIGHT;
      list.current?.scrollTo({ y: offset.current, animated: false });
    }
  }, [value, center]);

  const settle = () => {
    cancelEndTimer();
    dragging.current = false;
    const selected = latest.current.disabled ? latest.current.value
      : ((Math.round(offset.current / ROW_HEIGHT) % range) + range) % range;
    // Recenter without animation so neither end of the finite backing list is exposed.
    offset.current = (center + selected) * ROW_HEIGHT;
    list.current?.scrollTo({ y: offset.current, animated: false });
    if (!latest.current.disabled) latest.current.onChange(selected);
  };

  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <ScrollView
        ref={list}
        contentOffset={{ x: 0, y: (center + value) * ROW_HEIGHT }}
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
            style={[styles.row, styles.number, item === value && styles.selectedNumber]}
            onPress={() => { if (!disabled) item === value ? onEdit() : onChange(item); }}>{pad(item)}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

export default function InlineTimePicker({ value, label, disabled = false, onChange, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const translateY = useRef(new Animated.Value(-48)).current;
  const [hours, minutes] = value.split(':').map(Number);

  useEffect(() => {
    const animation = Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [translateY]);

  const edit = () => { setDraft(value); setEditing(true); };
  const confirm = () => {
    if (disabled || !isValidTime(draft)) return;
    onChange(draft);
    setEditing(false);
    Keyboard.dismiss();
  };
  const changeWheel = (hour, minute) => {
    setEditing(false);
    Keyboard.dismiss();
    onChange(`${pad(hour)}:${pad(minute)}`);
  };

  return (
    <Animated.View style={[styles.panel, { transform: [{ translateY }] }]} testID="inline-time-picker">
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {editing ? (
          <>
            <TextInput accessibilityLabel="Hora completa, HH:MM" editable={!disabled}
              style={styles.input} value={draft} onChangeText={text => setDraft(formatTimeInput(text))}
              keyboardType="number-pad" maxLength={5} autoFocus selectTextOnFocus
              onSubmitEditing={confirm} returnKeyType="done" />
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Aplicar hora"
              accessibilityState={{ disabled: disabled || !isValidTime(draft) }}
              disabled={disabled || !isValidTime(draft)} activeOpacity={0.7} style={styles.control} onPress={confirm}>
              <Text style={[styles.apply, !isValidTime(draft) && styles.muted]}>Aplicar</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Editar hora completa"
            accessibilityState={{ disabled }} disabled={disabled} activeOpacity={0.7} style={styles.control} onPress={edit}>
            <Text style={styles.selectedNumber}>{value}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar seletor de hora"
          accessibilityState={{ disabled }} disabled={disabled} activeOpacity={0.7} style={styles.control} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {editing && !isValidTime(draft) && (
        <Text style={styles.muted} accessibilityLiveRegion="polite">Introduz uma hora entre 00:00 e 23:59.</Text>
      )}
      <View style={styles.wheels}>
        <TimeWheel value={hours} range={24} label="Horas" disabled={disabled} styles={styles}
          onEdit={edit} onChange={hour => changeWheel(hour, minutes)} />
        <Text style={styles.separator}>:</Text>
        <TimeWheel value={minutes} range={60} label="Minutos" disabled={disabled} styles={styles}
          onEdit={edit} onChange={minute => changeWheel(hours, minute)} />
      </View>
    </Animated.View>
  );
}

const createStyles = colors => StyleSheet.create({
  panel: createTaskSheetStyles(colors).pickerPanel,
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, color: colors.textSecondary, fontSize: 14 },
  control: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  input: { width: 76, minHeight: 44, color: colors.text, fontSize: 20, textAlign: 'center', padding: 0 },
  apply: { color: colors.selectionText, fontSize: 13, fontWeight: '600' },
  muted: { color: colors.textMuted, fontSize: 12 },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  column: { width: 96, alignItems: 'center' },
  columnLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  wheel: { height: ROW_HEIGHT * 5, flexGrow: 0, width: '100%' },
  wheelContent: { paddingVertical: ROW_HEIGHT * 2 },
  row: { height: ROW_HEIGHT, textAlign: 'center', textAlignVertical: 'center' },
  number: { color: colors.textMuted, fontSize: 20 },
  selectedNumber: { color: colors.selectionText, fontSize: 24, fontWeight: '700' },
  separator: { color: colors.textSecondary, fontSize: 24, marginHorizontal: 16 },
});
