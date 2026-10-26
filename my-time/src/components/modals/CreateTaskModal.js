import TaskBanner from '../TaskBanner';
import React, { useEffect, useMemo, useState } from 'react';

import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { getCategory, getCategoryOptions } from '../../config/categories';
import { useTheme } from '../../theme/ThemeContext';
/* -------------------------------------------------------
   OPÇÕES
------------------------------------------------------- */

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

const formatTimeFromMinutes = (totalMinutes) => {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;

  const hours = Math.floor(normalized / 60);

  const mins = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

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
  onMoreOptions,
  initialMinutes = null,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const selectedCategory = useMemo(() => getCategory(categoryId, colors), [categoryId, colors]);

  const selectedPriority = priorityOptions.find((item) => item.id === priority);
  /* -------------------------------------------------------
     RESET AO ABRIR
  ------------------------------------------------------- */

  useEffect(() => {
    if (!visible) {
      return;
    }

    setTitle('');
    setDescription('');
    setDuration(30);
    setPriority(null);
    setCategoryId('inbox');
  }, [visible]);

  /* -------------------------------------------------------
     GUARDAR
  ------------------------------------------------------- */

  const handleSave = async () => {
    if (!title.trim() || isSaving) {
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
      });
    } finally {
      setIsSaving(false);
    }
  };

  /* -------------------------------------------------------
     MAIS OPÇÕES
  ------------------------------------------------------- */

  const handleMoreOptions = () => {
    onMoreOptions?.({
      title: title.trim(),
      notes: description.trim(),
      startTime:
        initialMinutes != null
          ? formatTimeFromMinutes(initialMinutes)
          : '07:00',
      durationMinutes: duration,
      categoryId,
      priority,
    });
  };
  /* -------------------------------------------------------
     LABEL DA HORA
  ------------------------------------------------------- */

  const timeLabel =
    initialMinutes == null ? '--:--' : formatTimeFromMinutes(initialMinutes);

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
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          {/* FUNDO */}

          <Pressable style={styles.backdrop} onPress={onClose} />
          <TaskBanner notice={visible ? banner : null} onDismiss={onDismissBanner} placement="top" />

          {/* SHEET */}

          <View style={styles.sheet}>
            {/* HANDLE */}

            <View style={styles.handle} />

            {/* TÍTULO */}

            <TextInput
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
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Descrição (opcional)"
              placeholderTextColor={colors.placeholder}
              multiline
            />

            {/* ------------------------------------------------
                AÇÕES
            ------------------------------------------------ */}

            <View style={styles.actionsSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.actionsRow}
              >
                {/* HORA */}

                <View style={styles.actionPill}>
                  <Ionicons name="calendar-outline" size={17} color={colors.textSecondary} />

                  <Text style={styles.actionText}>Hoje, {timeLabel}</Text>
                </View>

                {/* DURAÇÃO */}

                <TouchableOpacity
                  style={styles.actionPill}
                  activeOpacity={0.75}
                  onPress={() => setDurationPickerVisible(true)}
                >
                  <Ionicons name="timer-outline" size={17} color={colors.textSecondary} />

                  <Text style={styles.actionText}>
                    {formatDuration(duration)}
                  </Text>
                </TouchableOpacity>

                {/* CATEGORIA */}

                <TouchableOpacity
                  style={styles.iconButton}
                  activeOpacity={0.75}
                  onPress={() => setCategoryPickerVisible(true)}
                >
                  <Ionicons
                    name={selectedCategory.icon}
                    size={19}
                    color={selectedCategory.color}
                  />
                </TouchableOpacity>

                {/* PRIORIDADE */}

                <TouchableOpacity
                  style={styles.iconButton}
                  activeOpacity={0.75}
                  onPress={() => setPriorityPickerVisible(true)}
                >
                  <Ionicons
                    name="flag-outline"
                    size={17}
                    color={selectedPriority.color}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconButton}
                  activeOpacity={0.75}
                  onPress={handleMoreOptions}
                >
                  <MaterialCommunityIcons
                    name="dots-horizontal"
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </ScrollView>

              {/* ----------------------------------------------
                  CRIAR
                  Só existe depois de escrever.
              ---------------------------------------------- */}

              {title.trim().length > 0 && (
                <View style={styles.saveRow}>
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      isSaving && styles.saveButtonDisabled,
                    ]}
                    activeOpacity={0.75}
                    disabled={isSaving}
                    onPress={handleSave}
                  >
                    <Text style={styles.saveButtonText}>
                      {isSaving ? 'A guardar…' : 'Criar'}
                    </Text>

                    {!isSaving && (
                      <Image
                        source={require('../../../assets/abelha.png')}
                        style={styles.saveBee}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
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
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setDurationPickerVisible(false)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Duração</Text>

            <ScrollView
              style={styles.pickerScroll}
              keyboardShouldPersistTaps="handled"
            >
              {DURATION_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.pickerRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setDuration(item);

                    setDurationPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerRowText,

                      item === duration && styles.pickerRowTextActive,
                    ]}
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
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setPriorityPickerVisible(false)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Prioridade</Text>

            {priorityOptions.map((item) => (
              <TouchableOpacity
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
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setCategoryPickerVisible(false)}
        >
          <View style={styles.categoryCard}>
            <Text style={styles.pickerTitle}>Categoria</Text>

            {categoryOptions.map((item) => (
              <TouchableOpacity
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
                  <Ionicons name="checkmark" size={20} color={colors.selectionText} />
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

const createStyles = (colors) => StyleSheet.create({
  /* ---------------------------------------------------
       MODAL
    --------------------------------------------------- */

  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,

    backgroundColor: colors.backdrop,
  },

  sheet: {
    backgroundColor: colors.surface,

    paddingHorizontal: 16,
    paddingTop: 10,

    paddingBottom: Platform.OS === 'ios' ? 18 : 12,

    borderTopLeftRadius: 22,

    borderTopRightRadius: 22,

    borderWidth: 1,
    borderBottomWidth: 0,

    borderColor: colors.border,
  },

  handle: {
    alignSelf: 'center',

    width: 42,
    height: 4,

    borderRadius: 2,

    backgroundColor: colors.taskCardMuted,

    marginBottom: 14,
  },

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

  actionsSection: {
    marginTop: 8,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 5,

    paddingRight: 4,
  },

  actionPill: {
    height: 34,

    paddingHorizontal: 9,

    borderRadius: 10,

    backgroundColor: colors.surfaceSoft,

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
    width: 34,
    height: 34,

    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: colors.surfaceSoft,
  },

  /* ---------------------------------------------------
       CRIAR
    --------------------------------------------------- */

  saveRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  saveButton: {
    height: 40,

    paddingHorizontal: 14,

    flexDirection: 'row',

    alignItems: 'center',
    justifyContent: 'center',

    gap: 7,

    borderRadius: 10,

    backgroundColor: colors.selection,
  },

  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onAction,
  },

  saveBee: {
    width: 21,
    height: 21,

    resizeMode: 'contain',

    transform: [
      {
        rotate: '90deg',
      },
    ],
  },

  /* ---------------------------------------------------
       PICKERS
    --------------------------------------------------- */

  pickerOverlay: {
    flex: 1,

    justifyContent: 'flex-end',

    backgroundColor: colors.backdrop,
  },

  pickerCard: {
    backgroundColor: colors.surface,

    borderTopLeftRadius: 20,

    borderTopRightRadius: 20,

    paddingHorizontal: 18,

    paddingTop: 18,
    paddingBottom: 24,
  },

  categoryCard: {
    backgroundColor: colors.surface,

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
