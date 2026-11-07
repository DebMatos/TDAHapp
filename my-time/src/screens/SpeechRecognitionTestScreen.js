import React, { useCallback, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { createSpeechDiagnostic, localePresence, TEST_PHRASES } from './speechRecognitionDiagnostic';

const UNKNOWN = 'Não foi possível determinar';
const list = values => Array.isArray(values) && values.length ? values.join(', ') : UNKNOWN;

export default function SpeechRecognitionTestScreen({ navigation }) {
  const { colors } = useTheme();
  const controller = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [lang, setLang] = useState('pt-PT');

  useFocusEffect(useCallback(() => {
    setSnapshot(null);
    setLoadError('');
    if (Platform.OS !== 'android') {
      setLoadError('Este diagnóstico destina-se à aplicação Android num dispositivo físico.');
      return;
    }
    let diagnostic;
    const appStateSubscriptions = [];
    try {
      // A missing native module in Expo Go/an older binary must not crash Home.
      const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');
      diagnostic = createSpeechDiagnostic(ExpoSpeechRecognitionModule, setSnapshot);
      controller.current = diagnostic;
      diagnostic.observeAppState('initial', AppState.currentState);
      // Android system/service activities can temporarily pause this Activity.
      // Log lifecycle and window focus independently; neither proves cancellation.
      appStateSubscriptions.push(
        AppState.addEventListener('change', next => diagnostic.observeAppState('change', next)),
        AppState.addEventListener('blur', () => diagnostic.observeAppState('blur')),
        AppState.addEventListener('focus', () => diagnostic.observeAppState('focus')),
      );
      void diagnostic.refresh(Number(Platform.Version));
    } catch {
      setLoadError('O módulo nativo de voz não está disponível. Gera e instala uma nova compilação Android; o Expo Go não inclui este módulo.');
    }
    return () => {
      controller.current = null;
      appStateSubscriptions.forEach(subscription => subscription.remove());
      diagnostic?.dispose();
    };
  }, []));

  const diagnostics = snapshot?.diagnostics;
  const busy = Boolean(snapshot?.busy);
  const button = (label, onPress, disabled = false, selected = false) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      activeOpacity={0.7}
      style={[styles.button, { backgroundColor: selected ? colors.selectionSoft : colors.surfaceSoft, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={{ color: selected ? colors.selectionText : colors.action, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
  const heading = title => <Text style={[styles.heading, { color: colors.text }]}>{title}</Text>;
  const detail = (label, value) => (
    <View style={styles.detail}>
      <Text style={{ color: colors.textSecondary }}>{label}</Text>
      <Text selectable style={{ color: colors.text }}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {button('Voltar ao início', () => navigation.navigate('Home'))}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Diagnóstico de voz</Text>
        <Text style={{ color: colors.textSecondary }}>
          Experiência temporária · Android · serviço predefinido. O serviço pode usar a internet para transcrever.
          A aplicação não guarda áudio nem envia transcrições para o backend.
        </Text>
        {loadError ? <Text accessibilityRole="alert" style={[styles.detail, { color: colors.text }]}>{loadError}</Text> : null}

        {heading('Dispositivo e serviço')}
        {detail('Versão do Android', Platform.OS === 'android'
          ? `${Platform.constants.Release} (API ${Platform.Version}) · ${Platform.constants.Model}` : 'Não é Android')}
        {detail('Serviços detetados (pacotes visíveis à aplicação)', diagnostics?.services?.length === 0 ? 'Nenhum serviço detetado' : list(diagnostics?.services))}
        {detail('Serviço predefinido (pacote)', diagnostics?.defaultService || UNKNOWN)}
        {detail('Reconhecimento disponível', typeof diagnostics?.available === 'boolean' ? diagnostics.available ? 'Sim' : 'Não' : UNKNOWN)}

        {heading('Idiomas do serviço predefinido')}
        <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
          {diagnostics?.loading ? 'A consultar idiomas…' : 'A consulta é informativa. Podes testar ambos os idiomas mesmo quando o resultado é inconclusivo.'}
        </Text>
        {['pt-PT', 'pt-BR'].map(locale => (
          <View key={locale} style={styles.detail}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{locale}</Text>
            <Text style={{ color: colors.text }}>Suportado: {localePresence(diagnostics?.locales, locale)}</Text>
            <Text style={{ color: colors.text }}>Modelo local instalado: {Array.isArray(diagnostics?.installedLocales) && (diagnostics.installedLocales.length || diagnostics?.locales?.length)
              ? diagnostics.installedLocales.length ? localePresence(diagnostics.installedLocales, locale) : 'Não consta da lista devolvida'
              : UNKNOWN}</Text>
          </View>
        ))}
        {detail('Todos os idiomas suportados (online e/ou local)', list(diagnostics?.locales))}
        {detail('Modelos locais instalados', diagnostics?.installedLocales?.length === 0 && diagnostics?.locales?.length
          ? 'Nenhum modelo instalado reportado pelo serviço' : list(diagnostics?.installedLocales))}
        {diagnostics?.notes.map((note, index) => <Text key={index} selectable style={{ color: colors.textSecondary }}>{note}</Text>)}
        {button('Atualizar diagnóstico', () => { void controller.current?.refresh(Number(Platform.Version)); }, !snapshot || busy || diagnostics?.loading)}

        {heading('Teste de transcrição')}
        <Text style={{ color: colors.textSecondary }}>Idioma solicitado ao serviço</Text>
        <View style={styles.row}>
          {['pt-PT', 'pt-BR'].map(locale => button(locale, () => setLang(locale), busy, lang === locale))}
        </View>
        <View style={styles.row}>
          {button('Iniciar gravação', () => { void controller.current?.start(lang); }, !snapshot || busy)}
          {button('Parar', () => controller.current?.stop(), !busy || snapshot?.status !== 'a ouvir')}
        </View>
        <Text accessibilityLiveRegion="polite" style={[styles.detail, { color: colors.text }]}>Estado: {snapshot?.status || 'inativo'}</Text>
        {snapshot?.error ? <Text accessibilityRole="alert" selectable style={{ color: colors.text }}>{snapshot.error}</Text> : null}
        <View style={[styles.transcript, { backgroundColor: colors.surfaceSoft }]}>
          <Text selectable style={{ color: colors.text }}>{snapshot?.transcript || 'A transcrição aparecerá aqui.'}</Text>
        </View>

        {heading('Frases para comparar')}
        {TEST_PHRASES.map((phrase, index) => <Text key={phrase} selectable style={[styles.detail, { color: colors.text }]}>{index + 1}. “{phrase}”</Text>)}
        <Text style={{ color: colors.textSecondary }}>Repete cada frase nos dois idiomas. Os últimos resultados finais ficam disponíveis enquanto este ecrã estiver aberto.</Text>
        {['pt-PT', 'pt-BR'].map(locale => <View key={locale}>{detail(`Último resultado final · ${locale}`, snapshot?.results[locale] || 'Ainda sem resultado final.')}</View>)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 36, gap: 8 },
  title: { fontSize: 26, fontWeight: '700', marginTop: 12 },
  heading: { fontSize: 19, fontWeight: '600', marginTop: 20, marginBottom: 4 },
  detail: { gap: 4, paddingVertical: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  transcript: { minHeight: 100, padding: 16, borderRadius: 10 },
});
