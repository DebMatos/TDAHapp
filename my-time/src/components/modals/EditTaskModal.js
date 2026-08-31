import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DURATION_PRESETS = [5, 15, 30, 45, 60, 90, 120];

const formatMinutesToTime = (totalMins) => {
  const normalized = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const parseTimeToMinutes = (timeStr, fallbackHour = 7) => {
  if (!timeStr || !timeStr.includes(':')) return fallbackHour * 60;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? fallbackHour : h) * 60 + (isNaN(m) ? 0 : m);
};

export default function EditTaskModal({
  visible,
  onClose,
  onSave,
  onDelete,
  task,
}) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible || !task) return;
    const initialStart = task.timeOfDay || task.startTimeStr || '07:00';
    const duration = Number(task.timeMinutes) || 30;
    const startMins = parseTimeToMinutes(initialStart);
    const initialEnd = formatMinutesToTime(startMins + duration);

    setTitle(task.title || '');
    setStartTime(initialStart);
    setEndTime(initialEnd);
    setDurationMinutes(duration);
    setDate(task.date || new Date().toISOString().slice(0, 10));
    setNotes(task.notes || '');
  }, [visible, task]);

  const handleStartTimeChange = (text) => {
    setStartTime(text);
    if (text.length === 5 && text.includes(':')) {
      const startMins = parseTimeToMinutes(text);
      setEndTime(formatMinutesToTime(startMins + durationMinutes));
    }
  };

  const handleEndTimeChange = (text) => {
    setEndTime(text);
    if (text.length === 5 && text.includes(':')) {
      const startMins = parseTimeToMinutes(startTime);
      let endMins = parseTimeToMinutes(text);
      if (endMins < startMins) endMins += 1440;
      const diff = Math.max(5, endMins - startMins);
      setDurationMinutes(diff);
    }
  };

  const handlePresetDuration = (mins) => {
    setDurationMinutes(mins);
    const startMins = parseTimeToMinutes(startTime);
    setEndTime(formatMinutesToTime(startMins + mins));
  };

  const handleSave = () => {
    if (!title.trim() || !task) return;

    onSave(task.id, task.blockId, {
      ...task,
      title: title.trim(),
      timeMinutes: durationMinutes,
      timeOfDay: startTime.trim(),
      endTime: endTime.trim(),
      date,
      notes,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Editar tarefa</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={26} color="#2C2521" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nome da tarefa</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Nome da tarefa"
            placeholderTextColor="#A0958E"
          />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Hora de Início</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={handleStartTimeChange}
                placeholder="09:00"
                placeholderTextColor="#A0958E"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Hora de Fim</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={handleEndTimeChange}
                placeholder="10:00"
                placeholderTextColor="#A0958E"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>

          <Text style={styles.label}>Duração ({durationMinutes} min)</Text>
          <View style={styles.presetsRow}>
            {DURATION_PRESETS.map((mins) => (
              <TouchableOpacity
                key={mins}
                style={[
                  styles.presetBadge,
                  durationMinutes === mins && styles.presetBadgeActive,
                ]}
                onPress={() => handlePresetDuration(mins)}
              >
                <Text
                  style={[
                    styles.presetText,
                    durationMinutes === mins && styles.presetTextActive,
                  ]}
                >
                  {mins}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Notas</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notas adicionais..."
            placeholderTextColor="#A0958E"
            multiline
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(task.id)}>
            <Ionicons name="trash-outline" size={18} color="#B73A3A" />
            <Text style={styles.deleteText}>Apagar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>Guardar alterações</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFDF9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6E1',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#2C2521' },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 32 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B625C', marginBottom: 6, marginTop: 14 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#E3DAD3',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#2C2521',
    backgroundColor: '#FFFFFF',
  },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3EDE7',
  },
  presetBadgeActive: { backgroundColor: '#E8F2F6', borderWidth: 1, borderColor: '#3A9BB7' },
  presetText: { fontSize: 12, fontWeight: '600', color: '#6B625C' },
  presetTextActive: { color: '#247A9B', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  notesInput: { minHeight: 90 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFE6E1',
  },
  deleteButton: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5B9B9',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteText: { color: '#B73A3A', fontWeight: '700' },
  saveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2521',
  },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});