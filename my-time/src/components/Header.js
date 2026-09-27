import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  VirtualizedList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { isSameDay } from '../utils/date';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STRIP_PADDING = 12;
const DAY_WIDTH = (SCREEN_WIDTH - STRIP_PADDING * 2) / 7;
const TOTAL_DAYS = 100001;
import { getTimelineDate } from '../utils/timelineDate';
const CENTER_INDEX = Math.floor(TOTAL_DAYS / 2);

const REFERENCE_DATE = new Date();

REFERENCE_DATE.setHours(0, 0, 0, 0);

const getDateForIndex = (index) => {
  const date = new Date(REFERENCE_DATE);

  const offset = index - CENTER_INDEX;

  date.setDate(date.getDate() + offset);

  return date;
};

const getIndexForDate = (date) => {
  const normalized = new Date(date);

  normalized.setHours(0, 0, 0, 0);

  const diffMs = normalized - REFERENCE_DATE;

  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  return CENTER_INDEX + diffDays;
};

const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const getCurrentPeriodIcon = () => {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 9)
    return { name: 'partly-sunny-outline', color: '#68D391' };
  if (hour >= 9 && hour < 12)
    return { name: 'sunny-outline', color: '#F6E05E' };
  if (hour >= 12 && hour < 14)
    return { name: 'restaurant-outline', color: '#F6AD55' };
  if (hour >= 14 && hour < 18)
    return { name: 'briefcase-outline', color: '#FC8181' };
  if (hour >= 18 && hour < 23)
    return { name: 'moon-outline', color: '#B794F4' };
  return { name: 'bed-outline', color: '#7F9CF5' };
};

export default function Header({
  onMenuPress,
  selectedDate,
  onSelectDate,
  onGoToNow,
  completedTasks = 0,
  totalTasks = 0,
}) {
  const flatListRef = useRef(null);
  const now = getTimelineDate(new Date());
  const safeSelectedDate =
    selectedDate instanceof Date ? selectedDate : new Date();

  // Estado para o título do mês
  const [visibleDate, setVisibleDate] = useState(safeSelectedDate);

  const monthName = MONTHS[visibleDate.getMonth()];
  const year = visibleDate.getFullYear();
  const periodIcon = getCurrentPeriodIcon();

  const initialSelectedIndex = getIndexForDate(safeSelectedDate);
  const initialCenteredIndex = Math.max(0, initialSelectedIndex - 3);

  // Deteta os itens visíveis para atualizar o título do mês ao deslizar (swipe)
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      const middleIndex = Math.floor(viewableItems.length / 2);
      const middleItem = viewableItems[middleIndex].item;
      setVisibleDate(middleItem);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleGoToNow = () => {
    const currentTimelineDate = getTimelineDate(new Date());

    const targetIndex = getIndexForDate(currentTimelineDate);

    const centeredIndex = Math.max(0, targetIndex - 3);

    flatListRef.current?.scrollToIndex({
      index: centeredIndex,
      animated: true,
    });

    setVisibleDate(currentTimelineDate);

    onGoToNow?.();
  };
  return (
    <View style={styles.headerContainer}>
      {/* 1. LINHA SUPERIOR */}
      <View style={styles.topRow}>
        <Text style={styles.monthTitle}>{`${monthName} ${year}`}</Text>

        <View style={styles.centerTasksContainer} pointerEvents="none">
          <View style={styles.tasksInline}>
            <Ionicons name="checkmark-done" size={16} color={colors.success} />
            <Text
              style={styles.tasksText}
            >{`${completedTasks}/${totalTasks}`}</Text>
          </View>
        </View>

        <View style={styles.rightGroup}>
          <TouchableOpacity
            onPress={handleGoToNow}
            activeOpacity={0.7}
            style={styles.nowButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={periodIcon.name}
              size={15}
              color={periodIcon.color}
            />
            <Text style={styles.nowText}>Agora</Text>
          </TouchableOpacity>

          <TouchableOpacity
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={onMenuPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. FAIXA DESLIZÁVEL */}
      <View style={{ height: 60 }}>
        <VirtualizedList
          ref={flatListRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialCenteredIndex}
          initialNumToRender={14}
          windowSize={7}
          getItemCount={() => TOTAL_DAYS}
          getItem={(_data, index) => getDateForIndex(index)}
          getItemLayout={(_data, index) => ({
            length: DAY_WIDTH,

            offset: DAY_WIDTH * index,

            index,
          })}
          keyExtractor={(item) => item.toISOString()}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          contentContainerStyle={styles.flatListContainer}
          renderItem={({ item: dateItem }) => {
            const isSelected = isSameDay(dateItem, safeSelectedDate);

            const isToday = isSameDay(dateItem, now);

            return (
              <TouchableOpacity
                style={styles.dayColumn}
                onPress={() => onSelectDate?.(dateItem)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.weekLabelText,
                    isSelected && styles.selectedWeekLabel,
                  ]}
                >
                  {WEEK_LABELS[dateItem.getDay()]}
                </Text>

                <View
                  style={[
                    styles.dayNumberCircle,
                    isSelected && styles.selectedDayCircle,
                    !isSelected && isToday && styles.todayCircle,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumberText,
                      isSelected && styles.selectedDayText,
                      !isSelected && isToday && styles.todayText,
                    ]}
                  >
                    {dateItem.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: colors.surface,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 14,
    position: 'relative',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  centerTasksContainer: {
    position: 'absolute',
    left: 20,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasksInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tasksText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  nowText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  iconButton: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* FLATLIST STYLES */
  flatListContainer: {
    paddingHorizontal: STRIP_PADDING,
  },
  dayColumn: {
    alignItems: 'center',
    width: DAY_WIDTH, //Garante que 7 dias cabem matematicamente no ecrã
  },
  weekLabelText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 6,
  },
  selectedWeekLabel: {
    color: colors.selectionText,
    fontWeight: '700',
  },
  dayNumberCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  selectedDayCircle: {
    backgroundColor: colors.selection,
    borderRadius: 17,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  todayCircle: {
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.selectionText,
    backgroundColor: colors.selectionSoft,
  },
  todayText: {
    color: colors.selectionText,
    fontWeight: '700',
  },
});
