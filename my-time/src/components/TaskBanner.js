import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

export default function TaskBanner({ notice, onDismiss, placement = 'bottom' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const currentNotice = useRef(notice);
  currentNotice.current = notice;
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  useEffect(() => {
    setRetryFailed(false);
    if (!notice || notice.tone !== 'info') return;
    const timer = setTimeout(() => dismiss.current?.(), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    setRetryFailed(false);
    try {
      const recovered = await notice.retry();
      if (recovered === true && currentNotice.current === notice) dismiss.current?.();
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View pointerEvents="box-none" style={[styles.host,
      placement === 'top' ? { top: insets.top + 12 } : { bottom: insets.bottom + 12 }]}>
      <View style={[styles.banner, { maxHeight: Math.max(120, height * 0.35) },
        notice.tone !== 'info' && styles.error]}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <View accessibilityLiveRegion={notice.tone === 'info' ? 'polite' : 'assertive'}>
            <Text style={styles.title}>{notice.title}</Text>
            <Text style={styles.message}>{notice.message}</Text>
            {retryFailed && <Text style={styles.message}>Não foi possível concluir esta tentativa. Os dados foram mantidos.</Text>}
          </View>
          <View style={styles.actions}>
            {notice.retry && (
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: retrying, busy: retrying }}
                disabled={retrying} onPress={retry} style={styles.action}>
                <Text style={styles.actionText}>{retrying ? 'A tentar…' : 'Tentar novamente'}</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel="Dispensar mensagem"
              onPress={onDismiss} style={styles.action}>
              <Text style={styles.actionText}>Fechar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, zIndex: 100, alignItems: 'center' },
  banner: { width: '100%', maxWidth: 420, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.selection,
    borderRadius: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
    elevation: 6, shadowColor: colors.text, shadowOpacity: 0.12, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 } },
  error: { borderLeftColor: colors.danger },
  title: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: 4 },
  message: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
  action: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  actionText: { color: colors.selectionText, fontSize: 13, fontWeight: '600' },
});
