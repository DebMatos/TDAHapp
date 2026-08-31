import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const DURATION_OPTIONS = [
  { label: '5min', value: 5 },
  { label: '10min', value: 10 },
  { label: '15min', value: 15 },
  { label: '20min', value: 20 },
  { label: '30min', value: 30 },
  { label: '45min', value: 45 },
  { label: '1h', value: 60 },
  { label: '1.5h', value: 90 },
  { label: '2h', value: 120 },
];

const ENERGY_OPTIONS = [
  { id: 'high', label: 'Alto Foco', icon: 'flash', color: '#E3789B' },
  { id: 'medium', label: 'Médio', icon: 'battery-charging', color: '#D4A017' },
  { id: 'low', label: 'Baixo / Leve', icon: 'cafe', color: '#4A90B2' },
  { id: 'recovery', label: 'Recuperação / Pausa', icon: 'leaf', color: '#34A853' },
];

export default function CreateTaskModal({
  visible,
  onClose,
  onSave,
  initialBlockId,
  initialTask,
  blocks = [],
}) {
  const [taskTitle, setTaskTitle] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [selectedEnergy, setSelectedEnergy] = useState('medium');
  const [selectedBlockId, setSelectedBlockId] = useState(initialBlockId);
  
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);
  const [blockPickerVisible, setBlockPickerVisible] = useState(false);
  const [energyPickerVisible, setEnergyPickerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedBlockId(initialTask?.blockId || initialBlockId);
      setTaskTitle(initialTask?.title || '');
      setSelectedDuration(initialTask?.timeMinutes || 30);
      setSelectedEnergy(initialTask?.energy || 'medium');
    }
  }, [visible, initialBlockId, initialTask]);

  const currentBlock = blocks.find((b) => b.id === selectedBlockId) || blocks[0];
  const currentEnergy = ENERGY_OPTIONS.find((e) => e.id === selectedEnergy) || ENERGY_OPTIONS[1];

  const handleSave = () => {
    if (!taskTitle.trim() || !selectedBlockId) return;
    onSave(selectedBlockId, taskTitle, selectedDuration, selectedEnergy);
    onClose();
  };

  const formatDurationLabel = (mins) => {
    if (mins >= 60) {
      return mins % 60 === 0 ? `${mins / 60}H` : `${(mins / 60).toFixed(1)}H`;
    }
    return `${mins}M`;
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />

          <View style={styles.modalContent}>
            <TextInput
              style={styles.input}
              placeholder={initialTask ? 'Editar tarefa' : 'Qual é o próximo?'}
              placeholderTextColor="#A0958E"
              value={taskTitle}
              onChangeText={setTaskTitle}
              autoFocus={true}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            {/* Pílulas de Ação */}
            <View style={styles.pillsRow}>
              {/* Pílula: Bloco / Intervalo */}
              <TouchableOpacity
                style={styles.pill}
                activeOpacity={0.7}
                onPress={() => setBlockPickerVisible(true)}
              >
                {currentBlock?.iconFamily === 'MaterialCommunityIcons' ? (
                  <MaterialCommunityIcons
                    name={currentBlock?.iconName || 'weather-hazy'}
                    size={16}
                    color="#4A403B"
                    style={{ marginRight: 6 }}
                  />
                ) : (
                  <Ionicons
                    name={currentBlock?.iconName || 'leaf'}
                    size={15}
                    color="#4A403B"
                    style={{ marginRight: 6 }}
                  />
                )}
                <Text style={styles.pillText}>{currentBlock?.title?.toUpperCase()}</Text>
              </TouchableOpacity>

              {/* Pílula: Duração */}
              <TouchableOpacity
                style={styles.pill}
                activeOpacity={0.7}
                onPress={() => setDurationPickerVisible(true)}
              >
                <Text style={styles.pillText}>{formatDurationLabel(selectedDuration)}</Text>
              </TouchableOpacity>

              {/* Pílula: Energia */}
              <TouchableOpacity
                style={styles.pill}
                activeOpacity={0.7}
                onPress={() => setEnergyPickerVisible(true)}
              >
                <Ionicons
                  name={currentEnergy.icon}
                  size={14}
                  color={currentEnergy.color}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.pillText}>{currentEnergy.label.toUpperCase()}</Text>
              </TouchableOpacity>

              {/* Botão Submeter */}
              <TouchableOpacity
                onPress={handleSave}
                style={styles.savePillButton}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-up" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Seletor de Duração */}
      <Modal visible={durationPickerVisible} animationType="fade" transparent={true}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Selecionar duração</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {DURATION_OPTIONS.map((item) => {
                const isSelected = selectedDuration === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={styles.pickerRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedDuration(item.value);
                      setDurationPickerVisible(false);
                    }}
                  >
                    <Text style={[styles.pickerRowText, isSelected && styles.pickerRowTextActive]}>
                      {item.label}
                    </Text>
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerCloseButton}
              onPress={() => setDurationPickerVisible(false)}
            >
              <Text style={styles.pickerCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Seletor de Bloco */}
      <Modal visible={blockPickerVisible} animationType="fade" transparent={true}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Selecionar intervalo</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {blocks.map((b) => {
                const isSelected = selectedBlockId === b.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.pickerRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedBlockId(b.id);
                      setBlockPickerVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {b.iconFamily === 'MaterialCommunityIcons' ? (
                        <MaterialCommunityIcons
                          name={b.iconName}
                          size={18}
                          color={b.iconColor}
                          style={{ marginRight: 10 }}
                        />
                      ) : (
                        <Ionicons
                          name={b.iconName}
                          size={18}
                          color={b.iconColor}
                          style={{ marginRight: 10 }}
                        />
                      )}
                      <Text style={[styles.pickerRowText, isSelected && styles.pickerRowTextActive]}>
                        {b.title}
                      </Text>
                    </View>

                    <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerCloseButton}
              onPress={() => setBlockPickerVisible(false)}
            >
              <Text style={styles.pickerCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Seletor de Nível de Energia */}
      <Modal visible={energyPickerVisible} animationType="fade" transparent={true}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Selecionar energia</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {ENERGY_OPTIONS.map((item) => {
                const isSelected = selectedEnergy === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.pickerRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedEnergy(item.id);
                      setEnergyPickerVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={item.color}
                        style={{ marginRight: 10 }}
                      />
                      <Text style={[styles.pickerRowText, isSelected && styles.pickerRowTextActive]}>
                        {item.label}
                      </Text>
                    </View>

                    <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerCloseButton}
              onPress={() => setEnergyPickerVisible(false)}
            >
              <Text style={styles.pickerCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(44, 37, 33, 0.4)',
  },
  dismissArea: { flex: 1 },
  modalContent: {
    backgroundColor: '#FAF5F0',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#EFE6E1',
  },
  input: {
    fontSize: 18,
    color: '#2C2521',
    paddingVertical: 8,
    marginBottom: 16,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFE6E1',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
  },
  pillText: {
    color: '#2C2521',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  savePillButton: {
    marginLeft: 'auto',
    backgroundColor: '#4A90B2',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44, 37, 33, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    backgroundColor: '#FFFDF9',
    width: '100%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EFE6E1',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2521',
    marginBottom: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6E1',
  },
  pickerRowText: {
    fontSize: 15,
    color: '#5C524B',
  },
  pickerRowTextActive: {
    color: '#2C2521',
    fontWeight: '700',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D4C7BF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#4A90B2',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4A90B2',
  },
  pickerCloseButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  pickerCloseText: {
    color: '#8C827B',
    fontWeight: '600',
    fontSize: 14,
  },
});