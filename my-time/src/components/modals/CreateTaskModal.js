import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

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

import {
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

/* -------------------------------------------------------
   OPÇÕES
------------------------------------------------------- */

const DURATION_OPTIONS = [
  5,
  10,
  15,
  20,
  30,
  45,
  60,
  90,
  120,
];

const CATEGORY_OPTIONS = [
  {
    id: 'inbox',
    label: 'Caixa de Entrada',
    icon: 'archive-outline',
    color: '#4F75E2',
  },
  {
    id: 'work',
    label: 'Trabalho',
    icon: 'briefcase-outline',
    color: '#E0783E',
  },
  {
    id: 'personal',
    label: 'Pessoal',
    icon: 'home-outline',
    color: '#FC8181',
  },
  {
    id: 'exercise',
    label: 'Exercício',
    icon: 'barbell-outline',
    color: '#38A169',
  },
  {
    id: 'shopping',
    label: 'Compras',
    icon: 'cube-outline',
    color: '#B794F4',
  },
];

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

const formatTimeFromMinutes = (
  totalMinutes
) => {
  const normalized =
    ((totalMinutes % 1440) +
      1440) %
    1440;

  const hours =
    Math.floor(normalized / 60);

  const mins =
    normalized % 60;

  return `${String(hours).padStart(
    2,
    '0'
  )}:${String(mins).padStart(
    2,
    '0'
  )}`;
};

const formatDuration = (
  minutes
) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60} h`;
  }

  const hours =
    Math.floor(minutes / 60);

  const mins =
    minutes % 60;

  return `${hours} h ${mins} min`;
};

/* -------------------------------------------------------
   COMPONENTE
------------------------------------------------------- */

export default function CreateTaskModal({
  visible,
  onClose,
  onSave,
  onMoreOptions,
  initialMinutes = null,
}) {
  const [title, setTitle] =
    useState('');

  const [
    description,
    setDescription,
  ] = useState('');

  const [
    duration,
    setDuration,
  ] = useState(30);

  const [
    categoryId,
    setCategoryId,
  ] = useState('inbox');

  const [
    durationPickerVisible,
    setDurationPickerVisible,
  ] = useState(false);

  const [
    categoryPickerVisible,
    setCategoryPickerVisible,
  ] = useState(false);

  const selectedCategory =
    useMemo(
      () =>
        CATEGORY_OPTIONS.find(
          (item) =>
            item.id === categoryId
        ) ||
        CATEGORY_OPTIONS[0],
      [categoryId]
    );

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
    setCategoryId('inbox');
  }, [visible]);

  /* -------------------------------------------------------
     GUARDAR
  ------------------------------------------------------- */

  const handleSave = () => {
    if (!title.trim()) {
      return;
    }

    onSave({
      title:
        title.trim(),

      description:
        description.trim(),

      duration,

      categoryId,
    });
  };

  /* -------------------------------------------------------
     MAIS OPÇÕES
  ------------------------------------------------------- */

const handleMoreOptions = () => {
  onMoreOptions?.({
    title: title.trim(),
    description: description.trim(),

    startMinsPlanned:
      initialMinutes,

    timeOfDay:
      initialMinutes != null
        ? formatTimeFromMinutes(
            initialMinutes
          )
        : null,

    timeMinutes:
      duration,

    duration,

    categoryId,
  });
};

  /* -------------------------------------------------------
     LABEL DA HORA
  ------------------------------------------------------- */

  const timeLabel =
    initialMinutes == null
      ? '--:--'
      : formatTimeFromMinutes(
          initialMinutes
        );

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

          <Pressable
            style={
              styles.backdrop
            }
            onPress={onClose}
          />

          {/* SHEET */}

          <View
            style={styles.sheet}
          >
            {/* HANDLE */}

            <View
              style={styles.handle}
            />

            {/* TÍTULO */}

            <TextInput
              style={
                styles.titleInput
              }
              value={title}
              onChangeText={
                setTitle
              }
              placeholder="O que vais fazer?"
              placeholderTextColor="#A79F99"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={
                handleSave
              }
            />

            {/* DESCRIÇÃO */}

            <TextInput
              style={
                styles.descriptionInput
              }
              value={
                description
              }
              onChangeText={
                setDescription
              }
              placeholder="Descrição (opcional)"
              placeholderTextColor="#A79F99"
              multiline
            />

            {/* ------------------------------------------------
                AÇÕES
            ------------------------------------------------ */}

            <View
              style={
                styles.actionsSection
              }
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={
                  styles.actionsRow
                }
              >
                {/* HORA */}

                <View
                  style={
                    styles.actionPill
                  }
                >
                  <Ionicons
                    name="calendar-outline"
                    size={17}
                    color="#4E4844"
                  />

                  <Text
                    style={
                      styles.actionText
                    }
                  >
                    Hoje, {timeLabel}
                  </Text>
                </View>

                {/* DURAÇÃO */}

                <TouchableOpacity
                  style={
                    styles.actionPill
                  }
                  activeOpacity={
                    0.75
                  }
                  onPress={() =>
                    setDurationPickerVisible(
                      true
                    )
                  }
                >
                  <Ionicons
                    name="timer-outline"
                    size={17}
                    color="#4E4844"
                  />

                  <Text
                    style={
                      styles.actionText
                    }
                  >
                    {formatDuration(
                      duration
                    )}
                  </Text>
                </TouchableOpacity>

                {/* CATEGORIA */}

                <TouchableOpacity
                  style={
                    styles.iconButton
                  }
                  activeOpacity={
                    0.75
                  }
                  onPress={() =>
                    setCategoryPickerVisible(
                      true
                    )
                  }
                >
                  <Ionicons
                    name={
                      selectedCategory.icon
                    }
                    size={19}
                    color={
                      selectedCategory.color
                    }
                  />
                </TouchableOpacity>

                {/* PRIORIDADE */}

                <TouchableOpacity
                  style={
                    styles.iconButton
                  }
                  activeOpacity={
                    0.75
                  }
                >
                  <Ionicons
                    name="flag-outline"
                    size={19}
                    color="#57504B"
                  />
                </TouchableOpacity>

                {/* ETIQUETA */}

                <TouchableOpacity
                  style={
                    styles.iconButton
                  }
                  activeOpacity={
                    0.75
                  }
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={19}
                    color="#57504B"
                  />
                </TouchableOpacity>

                {/* MAIS */}

                <TouchableOpacity
                  style={
                    styles.iconButton
                  }
                  activeOpacity={
                    0.75
                  }
                  onPress={
                    handleMoreOptions
                  }
                >
                  <MaterialCommunityIcons
                    name="dots-horizontal"
                    size={22}
                    color="#57504B"
                  />
                </TouchableOpacity>
              </ScrollView>

              {/* ----------------------------------------------
                  CRIAR
                  Só existe depois de escrever.
              ---------------------------------------------- */}

              {title.trim().length >
                0 && (
                <View
                  style={
                    styles.saveRow
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.saveButton
                    }
                    activeOpacity={
                      0.75
                    }
                    onPress={
                      handleSave
                    }
                  >
                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      Criar
                    </Text>

                    <Image
                      source={require('../../../assets/abelha.png')}
                      style={
                        styles.saveBee
                      }
                    />
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
        visible={
          durationPickerVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setDurationPickerVisible(
            false
          )
        }
      >
        <Pressable
          style={
            styles.pickerOverlay
          }
          onPress={() =>
            setDurationPickerVisible(
              false
            )
          }
        >
          <View
            style={
              styles.pickerCard
            }
          >
            <Text
              style={
                styles.pickerTitle
              }
            >
              Duração
            </Text>

            <ScrollView
              style={
                styles.pickerScroll
              }
              keyboardShouldPersistTaps="handled"
            >
              {DURATION_OPTIONS.map(
                (item) => (
                  <TouchableOpacity
                    key={item}
                    style={
                      styles.pickerRow
                    }
                    activeOpacity={
                      0.7
                    }
                    onPress={() => {
                      setDuration(
                        item
                      );

                      setDurationPickerVisible(
                        false
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerRowText,

                        item ===
                          duration &&
                          styles.pickerRowTextActive,
                      ]}
                    >
                      {formatDuration(
                        item
                      )}
                    </Text>

                    {item ===
                      duration && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color="#4F75E2"
                      />
                    )}
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ---------------------------------------------------
          PICKER CATEGORIA
      --------------------------------------------------- */}

      <Modal
        visible={
          categoryPickerVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setCategoryPickerVisible(
            false
          )
        }
      >
        <Pressable
          style={
            styles.pickerOverlay
          }
          onPress={() =>
            setCategoryPickerVisible(
              false
            )
          }
        >
          <View
            style={
              styles.categoryCard
            }
          >
            <Text
              style={
                styles.pickerTitle
              }
            >
              Categoria
            </Text>

            {CATEGORY_OPTIONS.map(
              (item) => (
                <TouchableOpacity
                  key={item.id}
                  style={
                    styles.categoryRow
                  }
                  activeOpacity={
                    0.7
                  }
                  onPress={() => {
                    setCategoryId(
                      item.id
                    );

                    setCategoryPickerVisible(
                      false
                    );
                  }}
                >
                  <View
                    style={
                      styles.categoryLeft
                    }
                  >
                    <Ionicons
                      name={
                        item.icon
                      }
                      size={20}
                      color={
                        item.color
                      }
                    />

                    <Text
                      style={[
                        styles.categoryText,

                        item.id ===
                          categoryId &&
                          styles.categoryTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>

                  {item.id ===
                    categoryId && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color="#4F75E2"
                    />
                  )}
                </TouchableOpacity>
              )
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */

const styles =
  StyleSheet.create({
    /* ---------------------------------------------------
       MODAL
    --------------------------------------------------- */

    overlay: {
      flex: 1,
      justifyContent:
        'flex-end',
    },

    backdrop: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(32, 28, 25, 0.34)',
    },

    sheet: {
      backgroundColor:
        '#FFFDFC',

      paddingHorizontal: 16,
      paddingTop: 10,

      paddingBottom:
        Platform.OS === 'ios'
          ? 18
          : 12,

      borderTopLeftRadius:
        22,

      borderTopRightRadius:
        22,

      borderWidth: 1,
      borderBottomWidth: 0,

      borderColor:
        '#EEE8E4',
    },

    handle: {
      alignSelf: 'center',

      width: 42,
      height: 4,

      borderRadius: 2,

      backgroundColor:
        '#C8C2BE',

      marginBottom: 14,
    },

    /* ---------------------------------------------------
       INPUTS
    --------------------------------------------------- */

    titleInput: {
      minHeight: 46,

      borderRadius: 12,

      backgroundColor:
        '#F7F4F2',

      paddingHorizontal: 12,

      fontSize: 17,
      fontWeight: '500',

      color: '#2F2A27',

      marginBottom: 4,
    },

    descriptionInput: {
      minHeight: 34,

      paddingHorizontal: 12,
      paddingVertical: 7,

      fontSize: 14,

      color: '#5B544F',
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

      backgroundColor:
        '#F4F1EF',

      flexDirection: 'row',
      alignItems: 'center',

      gap: 5,
    },

    actionText: {
      fontSize: 12,
      fontWeight: '500',

      color: '#4E4844',
    },

    iconButton: {
      width: 34,
      height: 34,

      borderRadius: 10,

      alignItems: 'center',
      justifyContent:
        'center',

      backgroundColor:
        '#F4F1EF',
    },

    /* ---------------------------------------------------
       CRIAR
    --------------------------------------------------- */

    saveRow: {
      flexDirection: 'row',

      justifyContent:
        'flex-end',

      marginTop: 8,
    },

    saveButton: {
      height: 40,

      paddingHorizontal: 14,

      flexDirection: 'row',

      alignItems: 'center',
      justifyContent:
        'center',

      gap: 7,

      borderRadius: 10,

      backgroundColor:
        '#F4F1EF',
    },

    saveButtonText: {
      fontSize: 14,

      fontWeight: '600',

      color: '#403B37',
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

      justifyContent:
        'flex-end',

      backgroundColor:
        'rgba(32, 28, 25, 0.28)',
    },

    pickerCard: {
      backgroundColor:
        '#FFFDFC',

      borderTopLeftRadius:
        20,

      borderTopRightRadius:
        20,

      paddingHorizontal: 18,

      paddingTop: 18,
      paddingBottom: 24,
    },

    categoryCard: {
      backgroundColor:
        '#FFFDFC',

      borderTopLeftRadius:
        20,

      borderTopRightRadius:
        20,

      paddingHorizontal: 18,

      paddingTop: 18,
      paddingBottom: 24,
    },

    pickerTitle: {
      fontSize: 17,

      fontWeight: '700',

      color: '#2F2A27',

      marginBottom: 10,
    },

    pickerScroll: {
      maxHeight: 360,
    },

    pickerRow: {
      minHeight: 48,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        '#E8E2DE',
    },

    pickerRowText: {
      fontSize: 15,

      color: '#625A55',
    },

    pickerRowTextActive: {
      fontWeight: '700',

      color: '#2F2A27',
    },

    categoryRow: {
      minHeight: 50,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        '#E8E2DE',
    },

    categoryLeft: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 12,
    },

    categoryText: {
      fontSize: 15,

      color: '#625A55',
    },

    categoryTextActive: {
      fontWeight: '700',

      color: '#2F2A27',
    },
  });