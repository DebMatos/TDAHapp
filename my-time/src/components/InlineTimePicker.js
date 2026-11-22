import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { createTaskSheetStyles } from '../theme/styles/taskSheets.styles';
import { isValidTime, splitTimeInput } from '../utils/time';

export default function InlineTimePicker({ value, disabled = false, onChange }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [draft, setDraft] = useState(() => ({ hours: value.slice(0, 2), minutes: value.slice(3) }));
  const [focusTarget, setFocusTarget] = useState({ field: 'hours', selectAll: true });
  const hoursInput = useRef(null);
  const minutesInput = useRef(null);
  const latestInput = useRef({ disabled, onChange });
  latestInput.current = { disabled, onChange };

  useEffect(() => {
    setDraft({ hours: value.slice(0, 2), minutes: value.slice(3) });
  }, [value]);

  useEffect(() => {
    const input = focusTarget.field === 'hours' ? hoursInput : minutesInput;
    input.current?.focus();
  }, [focusTarget]);

  const applyTime = (next) => {
    if (latestInput.current.disabled || !isValidTime(next)) return;
    latestInput.current.onChange(next);
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
  const useCurrentTime = () => {
    if (latestInput.current.disabled) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const next = `${hours}:${minutes}`;
    setDraft({ hours, minutes });
    setFocusTarget({ field: 'minutes', selectAll: true });
    latestInput.current.onChange(next);
    Keyboard.dismiss();
  };

  const inputProps = (field, index) => ({
    ref: index === 0 ? hoursInput : minutesInput,
    accessibilityLabel: index === 0 ? 'Editar horas' : 'Editar minutos',
    editable: !disabled,
    style: [styles.input, focusTarget.field === field && styles.inputFocused],
    value: draft[field],
    selectionColor: "transparent",
    autoFocus: index === 0,

    selection: focusTarget.field === field ? {
      start: focusTarget.selectAll ? 0 : draft[field].length,
      end: draft[field].length,
    } : undefined,
    onFocus: () => {
      if (focusTarget.field !== field) setFocusTarget({ field, selectAll: true });
    },
    onPressOut: () => setFocusTarget({ field, selectAll: true }),
    onChangeText: index === 0 ? changeHours : changeMinutes,
    onKeyPress: event => {
      if (field === 'minutes' && event.nativeEvent.key === 'Backspace' && !draft.minutes) {
        setDraft(previous => ({ hours: previous.hours.slice(0, -1), minutes: '' }));
        setFocusTarget({ field: 'hours', selectAll: false });
      }
    },
    keyboardType: 'number-pad',
    showSoftInputOnFocus: true,
    maxLength: index === 0 ? 4 : 2,
    onSubmitEditing: index === 0
      ? () => {
        setFocusTarget({ field: 'minutes', selectAll: true });
        minutesInput.current?.focus();
      }
      : confirm,
    returnKeyType: index === 0 ? 'next' : 'done',
  });

  return (
    <View style={styles.panel} testID="inline-time-picker">
      {!isValidTime(`${draft.hours}:${draft.minutes}`) && (
        <Text style={styles.muted} accessibilityLiveRegion="polite">Introduz uma hora entre 00:00 e 23:59.</Text>
      )}
      <View style={styles.controls}>
        <View style={styles.timeInputPanel} testID="time-input-panel">
          <TextInput {...inputProps('hours', 0)} />
          <TextInput {...inputProps('minutes', 1)} />
          <View pointerEvents="none" style={styles.separatorContainer}>
            <Text style={styles.separator}>:</Text>
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Usar hora atual"
          accessibilityHint="Preenche a hora sem guardar a tarefa"
          accessibilityState={{ disabled }}
          activeOpacity={0.7}
          disabled={disabled}
          onPress={useCurrentTime}
          style={[styles.nowButton, disabled && styles.nowButtonDisabled]}
        >
          <Image
            accessibilityIgnoresInvertColors
            source={isDark
              ? require('../../assets/pirilampo.png')
              : require('../../assets/abelha.png')}
            style={[styles.nowIcon, isDark && styles.nowIconDark]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  panel: createTaskSheetStyles(colors).pickerPanel,
  muted: { color: colors.textMuted, fontSize: 12, marginBottom: 8, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 10 },
  timeInputPanel: {
    width: 160,
    height: 48,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    height: '100%',
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    padding: 0,
  },
  inputFocused: { color: colors.selection },
  separatorContainer: {
    position: 'absolute',
    left: '50%',
    width: 16,
    marginLeft: -8,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    color: colors.textSecondary,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  nowButton: {
    height: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    borderRadius: 22,
    borderWidth: isDark ? 1.5 : 1,
    borderColor: isDark ? colors.now : colors.floatingButton.border,
    backgroundColor: colors.floatingButton.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  nowButtonDisabled: { opacity: 0.45 },
  nowIcon: { width: 20, height: 20, resizeMode: 'contain' },
  nowIconDark: { width: 25, height: 25 },
  nowText: { color: colors.text, fontSize: 12, fontWeight: '600' },
});
