
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { createTaskSheetStyles } from '../theme/styles/taskSheets.styles';
import {
  formatDateForInput,
  getTodayDateInput,
  isValidDateInput,
} from '../utils/taskDateInput';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

export default function InlineDatePicker({
  value,
  onSelect,
  onClose,
  disabled = false,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [month, setMonth] = useState(() => {
    const [, monthNumber, year] = (
      isValidDateInput(value) ? value : getTodayDateInput()
    ).split('/').map(Number);

    return new Date(year, monthNumber - 1, 1);
  });

  const offset = useRef(new Animated.Value(-48)).current;

  useEffect(() => {
    const animation = Animated.timing(offset, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [offset]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const leadingDays = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cellCount =
    Math.ceil((leadingDays + daysInMonth) / 7) * 7;

  const weeks = useMemo(() => {
    const cells = Array.from({ length: cellCount }, (_, index) => {
      const day = index - leadingDays + 1;

      return day >= 1 && day <= daysInMonth ? day : null;
    });

    const rows = [];

    for (let index = 0; index < cells.length; index += 7) {
      rows.push(cells.slice(index, index + 7));
    }

    return rows;
  }, [cellCount, leadingDays, daysInMonth]);

  const moveMonth = (delta) => {
    setMonth(new Date(year, monthIndex + delta, 1));
  };

  return (
    <Animated.View
      testID="inline-date-picker"
      style={[
        styles.panel,
        { transform: [{ translateY: offset }] },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          accessibilityState={{ disabled }}
          disabled={disabled}
          activeOpacity={0.7}
          style={styles.control}
          onPress={() => moveMonth(-1)}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={styles.month}
        >
          {MONTHS[monthIndex]} {year}
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Mês seguinte"
          accessibilityState={{ disabled }}
          disabled={disabled}
          activeOpacity={0.7}
          style={styles.control}
          onPress={() => moveMonth(1)}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Fechar calendário"
          accessibilityState={{ disabled }}
          disabled={disabled}
          activeOpacity={0.7}
          style={styles.control}
          onPress={onClose}
        >
          <Ionicons
            name="close"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {/* Cabeçalho: sempre 7 colunas */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((day, index) => (
            <View
              key={`weekday-${index}`}
              style={styles.weekday}
              accessible={false}
            >
              <Text style={styles.weekdayText}>
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Semanas: cada linha contém exatamente 7 células */}
        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {week.map((day, dayIndex) => {
              if (day === null) {
                return (
                  <View
                    key={`empty-${dayIndex}`}
                    style={styles.day}
                  />
                );
              }

              const date = formatDateForInput(
                new Date(year, monthIndex, day)
              );

              const selected = date === value;

              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  accessibilityRole="button"
                  accessibilityLabel={date}
                  accessibilityState={{ disabled, selected }}
                  disabled={disabled}
                  activeOpacity={0.7}
                  style={[
                    styles.day,
                    selected && styles.selectedDay,
                  ]}
                  onPress={() => onSelect(date)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selected && styles.selectedDayText,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  panel: createTaskSheetStyles(colors).pickerPanel,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },

  control: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  month: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  grid: {
    width: '100%',
  },

  weekRow: {
    flexDirection: 'row',
    width: '100%',
  },

  weekday: {
    flex: 1,
    minWidth: 0,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  weekdayText: {
    color: colors.textMuted,
    fontSize: 12,
  },

  day: {
    flex: 1,
    minWidth: 0,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },

  dayText: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  selectedDay: {
    backgroundColor: colors.selectionSoft,
  },

  selectedDayText: {
    color: colors.selectionText,
    fontWeight: '700',
  },
});
