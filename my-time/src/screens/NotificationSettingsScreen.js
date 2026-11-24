import React, { useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { reminderLeadFromInput, reminderUnits } from '../services/taskReminderPlan';
import {
  getReminderPermission, readReminderPreferences, remindersSupported,
  requestReminderPermission, saveReminderPreferences,
} from '../services/taskReminders';

const units = { minutes: 'Minutos', hours: 'Horas', days: 'Dias' };
const shortcuts = [
  ['5 min', '5', 'minutes'],
  ['15 min', '15', 'minutes'],
  ['30 min', '30', 'minutes'],
  ['1 hora', '1', 'hours'],
  ['1 dia', '1', 'days'],
];

export default function NotificationSettingsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [preferences, setPreferences] = useState(null);
  const [permission, setPermission] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [inputError, setInputError] = useState('');
  const draftRef = useRef(null);
  const latest = useRef(null);

  useEffect(() => {
    let active = true;
    const refreshPermission = () => getReminderPermission()
      .then(value => { if (active) setPermission(value); })
      .catch(() => { if (active) setError('Não foi possível verificar a autorização do sistema.'); });
    readReminderPreferences()
      .then(value => {
        if (active) {
          latest.current = value;
          setPreferences(value);
        }
      })
      .catch(() => { if (active) setError('Não foi possível carregar as preferências.'); });
    void refreshPermission();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshPermission();
    });
    return () => { active = false; subscription.remove(); };
  }, []);

  const save = async changes => {
    const previous = latest.current;
    if (!previous || busy) return;
    const next = { ...previous, ...changes };
    latest.current = next;
    setPreferences(next);
    setError('');
    try {
      await saveReminderPreferences(next);
    } catch {
      if (latest.current !== next) return;
      setError('Não foi possível atualizar os avisos. Tenta novamente.');
      const stored = await readReminderPreferences().catch(() => previous);
      if (latest.current === next) {
        latest.current = stored;
        setPreferences(stored);
      }
    }
  };

  const updateDraft = value => {
    draftRef.current = value;
    setDraft(value);
    setInputError('');
  };

  const applyLead = (amount, unit, { dismiss = false } = {}) => {
    const lead = reminderLeadFromInput(amount, unit);
    if (lead === null) {
      setInputError('Introduz um número inteiro maior que zero.');
      return;
    }
    updateDraft(null);
    void save({ lead, unit });
    if (dismiss) Keyboard.dismiss();
  };

  const authorize = async () => {
    setBusy(true);
    setError('');
    try {
      if (permission === 'blocked') await Linking.openSettings();
      else setPermission(await requestReminderPermission());
    } catch {
      setError('Não foi possível abrir a autorização. Tenta novamente.');
    } finally {
      setBusy(false);
    }
  };

  const disabled = !remindersSupported || busy || !preferences;
  const leadDisabled = disabled || !preferences?.enabled;
  const notificationsEnabled = Boolean(preferences?.enabled);
  const savedUnit = preferences?.unit ?? 'minutes';
  const savedAmount = preferences ? String(preferences.lead / reminderUnits[savedUnit]) : '';
  const unit = draft?.unit ?? savedUnit;
  const amount = draft?.amount ?? savedAmount;
  const leadControlBackground = isDark ? colors.surfaceSoft : colors.surfaceMuted;
  const selectedUnitBackground = isDark ? colors.selectionSoft : colors.selection;
  const selectedUnitText = isDark ? colors.selectionText : colors.surface;
  const finishEditing = () => {
    const pending = draftRef.current;
    if (pending && latest.current?.enabled) applyLead(pending.amount, pending.unit);
  };
  const setEnabled = enabled => {
    const pending = draftRef.current;
    const lead = pending ? reminderLeadFromInput(pending.amount, pending.unit) : null;
    updateDraft(null);
    void save(lead === null ? { enabled } : { enabled, lead, unit: pending.unit });
    Keyboard.dismiss();
  };
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.back} onPress={() => {
          finishEditing();
          navigation.navigate('Home');
        }}
          accessibilityRole="button" accessibilityLabel="Voltar à timeline">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Definições</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[styles.section, { color: colors.text }]}>Notificações</Text>
        <View style={styles.row}>
          <View style={styles.grow}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Avisos de tarefas</Text>
            <Text style={{ color: colors.textSecondary }}>Receber avisos antes das tarefas.</Text>
          </View>
          <Switch accessibilityLabel="Avisos de tarefas" value={notificationsEnabled}
            disabled={disabled} onValueChange={setEnabled}
            trackColor={{ false: colors.surfaceMuted, true: colors.selectionSoft }}
            thumbColor={notificationsEnabled ? colors.selection : colors.textMuted}
            ios_backgroundColor={colors.surfaceMuted} />
        </View>
        {!remindersSupported && <Text style={{ color: colors.textSecondary }}>Os avisos estão disponíveis na aplicação móvel.</Text>}
        {remindersSupported && preferences?.enabled && permission && permission !== 'granted' && (
          <View style={styles.permissionNotice}>
            <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
              {permission === 'blocked'
                ? 'O sistema bloqueou as notificações da My Time.'
                : permission === 'exact'
                  ? 'Autoriza alarmes exatos para melhorar a pontualidade dos avisos no Android.'
                  : 'Autoriza as notificações para receber avisos.'}
            </Text>
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={authorize}
              accessibilityState={{ disabled: busy, busy }} style={styles.permissionAction} activeOpacity={0.7}>
              <Text style={[styles.permissionActionText, { color: colors.selectionText }]}>
                {permission === 'blocked'
                  ? 'Abrir definições do sistema'
                  : permission === 'exact' ? 'Autorizar alarmes exatos' : 'Autorizar notificações'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {error ? <Text accessibilityLiveRegion="polite" style={{ color: colors.danger }}>{error}</Text> : null}
        <View style={{ opacity: leadDisabled ? 0.6 : 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Avisar antes do início</Text>
          <View style={[styles.leadControl, { backgroundColor: leadControlBackground }]}>
            <TextInput
              accessibilityLabel="Valor da antecedência"
              value={amount}
              editable={!leadDisabled}
              keyboardType="number-pad"
              returnKeyType="done"
              onChangeText={value => updateDraft({ amount: value, unit })}
              onEndEditing={finishEditing}
              onSubmitEditing={finishEditing}
              style={[styles.amount, { color: colors.text }]}
            />
            <View accessibilityRole="radiogroup" accessibilityLabel="Unidade da antecedência" style={styles.units}>
              {Object.entries(units).map(([key, label]) => {
                const checked = unit === key;
                return (
                  <TouchableOpacity key={key} accessibilityRole="radio"
                    accessibilityState={{ checked, disabled: leadDisabled }} disabled={leadDisabled}
                    onPress={() => {
                      const value = draftRef.current?.amount ?? amount;
                      updateDraft({ amount: value, unit: key });
                      applyLead(value, key, { dismiss: true });
                    }}
                    style={[styles.unit, checked && { backgroundColor: selectedUnitBackground }]} activeOpacity={0.7}>
                    <Text style={{ color: checked ? selectedUnitText : colors.textSecondary, fontWeight: checked ? '700' : '500' }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {!!inputError && <Text accessibilityLiveRegion="polite" style={{ color: colors.danger }}>{inputError}</Text>}
          <View style={styles.shortcuts}>
            {shortcuts.map(([label, value, shortcutUnit]) => {
              const selected = shortcutUnit === unit && reminderLeadFromInput(amount, unit) === Number(value) * reminderUnits[shortcutUnit];
              return (
                <TouchableOpacity key={label} accessibilityRole="button" disabled={leadDisabled}
                  accessibilityState={{ selected, disabled: leadDisabled }}
                  onPress={() => applyLead(value, shortcutUnit, { dismiss: true })}
                  style={[styles.shortcut, selected && { backgroundColor: colors.selectionSoft }]} activeOpacity={0.7}>
                  <Text style={{ color: selected ? colors.selectionText : colors.textSecondary, fontWeight: selected ? '700' : '500' }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 22, fontWeight: '700' },
  content: { padding: 20, gap: 16 },
  section: { fontSize: 18, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  settingTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  permissionNotice: { gap: 2 },
  permissionText: { fontSize: 13, lineHeight: 18 },
  permissionAction: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  permissionActionText: { fontSize: 14, fontWeight: '600' },
  leadControl: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', padding: 4, borderRadius: 12, marginTop: 8 },
  amount: { flex: 1, minWidth: 60, minHeight: 44, paddingHorizontal: 10, fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  units: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1 },
  unit: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10, borderRadius: 8 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  shortcut: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
});
