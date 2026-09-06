import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
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
} from '@expo/vector-icons';

const DAY_MINUTES = 24 * 60;

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

const REPEAT_OPTIONS = [
  'Nunca',
  'Todos os dias',
  'Dias úteis',
  'Todas as semanas',
];

const STATUS_OPTIONS = [
  {
    id: 'pending',
    label: 'Pendente',
    icon: 'square-outline',
    color: '#817770',
  },
  {
    id: 'completed',
    label: 'Concluída',
    icon: 'checkmark-circle-outline',
    color: '#38A169',
  },
  {
    id: 'abandoned',
    label: 'Abandonada',
    icon: 'close-circle-outline',
    color: '#B65E5E',
  },
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

const normalizeMinutes = (
  minutes
) =>
  ((minutes % DAY_MINUTES) +
    DAY_MINUTES) %
  DAY_MINUTES;

const formatTime = (
  minutes
) => {
  const normalized =
    normalizeMinutes(minutes);

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

const parseTime = (
  value,
  fallback = 7 * 60
) => {
  if (
    !value ||
    !value.includes(':')
  ) {
    return fallback;
  }

  const [hours, minutes] =
    value
      .split(':')
      .map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return fallback;
  }

  return normalizeMinutes(
    hours * 60 + minutes
  );
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
   INPUT DE HORA
------------------------------------------------------- */

const formatTimeInput = (
  value
) => {
  const digits = value
    .replace(/\D/g, '')
    .slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(
    0,
    2
  )}:${digits.slice(2)}`;
};

const isValidTime = (
  value
) => {
  if (
    !/^\d{2}:\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const [hours, minutes] =
    value
      .split(':')
      .map(Number);

  return (
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );
};

/* -------------------------------------------------------
   COMPONENTE
------------------------------------------------------- */

export default function TaskDetailsModal({
  visible,
  mode = 'create',

  initialValues = null,

  onClose,
  onSave,
  onDelete,
}) {
  const [title, setTitle] =
    useState('');

  const [
    startTime,
    setStartTime,
  ] = useState('07:00');

  const [
    endTime,
    setEndTime,
  ] = useState('07:30');

  const [
    duration,
    setDuration,
  ] = useState(30);

  const [
    categoryId,
    setCategoryId,
  ] = useState('inbox');

  const [
    notes,
    setNotes,
  ] = useState('');

  const [
    repeat,
    setRepeat,
  ] = useState('Nunca');

  const [
    status,
    setStatus,
  ] = useState('pending');

  const [
    durationPickerVisible,
    setDurationPickerVisible,
  ] = useState(false);

  const [
    categoryPickerVisible,
    setCategoryPickerVisible,
  ] = useState(false);

  const [
    repeatPickerVisible,
    setRepeatPickerVisible,
  ] = useState(false);

  const [
    statusPickerVisible,
    setStatusPickerVisible,
  ] = useState(false);

  const isEdit =
    mode === 'edit';

  /* -------------------------------------------------------
     SELEÇÕES
  ------------------------------------------------------- */

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

  const selectedStatus =
    useMemo(
      () =>
        STATUS_OPTIONS.find(
          (item) =>
            item.id === status
        ) ||
        STATUS_OPTIONS[0],
      [status]
    );

  /* -------------------------------------------------------
     CARREGAR DADOS
  ------------------------------------------------------- */

  useEffect(() => {
    if (!visible) {
      return;
    }

    const initialStart =
      initialValues?.timeOfDay ||
      (
        initialValues?.startMinsPlanned !=
        null
          ? formatTime(
              initialValues.startMinsPlanned
            )
          : '07:00'
      );

    const initialDuration =
      Math.max(
        1,
        Number(
          initialValues?.timeMinutes ??
            initialValues?.duration
        ) || 30
      );

    const startMinutes =
      parseTime(
        initialStart
      );

    /*
     * Compatibilidade:
     *
     * tarefa nova:
     * status
     *
     * tarefa antiga:
     * completed true/false
     */
    const initialStatus =
      initialValues?.status ||
      (
        initialValues?.completed
          ? 'completed'
          : 'pending'
      );

    setTitle(
      initialValues?.title ||
        ''
    );

    setStartTime(
      initialStart
    );

    setDuration(
      initialDuration
    );

    setEndTime(
      formatTime(
        startMinutes +
          initialDuration
      )
    );

    setCategoryId(
      initialValues?.categoryId ||
        'inbox'
    );

    setNotes(
      initialValues?.notes ||
        initialValues?.description ||
        ''
    );

    setRepeat(
      initialValues?.repeat ||
        'Nunca'
    );

    setStatus(
      initialStatus
    );
  }, [
    visible,
    initialValues,
  ]);

  /* -------------------------------------------------------
     START -> END
  ------------------------------------------------------- */

  const updateStartTime = (
    value
  ) => {
    const formatted =
      formatTimeInput(value);

    setStartTime(
      formatted
    );

    if (
      !isValidTime(
        formatted
      )
    ) {
      return;
    }

    const startMinutes =
      parseTime(
        formatted
      );

    setEndTime(
      formatTime(
        startMinutes +
          duration
      )
    );
  };

  /* -------------------------------------------------------
     END -> DURATION
  ------------------------------------------------------- */

  const updateEndTime = (
    value
  ) => {
    const formatted =
      formatTimeInput(value);

    setEndTime(
      formatted
    );

    if (
      !isValidTime(
        formatted
      ) ||
      !isValidTime(
        startTime
      )
    ) {
      return;
    }

    const startMinutes =
      parseTime(
        startTime
      );

    let endMinutes =
      parseTime(
        formatted
      );

    /*
     * Se a hora final for
     * anterior ao início,
     * significa dia seguinte.
     */
    if (
      endMinutes <=
      startMinutes
    ) {
      endMinutes +=
        DAY_MINUTES;
    }

    setDuration(
      Math.max(
        1,
        endMinutes -
          startMinutes
      )
    );
  };

  /* -------------------------------------------------------
     DURATION -> END
  ------------------------------------------------------- */

  const updateDuration = (
    value
  ) => {
    setDuration(
      value
    );

    if (
      !isValidTime(
        startTime
      )
    ) {
      return;
    }

    const startMinutes =
      parseTime(
        startTime
      );

    setEndTime(
      formatTime(
        startMinutes +
          value
      )
    );
  };

  /* -------------------------------------------------------
     SAVE
  ------------------------------------------------------- */

  const canSave =
    title.trim().length >
      0 &&
    isValidTime(
      startTime
    ) &&
    isValidTime(
      endTime
    );

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    const startMinutes =
      parseTime(
        startTime
      );

    onSave({
      title:
        title.trim(),

      startMinsPlanned:
        startMinutes,

      timeOfDay:
        formatTime(
          startMinutes
        ),

      timeMinutes:
        duration,

      categoryId,

      notes:
        notes.trim(),

      description:
        notes.trim(),

      repeat,

      status,

      /*
       * Mantemos por agora
       * para compatibilidade
       * com a Home e cards atuais.
       */
      completed:
        status ===
        'completed',
    });
  };

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <>
      <Modal
        visible={
          visible
        }
        transparent
        animationType="slide"
        onRequestClose={
          onClose
        }
      >
        <KeyboardAvoidingView
          style={
            styles.overlay
          }
          behavior="padding"
        >
          <Pressable
            style={
              styles.backdrop
            }
            onPress={
              onClose
            }
          />

          <View
            style={
              styles.sheet
            }
          >
            <View
              style={
                styles.handle
              }
            />

            {/* HEADER */}

            <View
              style={
                styles.header
              }
            >
              <Text
                style={
                  styles.headerTitle
                }
              >
                {isEdit
                  ? 'Editar tarefa'
                  : 'Detalhes da tarefa'}
              </Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
            >
              {/* TÍTULO */}

              <Text
                style={
                  styles.label
                }
              >
                Título
              </Text>

              <TextInput
                style={
                  styles.mainInput
                }
                value={
                  title
                }
                onChangeText={
                  setTitle
                }
                placeholder="O que vais fazer?"
                placeholderTextColor="#A79F99"
              />

              {/* ESTADO */}

              <Text
                style={
                  styles.label
                }
              >
                Estado
              </Text>

              <TouchableOpacity
                style={
                  styles.settingRow
                }
                activeOpacity={
                  0.7
                }
                onPress={() =>
                  setStatusPickerVisible(
                    true
                  )
                }
              >
                <View
                  style={
                    styles.settingLeft
                  }
                >
                  <Ionicons
                    name={
                      selectedStatus.icon
                    }
                    size={20}
                    color={
                      selectedStatus.color
                    }
                  />

                  <Text
                    style={
                      styles.settingText
                    }
                  >
                    {
                      selectedStatus.label
                    }
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#AAA19B"
                />
              </TouchableOpacity>

              {/* TEMPO */}

              <View
                style={
                  styles.timeRow
                }
              >
                <View
                  style={
                    styles.timeColumn
                  }
                >
                  <Text
                    style={
                      styles.label
                    }
                  >
                    Início
                  </Text>

                  <View
                    style={
                      styles.timeInputContainer
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color="#625A55"
                    />

                    <TextInput
                      style={
                        styles.timeInput
                      }
                      value={
                        startTime
                      }
                      onChangeText={
                        updateStartTime
                      }
                      keyboardType="number-pad"
                      maxLength={5}
                      placeholder="14:30"
                      placeholderTextColor="#AAA19B"
                    />
                  </View>
                </View>

                <View
                  style={
                    styles.timeColumn
                  }
                >
                  <Text
                    style={
                      styles.label
                    }
                  >
                    Fim
                  </Text>

                  <View
                    style={
                      styles.timeInputContainer
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color="#625A55"
                    />

                    <TextInput
                      style={
                        styles.timeInput
                      }
                      value={
                        endTime
                      }
                      onChangeText={
                        updateEndTime
                      }
                      keyboardType="number-pad"
                      maxLength={5}
                      placeholder="15:00"
                      placeholderTextColor="#AAA19B"
                    />
                  </View>
                </View>
              </View>

              {/* DURAÇÃO */}

              <Text
                style={
                  styles.label
                }
              >
                Duração
              </Text>

              <TouchableOpacity
                style={
                  styles.settingRow
                }
                activeOpacity={
                  0.7
                }
                onPress={() =>
                  setDurationPickerVisible(
                    true
                  )
                }
              >
                <View
                  style={
                    styles.settingLeft
                  }
                >
                  <Ionicons
                    name="timer-outline"
                    size={20}
                    color="#625A55"
                  />

                  <Text
                    style={
                      styles.settingText
                    }
                  >
                    {formatDuration(
                      duration
                    )}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#AAA19B"
                />
              </TouchableOpacity>

              {/* CATEGORIA */}

              <Text
                style={
                  styles.label
                }
              >
                Categoria
              </Text>

              <TouchableOpacity
                style={
                  styles.settingRow
                }
                activeOpacity={
                  0.7
                }
                onPress={() =>
                  setCategoryPickerVisible(
                    true
                  )
                }
              >
                <View
                  style={
                    styles.settingLeft
                  }
                >
                  <Ionicons
                    name={
                      selectedCategory.icon
                    }
                    size={20}
                    color={
                      selectedCategory.color
                    }
                  />

                  <Text
                    style={
                      styles.settingText
                    }
                  >
                    {
                      selectedCategory.label
                    }
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#AAA19B"
                />
              </TouchableOpacity>

              {/* REPETIR */}

              <Text
                style={
                  styles.label
                }
              >
                Repetir
              </Text>

              <TouchableOpacity
                style={
                  styles.settingRow
                }
                activeOpacity={
                  0.7
                }
                onPress={() =>
                  setRepeatPickerVisible(
                    true
                  )
                }
              >
                <View
                  style={
                    styles.settingLeft
                  }
                >
                  <Ionicons
                    name="repeat-outline"
                    size={20}
                    color="#625A55"
                  />

                  <Text
                    style={
                      styles.settingText
                    }
                  >
                    {repeat}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#AAA19B"
                />
              </TouchableOpacity>

              {/* NOTAS */}

              <Text
                style={
                  styles.label
                }
              >
                Notas
              </Text>

              <TextInput
                style={
                  styles.notesInput
                }
                value={
                  notes
                }
                onChangeText={
                  setNotes
                }
                multiline
                placeholder="Adicionar notas..."
                placeholderTextColor="#A79F99"
                textAlignVertical="top"
              />
            </ScrollView>

            {/* FOOTER */}

            <View
              style={
                styles.footer
              }
            >
              {isEdit &&
                onDelete && (
                  <TouchableOpacity
                    style={
                      styles.deleteButton
                    }
                    activeOpacity={
                      0.7
                    }
                    onPress={
                      onDelete
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={19}
                      color="#B65E5E"
                    />

                    <Text
                      style={
                        styles.deleteText
                      }
                    >
                      Apagar
                    </Text>
                  </TouchableOpacity>
                )}

              <TouchableOpacity
                style={[
                  styles.saveButton,

                  !canSave &&
                    styles.saveButtonDisabled,
                ]}
                activeOpacity={
                  0.75
                }
                disabled={
                  !canSave
                }
                onPress={
                  handleSave
                }
              >
                <Text
                  style={
                    styles.saveText
                  }
                >
                  {isEdit
                    ? 'Guardar'
                    : 'Criar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------------
          ESTADO
      --------------------------------------------------- */}

      <Modal
        visible={
          statusPickerVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setStatusPickerVisible(
            false
          )
        }
      >
        <Pressable
          style={
            styles.pickerOverlay
          }
          onPress={() =>
            setStatusPickerVisible(
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
              Estado
            </Text>

            {STATUS_OPTIONS.map(
              (item) => (
                <TouchableOpacity
                  key={
                    item.id
                  }
                  style={
                    styles.pickerRow
                  }
                  activeOpacity={
                    0.7
                  }
                  onPress={() => {
                    setStatus(
                      item.id
                    );

                    setStatusPickerVisible(
                      false
                    );
                  }}
                >
                  <View
                    style={
                      styles.settingLeft
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
                        styles.pickerText,

                        item.id ===
                          status &&
                          styles.pickerTextActive,
                      ]}
                    >
                      {
                        item.label
                      }
                    </Text>
                  </View>

                  {item.id ===
                    status && (
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

      {/* ---------------------------------------------------
          DURAÇÃO
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

            {DURATION_OPTIONS.map(
              (item) => (
                <TouchableOpacity
                  key={item}
                  style={
                    styles.pickerRow
                  }
                  onPress={() => {
                    updateDuration(
                      item
                    );

                    setDurationPickerVisible(
                      false
                    );
                  }}
                >
                  <Text
                    style={[
                      styles.pickerText,

                      item ===
                        duration &&
                        styles.pickerTextActive,
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
          </View>
        </Pressable>
      </Modal>

      {/* ---------------------------------------------------
          CATEGORIA
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
              styles.pickerCard
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
                  key={
                    item.id
                  }
                  style={
                    styles.pickerRow
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
                      styles.settingLeft
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
                      style={
                        styles.pickerText
                      }
                    >
                      {
                        item.label
                      }
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

      {/* ---------------------------------------------------
          REPETIR
      --------------------------------------------------- */}

      <Modal
        visible={
          repeatPickerVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setRepeatPickerVisible(
            false
          )
        }
      >
        <Pressable
          style={
            styles.pickerOverlay
          }
          onPress={() =>
            setRepeatPickerVisible(
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
              Repetir
            </Text>

            {REPEAT_OPTIONS.map(
              (item) => (
                <TouchableOpacity
                  key={item}
                  style={
                    styles.pickerRow
                  }
                  onPress={() => {
                    setRepeat(
                      item
                    );

                    setRepeatPickerVisible(
                      false
                    );
                  }}
                >
                  <Text
                    style={[
                      styles.pickerText,

                      item ===
                        repeat &&
                        styles.pickerTextActive,
                    ]}
                  >
                    {item}
                  </Text>

                  {item ===
                    repeat && (
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
      maxHeight: '92%',

      backgroundColor:
        '#FFFDFC',

      borderTopLeftRadius:
        22,

      borderTopRightRadius:
        22,

      paddingHorizontal:
        18,

      paddingTop: 10,

      paddingBottom:
        Platform.OS ===
        'ios'
          ? 22
          : 16,
    },

    handle: {
      alignSelf: 'center',

      width: 42,
      height: 4,

      borderRadius: 2,

      backgroundColor:
        '#C8C2BE',

      marginBottom: 10,
    },

    header: {
      marginBottom: 16,
    },

    headerTitle: {
      fontSize: 19,

      fontWeight: '700',

      color: '#2F2A27',
    },

    label: {
      fontSize: 12,

      fontWeight: '600',

      color: '#817770',

      marginTop: 14,

      marginBottom: 6,
    },

    mainInput: {
      height: 46,

      borderRadius: 10,

      backgroundColor:
        '#F7F4F2',

      paddingHorizontal:
        12,

      color: '#2F2A27',

      fontSize: 16,
    },

    timeRow: {
      flexDirection: 'row',

      gap: 10,
    },

    timeColumn: {
      flex: 1,
    },

    timeInputContainer: {
      height: 44,

      borderRadius: 10,

      backgroundColor:
        '#F7F4F2',

      paddingHorizontal:
        10,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 8,
    },

    timeInput: {
      flex: 1,

      fontSize: 15,

      color: '#403B37',
    },

    settingRow: {
      height: 48,

      borderRadius: 10,

      backgroundColor:
        '#F7F4F2',

      paddingHorizontal:
        12,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',
    },

    settingLeft: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 10,
    },

    settingText: {
      fontSize: 14,

      fontWeight: '500',

      color: '#403B37',
    },

    notesInput: {
      minHeight: 90,

      borderRadius: 10,

      backgroundColor:
        '#F7F4F2',

      paddingHorizontal:
        12,

      paddingVertical:
        10,

      fontSize: 14,

      color: '#403B37',
    },

    footer: {
      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      gap: 10,

      marginTop: 18,
    },

    saveButton: {
      marginLeft: 'auto',

      minWidth: 100,

      height: 42,

      borderRadius: 10,

      backgroundColor:
        '#F4F1EF',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        18,
    },

    saveButtonDisabled: {
      opacity: 0.35,
    },

    saveText: {
      fontSize: 14,

      fontWeight: '700',

      color: '#403B37',
    },

    deleteButton: {
      height: 42,

      paddingHorizontal:
        12,

      borderRadius: 10,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 6,

      backgroundColor:
        '#FAF1F1',
    },

    deleteText: {
      color: '#B65E5E',

      fontSize: 13,

      fontWeight: '600',
    },

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

      paddingHorizontal:
        18,

      paddingTop: 18,

      paddingBottom: 26,
    },

    pickerTitle: {
      fontSize: 17,

      fontWeight: '700',

      color: '#2F2A27',

      marginBottom: 10,
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

    pickerText: {
      fontSize: 15,

      color: '#625A55',
    },

    pickerTextActive: {
      color: '#2F2A27',

      fontWeight: '700',
    },
  });