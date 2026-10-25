import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';

export function TaskErrorMessage({ message }) {
  if (!message) return null;
  return <Text accessibilityRole="alert" accessibilityLiveRegion="assertive"
    style={styles.inlineError}>{message}</Text>;
}

export default function TaskErrorDialog({ error, onClose }) {
  const retry = () => {
    const operation = error?.retry;
    onClose();
    operation?.();
  };
  return (
    <Modal visible={Boolean(error)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>{error?.title}</Text>
          <Text style={styles.message}>{error?.message}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
              <Text style={styles.label}>Fechar</Text>
            </Pressable>
            {error?.retry && (
              <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
                <Text style={styles.label}>Tentar novamente</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineError: { color: colors.text, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginVertical: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 12 },
  message: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 16 },
  button: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  label: { color: colors.selectionText, fontSize: 14, fontWeight: '600' },
});
