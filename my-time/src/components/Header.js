import React, { useRef, useState } from 'react';import { StyleSheet, View, Text, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

// 1. CÁLCULO DE LARGURA PERFEITA (7 dias exatos por ecrã)
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STRIP_PADDING = 12; // Padding horizontal das bordas
const DAY_WIDTH = (SCREEN_WIDTH - (STRIP_PADDING * 2)) / 7;

// 2. GERADOR DE DATAS (Cria uma janela de 6 meses para poderes deslizar livremente)
const PAST_DAYS = 90;
const FUTURE_DAYS = 90;

const generateDateRange = () => {
  const start = new Date();
  start.setDate(start.getDate() - PAST_DAYS);
  const days = [];
  for (let i = 0; i < (PAST_DAYS + FUTURE_DAYS); i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
};

const ALL_DAYS = generateDateRange();

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const getCurrentPeriodIcon = () => {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 9) return { name: 'partly-sunny-outline', color: '#68D391' };
  if (hour >= 9 && hour < 12) return { name: 'sunny-outline', color: '#F6E05E' };
  if (hour >= 12 && hour < 14) return { name: 'restaurant-outline', color: '#F6AD55' };
  if (hour >= 14 && hour < 18) return { name: 'briefcase-outline', color: '#FC8181' };
  if (hour >= 18 && hour < 23) return { name: 'moon-outline', color: '#B794F4' };
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
  const now = new Date();
  const safeSelectedDate = selectedDate instanceof Date ? selectedDate : new Date();

  // Estado para o título do mês
  const [visibleDate, setVisibleDate] = useState(safeSelectedDate);

  const monthName = MONTHS[visibleDate.getMonth()];
  const year = visibleDate.getFullYear();
  const periodIcon = getCurrentPeriodIcon();

  // Índice inicial (para quando a app abre)
  const initialSelectedIndex = ALL_DAYS.findIndex((d) => isSameDay(d, safeSelectedDate));
  const initialCenteredIndex = Math.max(0, initialSelectedIndex - 3);

  // NOVO: Função que só faz scroll quando carregas no botão "Agora"
  const handleGoToNowPress = () => {
    // 1. Chama a função que vem do ecrã pai (para mudar a data)
    if (onGoToNow) onGoToNow();

    // 2. Faz scroll suave de volta para o dia de hoje
    const todayIndex = ALL_DAYS.findIndex((d) => isSameDay(d, now));
    const centerTodayIndex = Math.max(0, todayIndex - 3);
    
    if (flatListRef.current && todayIndex !== -1) {
      flatListRef.current.scrollToIndex({
        index: centerTodayIndex,
        animated: true,
      });
    }
  };

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

  return (
    <View style={styles.headerContainer}>
      {/* 1. LINHA SUPERIOR */}
      <View style={styles.topRow}>
        <Text style={styles.monthTitle}>{`${monthName} ${year}`}</Text>

        <View style={styles.centerTasksContainer} pointerEvents="none">
          <View style={styles.tasksInline}>
            <Ionicons name="checkmark-done" size={16} color={colors.success} />
            <Text style={styles.tasksText}>{`${completedTasks}/${totalTasks}`}</Text>
          </View>
        </View>

        <View style={styles.rightGroup}>
          {/* BOTÃO AGORA CHAMA A NOVA FUNÇÃO handleGoToNowPress */}
          <TouchableOpacity
            onPress={handleGoToNowPress}
            activeOpacity={0.7}
            style={styles.nowButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={periodIcon.name} size={15} color={periodIcon.color} />
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
        <FlatList
          ref={flatListRef}
          data={ALL_DAYS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.toISOString()}
          initialScrollIndex={initialCenteredIndex} // Só centra no arranque
          getItemLayout={(data, index) => ({
            length: DAY_WIDTH,
            offset: DAY_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          contentContainerStyle={styles.flatListContainer}
          renderItem={({ item: dateItem }) => {
            const isSelected = isSameDay(dateItem, safeSelectedDate);
            const isToday = isSameDay(dateItem, now);

            return (
              <TouchableOpacity
                style={styles.dayColumn}
                // Agora ao clicar, apenas seleciona, NÃO FAZ SCROLL
                onPress={() => onSelectDate && onSelectDate(dateItem)} 
                activeOpacity={0.7}
              >
                <Text style={[styles.weekLabelText, isSelected && styles.selectedWeekLabel]}>
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