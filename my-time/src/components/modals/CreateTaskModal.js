import TaskBanner from '../TaskBanner';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  Animated,
  useWindowDimensions,
  Keyboard,
  PanResponder,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { getCategory, getCategoryOptions } from '../../config/categories';
import { useTheme } from '../../theme/ThemeContext';
import {
  createTaskSheetStyles,
  TASK_DETAILS_HEIGHT_RATIO,
} from '../../theme/styles/taskSheets.styles';
import { formatTimeFromMinutes } from '../../utils/time';
import { TIMELINE_START_MINUTES } from '../../constants/timeline';
import {
  formatDateForInput,
  getTodayDateInput,
  formatDateInput,
  isValidDateInput,
  dateInputToStorageDate,
  addDaysToDateInput,
  getDateDisplayLabel,
} from '../../utils/taskDateInput';
/* -------------------------------------------------------
   OPÇÕES
------------------------------------------------------- */
import { getFloatingButtonStyles } from '../../theme/styles/buttons.styles';

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

const getPriorityOptions = (colors) => [
  { id: null, label: 'Sem prioridade', color: colors.textMuted },
  { id: 'low', label: 'Baixa', color: colors.priority.low },
  { id: 'medium', label: 'Média', color: colors.priority.medium },
  { id: 'high', label: 'Alta', color: colors.priority.high },
];

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60} h`;
  }

  const hours = Math.floor(minutes / 60);

  const mins = minutes % 60;

  return `${hours} h ${mins} min`;
};

/* -------------------------------------------------------
   COMPONENTE
------------------------------------------------------- */

export default function CreateTaskModal({
  visible,
  onClose,
  onSave,
  banner,
  onDismissBanner,
  onExpand,
  expandedContent = null,
  onExpandedClose,
  initialDate = null,
  initialMinutes = null,
}) {
  const { colors, isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const buttonStyles = getFloatingButtonStyles(isDark);
  const categoryOptions = useMemo(() => getCategoryOptions(colors), [colors]);
  const priorityOptions = useMemo(() => getPriorityOptions(colors), [colors]);
  const [title, setTitle] = useState('');

  const [description, setDescription] = useState('');

  const [duration, setDuration] = useState(30);

  const [priority, setPriority] = useState(null);

  const [categoryId, setCategoryId] = useState('inbox');

  const [durationPickerVisible, setDurationPickerVisible] = useState(false);

  const [priorityPickerVisible, setPriorityPickerVisible] = useState(false);

  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHandleActive, setIsHandleActive] = useState(false);
  const isBusy = isSaving || isTransitioning;
  const [dateValue, setDateValue] = useState(getTodayDateInput);
  const [dateEditorVisible, setDateEditorVisible] = useState(false);
  const isDateValid = isValidDateInput(dateValue);
  const isFormValid = Boolean(title.trim()) && isDateValid;
  const translateY = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(300);
  const dragOriginHeight = useRef(300);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const gestureActions = useRef(null);
  const transitioned = useRef(false);
  const handleDragged = useRef(false);
  const activeAnimation = useRef(null);

  const stopSheetAnimation = useCallback(() => {
    const animation = activeAnimation.current;
    // Invalidate first: stop() can synchronously invoke the completion callback.
    activeAnimation.current = null;
    animation?.stop();
  }, []);

  useLayoutEffect(() => {
    if (!visible || expandedContent) stopSheetAnimation();
    return stopSheetAnimation;
  }, [visible, expandedContent, stopSheetAnimation]);

  const selectedCategory = useMemo(() => getCategory(categoryId, colors), [categoryId, colors]);

  const selectedPriority = priorityOptions.find((item) => item.id === priority);
  /* -------------------------------------------------------
     RESET AO ABRIR
  ------------------------------------------------------- */

  useEffect(() => {
    if (!visible) {
      return;
    }

    stopSheetAnimation();
    setTitle('');
    setDescription('');
    setDuration(30);
    setPriority(null);
    setCategoryId('inbox');
    setDateValue(initialDate ? formatDateForInput(initialDate) : getTodayDateInput());
    setDateEditorVisible(false);
    setDurationPickerVisible(false);
    setPriorityPickerVisible(false);
    setCategoryPickerVisible(false);
    transitioned.current = false;
    handleDragged.current = false;
    setIsTransitioning(false);
    setIsHandleActive(false);
    translateY.setValue(0);
  }, [visible, initialDate, translateY, stopSheetAnimation]);

  /* -------------------------------------------------------
     GUARDAR
  ------------------------------------------------------- */

  const handleSave = async () => {
    if (!title.trim() || !isDateValid || isBusy || transitioned.current) {
      return;
    }

    try {
      setIsSaving(true);

      await onSave({
        title: title.trim(),
        notes: description.trim(),
        durationMinutes: duration,
        categoryId,
        priority,
        date: dateInputToStorageDate(dateValue),
        startTime: formatTimeFromMinutes(initialMinutes ?? TIMELINE_START_MINUTES),
      });
    } catch {
      // The parent presents the local error; keep this draft open.
    } finally {
      setIsSaving(false);
    }
  };

  /* -------------------------------------------------------
     EXPANSÃO PELO HANDLE
  ------------------------------------------------------- */

  const startSheetAnimation = (animation, onComplete) => {
    stopSheetAnimation();
    activeAnimation.current = animation;
    animation.start(({ finished }) => {
      if (activeAnimation.current !== animation) return;
      activeAnimation.current = null;
      if (!finished) {
        transitioned.current = false;
        setIsTransitioning(false);
        setIsHandleActive(false);
        translateY.setValue(0);
        return;
      }
      onComplete();
    });
  };

  const dismissQuickCreate = () => {
    stopSheetAnimation();
    transitioned.current = true;
    onClose();
  };

  const resetDrag = () => {
    if (transitioned.current) return;
    // Height and transform share one Animated.View, so both stay JS-driven.
    startSheetAnimation(
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: false }),
        Animated.spring(animatedHeight, {
          toValue: dragOriginHeight.current,
          useNativeDriver: false,
        }),
      ]),
      () => setIsHandleActive(false),
    );
  };

  const handleExpand = () => {
    if (isBusy || transitioned.current || !onExpand) return;
    if (!isDateValid) {
      setDateEditorVisible(true);
      resetDrag();
      return;
    }
    const draft = {
      title,
      notes: description,
      date: dateInputToStorageDate(dateValue),
      startTime: formatTimeFromMinutes(initialMinutes ?? TIMELINE_START_MINUTES),
      durationMinutes: duration,
      categoryId,
      priority,
    };
    stopSheetAnimation();
    transitioned.current = true;
    setIsTransitioning(true);
    Keyboard.dismiss();
    if (!isHandleActive) animatedHeight.setValue(sheetHeight.current);
    startSheetAnimation(
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: Math.round(windowHeight * TASK_DETAILS_HEIGHT_RATIO),
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]),
      () => onExpand(draft),
    );
  };

  const closeFromDrag = () => {
    if (isBusy || transitioned.current) return;
    stopSheetAnimation();
    transitioned.current = true;
    setIsTransitioning(true);
    Keyboard.dismiss();
    startSheetAnimation(
      Animated.timing(translateY, {
        toValue: sheetHeight.current,
        duration: 160,
        useNativeDriver: false,
      }),
      onClose,
    );
  };

  // Keep the responder stable while renders update draft and active-handle state.
  gestureActions.current = {
    isBusy,
    expand: handleExpand,
    close: closeFromDrag,
    reset: resetDrag,
    windowHeight,
  };
  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !gestureActions.current.isBusy && !transitioned.current,
        onStartShouldSetPanResponderCapture: () =>
          !gestureActions.current.isBusy && !transitioned.current,
        onMoveShouldSetPanResponder: () => !gestureActions.current.isBusy && !transitioned.current,
        onMoveShouldSetPanResponderCapture: () =>
          !gestureActions.current.isBusy && !transitioned.current,
        onPanResponderGrant: () => {
          stopSheetAnimation();
          handleDragged.current = true;
          dragOriginHeight.current = sheetHeight.current;
          animatedHeight.setValue(sheetHeight.current);
          setIsHandleActive(true);
          Keyboard.dismiss();
        },
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy < 0) {
            animatedHeight.setValue(
              Math.min(
                gestureActions.current.windowHeight * 0.94,
                dragOriginHeight.current - gesture.dy,
              ),
            );
            translateY.setValue(0);
          } else {
            animatedHeight.setValue(dragOriginHeight.current);
            translateY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -45 || (Math.abs(gesture.dy) < 4 && Math.abs(gesture.dx) < 4))
            gestureActions.current.expand();
          else if (gesture.dy > 55) gestureActions.current.close();
          else gestureActions.current.reset();
        },
        onPanResponderTerminate: () => gestureActions.current.reset(),
      }),
    [animatedHeight, translateY, stopSheetAnimation],
  );

  const timeLabel = formatTimeFromMinutes(initialMinutes ?? TIMELINE_START_MINUTES);
  const dateLabel = isDateValid ? getDateDisplayLabel(dateValue) : 'Data inválida';

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <>
      {/* ---------------------------------------------------
          QUICK CREATE
      --------------------------------------------------- */}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={expandedContent ? onExpandedClose : dismissQuickCreate}
      >
        {expandedContent || (
          <KeyboardAvoidingView
            style={styles.overlay}
            behavior="padding"
            keyboardVerticalOffset={0}
          >
            {/* FUNDO */}

            <Pressable style={styles.backdrop} onPress={dismissQuickCreate} />
            <TaskBanner
              notice={visible ? banner : null}
              onDismiss={onDismissBanner}
              placement="top"
            />

            {/* SHEET */}
            <SafeAreaView style={styles.safe} edges={['bottom']}>
              <Animated.View
                testID="quick-task-sheet"
                style={[
                  styles.sheet,
                  { transform: [{ translateY }] },
                  (isHandleActive || isTransitioning) && { height: animatedHeight },
                ]}
                onLayout={(event) => {
                  sheetHeight.current = event.nativeEvent.layout.height;
                }}
              >
                <View style={styles.topBar}>
                  <View {...handlePanResponder.panHandlers} style={styles.dragZone}>
                    <Pressable
                      style={styles.expandHandle}
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityLabel="Expandir detalhes da tarefa"
                      accessibilityHint="Arrasta para cima para abrir detalhes ou para baixo para fechar"
                      accessibilityState={{ disabled: isBusy }}
                      accessibilityActions={[{ name: 'activate', label: 'Abrir detalhes' }]}
                      onAccessibilityAction={(event) => {
                        if (event.nativeEvent.actionName === 'activate') handleExpand();
                      }}
                      onPressIn={() => {
                        handleDragged.current = true;
                      }}
                  
                    >
                      <View
                        testID="task-sheet-handle"
                        style={[styles.handle, isHandleActive && styles.handleActive]}
                      />
                    </Pressable>
                  </View>
                </View>

                <ScrollView
                  style={styles.contentScroll}
                  contentContainerStyle={styles.content}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {/* TÍTULO */}

                  <TextInput
                    editable={!isBusy}
                    accessibilityLabel="Título da tarefa"
                    style={styles.titleInput}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="O que vais fazer?"
                    placeholderTextColor={colors.placeholder}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />

                  {/* DESCRIÇÃO */}

                  <TextInput
                    editable={!isBusy}
                    accessibilityLabel="Descrição"
                    style={styles.descriptionInput}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Descrição (opcional)"
                    placeholderTextColor={colors.placeholder}
                    multiline
                  />

                  {dateEditorVisible && (
                    <View style={styles.dateEditor}>
                      <Text style={styles.dateLabel}>Data da tarefa</Text>
                      <TextInput
                        accessibilityLabel="Data da tarefa, dia mês e ano"
                        editable={!isBusy}
                        value={dateValue}
                        onChangeText={(value) => setDateValue(formatDateInput(value))}
                        keyboardType="number-pad"
                        maxLength={10}
                        placeholder="DD/MM/AAAA"
                        placeholderTextColor={colors.placeholder}
                        style={styles.dateInput}
                      />
                      {!isDateValid && (
                        <Text accessibilityRole="alert" style={styles.dateError}>
                          Introduz uma data válida no formato DD/MM/AAAA.
                        </Text>
                      )}
                      <View style={styles.dateShortcuts}>
                        <TouchableOpacity
                          disabled={isBusy}
                          accessibilityRole="button"
                          accessibilityState={{
                            disabled: isBusy,
                            selected: dateValue === getTodayDateInput(),
                          }}
                          onPress={() => setDateValue(getTodayDateInput())}
                          style={styles.dateShortcut}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dateShortcutText}>Hoje</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={isBusy}
                          accessibilityRole="button"
                          accessibilityState={{
                            disabled: isBusy,
                            selected: dateValue === addDaysToDateInput(getTodayDateInput(), 1),
                          }}
                          onPress={() => setDateValue(addDaysToDateInput(getTodayDateInput(), 1))}
                          style={styles.dateShortcut}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dateShortcutText}>Amanhã</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* ------------------------------------------------
                AÇÕES
            ------------------------------------------------ */}

                  <View style={styles.actionsSection}>
                    <ScrollView
                      style={styles.optionsScroll}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.actionsRow}
                    >
                      {/* HORA */}

                      <TouchableOpacity
                        style={styles.actionPill}
                        activeOpacity={0.7}
                        disabled={isBusy}
                        accessibilityRole="button"
                        accessibilityLabel={`Data: ${dateLabel}. Hora: ${timeLabel}`}
                        accessibilityState={{ disabled: isBusy, expanded: dateEditorVisible }}
                        onPress={() => setDateEditorVisible((value) => !value || !isDateValid)}
                      >
                        <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />

                        <Text style={styles.actionText}>
                          {dateLabel}, {timeLabel}
                        </Text>
                      </TouchableOpacity>

                      {/* DURAÇÃO */}

                      <TouchableOpacity
                        disabled={isBusy}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isBusy }}
                        accessibilityLabel={`Duração: ${formatDuration(duration)}`}
                        style={styles.actionPill}
                        activeOpacity={0.7}
                        onPress={() => setDurationPickerVisible(true)}
                      >
                        <Ionicons name="timer-outline" size={15} color={colors.textSecondary} />

                        <Text style={styles.actionText}>{formatDuration(duration)}</Text>
                      </TouchableOpacity>

                      {/* CATEGORIA */}

                      <TouchableOpacity
                        disabled={isBusy}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isBusy }}
                        accessibilityLabel={`Categoria: ${selectedCategory.label}`}
                        style={styles.iconButton}
                        activeOpacity={0.7}
                        onPress={() => setCategoryPickerVisible(true)}
                      >
                        <Ionicons
                          name={selectedCategory.icon}
                          size={16}
                          color={selectedCategory.color}
                        />
                      </TouchableOpacity>

                      {/* PRIORIDADE */}

                      <TouchableOpacity
                        disabled={isBusy}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isBusy }}
                        accessibilityLabel={`Prioridade: ${selectedPriority.label}`}
                        style={styles.iconButton}
                        activeOpacity={0.7}
                        onPress={() => setPriorityPickerVisible(true)}
                      >
                        <Ionicons name="flag-outline" size={16} color={selectedPriority.color} />
                      </TouchableOpacity>
                    </ScrollView>

                    {isFormValid && <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: isBusy,
                        busy: isSaving,
                      }}
                      accessibilityLabel={isSaving ? 'A guardar tarefa' : 'Criar tarefa'}
                      style={[buttonStyles.floatingButton, styles.sheetActionButton]}

                      disabled={isBusy}
                      onPress={handleSave}
                    >
                      <Ionicons
                        name={isSaving ? 'hourglass-outline' : 'arrow-up'}
                        size={22}
                        color={colors.text}
                      />
                    </TouchableOpacity>}
                  </View>
                </ScrollView>
              </Animated.View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        )}
      </Modal>

      {/* ---------------------------------------------------
          PICKER DURAÇÃO
      --------------------------------------------------- */}

      <Modal
        visible={durationPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDurationPickerVisible(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setDurationPickerVisible(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Duração</Text>

            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
              {DURATION_OPTIONS.map((item) => (
                <TouchableOpacity
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isBusy, selected: item === duration }}
                  key={item}
                  style={styles.pickerRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setDuration(item);

                    setDurationPickerVisible(false);
                  }}
                >
                  <Text
                    style={[styles.pickerRowText, item === duration && styles.pickerRowTextActive]}
                  >
                    {formatDuration(item)}
                  </Text>

                  {item === duration && (
                    <Ionicons name="checkmark" size={20} color={colors.selectionText} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ---------------------------------------------------
          PICKER PRIORIDADE
      --------------------------------------------------- */}

      <Modal
        visible={priorityPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPriorityPickerVisible(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setPriorityPickerVisible(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Prioridade</Text>

            {priorityOptions.map((item) => (
              <TouchableOpacity
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy, selected: item.id === priority }}
                key={item.id ?? 'none'}
                style={styles.pickerRow}
                activeOpacity={0.7}
                onPress={() => {
                  setPriority(item.id);
                  setPriorityPickerVisible(false);
                }}
              >
                <View style={styles.categoryLeft}>
                  <Ionicons name="flag-outline" size={20} color={item.color} />
                  <Text
                    style={[
                      styles.pickerRowText,
                      item.id === priority && styles.pickerRowTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>

                {item.id === priority && (
                  <Ionicons name="checkmark" size={20} color={colors.selectionText} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ---------------------------------------------------
          PICKER CATEGORIA
      --------------------------------------------------- */}

      <Modal
        visible={categoryPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setCategoryPickerVisible(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Categoria</Text>

            {categoryOptions.map((item) => (
              <TouchableOpacity
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy, selected: item.id === categoryId }}
                key={item.id}
                style={styles.categoryRow}
                activeOpacity={0.7}
                onPress={() => {
                  setCategoryId(item.id);

                  setCategoryPickerVisible(false);
                }}
              >
                <View style={styles.categoryLeft}>
                  <Ionicons name={item.icon} size={20} color={item.color} />

                  <Text
                    style={[
                      styles.categoryText,

                      item.id === categoryId && styles.categoryTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>

                {item.id === categoryId && (
                  <Ionicons name="checkmark" size={20} color={colors.text} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */

const createStyles = (colors) => {
  const sheetStyles = createTaskSheetStyles(colors);
  return StyleSheet.create({
    /* ---------------------------------------------------
       MODAL
    --------------------------------------------------- */

    overlay: { ...sheetStyles.overlay, justifyContent: 'flex-end' },

    backdrop: sheetStyles.backdrop,

    sheet: { ...sheetStyles.surface, maxHeight: '100%' },
    topBar: sheetStyles.topBar,
    dragZone: { ...sheetStyles.dragZone, height: 44 },
    expandHandle: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contentScroll: { flexGrow: 0, flexShrink: 1 },
    content: { ...sheetStyles.content, paddingBottom: 12 },

    handle: sheetStyles.handle,
    handleActive: { width: 54, backgroundColor: colors.selection },

    /* ---------------------------------------------------
       INPUTS
    --------------------------------------------------- */

    titleInput: {
      minHeight: 46,

      borderRadius: 12,

      backgroundColor: colors.surfaceSoft,

      paddingHorizontal: 12,

      fontSize: 17,
      fontWeight: '500',

      color: colors.text,

      marginBottom: 4,
    },

    descriptionInput: {
      minHeight: 34,

      paddingHorizontal: 12,
      paddingVertical: 7,

      fontSize: 14,

      color: colors.textSecondary,
    },

    /* ---------------------------------------------------
       AÇÕES
    --------------------------------------------------- */

    dateEditor: { marginTop: 8, marginBottom: 4 },
    dateLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
    dateInput: {
      minHeight: 44,
      color: colors.text,
      backgroundColor: colors.input,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 15,
    },
    dateError: { color: colors.danger, fontSize: 12, marginTop: 6 },
    dateShortcuts: { flexDirection: 'row', gap: 8, marginTop: 4 },
    dateShortcut: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
    dateShortcutText: { color: colors.selectionText, fontSize: 13, fontWeight: '600' },

    actionsSection: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
    optionsScroll: { flex: 1 },

    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',

      gap: 5,

      paddingRight: 3,
    },

    actionPill: {
      height: 44,

      paddingHorizontal: 9,

      borderRadius: 10,

      backgroundColor: colors.taskSheet.chipBackground,
      borderWidth: 1,
      borderColor: colors.taskSheet.chipBorder,

      flexDirection: 'row',
      alignItems: 'center',

      gap: 5,
    },

    actionText: {
      fontSize: 12,
      fontWeight: '500',

      color: colors.textSecondary,
    },

    iconButton: {
      width: 44,
      height: 44,

      borderRadius: 10,

      alignItems: 'center',
      justifyContent: 'center',

      backgroundColor: colors.taskSheet.chipBackground,
      borderWidth: 1,
      borderColor: colors.taskSheet.chipBorder,
    },

    sheetActionButton: sheetStyles.actionButton,

    /* ---------------------------------------------------
       CRIAR
    --------------------------------------------------- */

    saveButton: {
      ...sheetStyles.button,
      width: 42,
      flexShrink: 1,
      borderRadius: 25,
      backgroundColor: colors.selection,
    },

    saveButtonDisabled: {
      opacity: 0.4,
      backgroundColor: colors.selection,

    },

    /* ---------------------------------------------------
       PICKERS
    --------------------------------------------------- */

    pickerOverlay: {
      flex: 1,

      justifyContent: 'flex-end',

      backgroundColor: colors.taskSheet.backdrop,
    },

    pickerCard: {
      backgroundColor: colors.taskSheet.surface,

      borderTopLeftRadius: 20,

      borderTopRightRadius: 20,

      paddingHorizontal: 18,

      paddingTop: 18,
      paddingBottom: 24,
    },

    pickerTitle: {
      fontSize: 17,

      fontWeight: '700',

      color: colors.text,

      marginBottom: 10,
    },

    pickerScroll: {
      maxHeight: 360,
    },

    pickerRow: {
      minHeight: 48,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent: 'space-between',

      borderBottomWidth: StyleSheet.hairlineWidth,

      borderBottomColor: colors.borderSoft,
    },

    pickerRowText: {
      fontSize: 15,

      color: colors.textSecondary,
    },

    pickerRowTextActive: {
      fontWeight: '700',

      color: colors.text,
    },

    categoryRow: {
      minHeight: 50,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent: 'space-between',

      borderBottomWidth: StyleSheet.hairlineWidth,

      borderBottomColor: colors.borderSoft,
    },

    categoryLeft: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 12,
    },

    categoryText: {
      fontSize: 15,

      color: colors.textSecondary,
    },

    categoryTextActive: {
      fontWeight: '700',

      color: colors.text,
    },
  });
};
