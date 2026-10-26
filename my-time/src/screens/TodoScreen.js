import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

export default function TodoScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>To-do & Backlog</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholderText}>Lista de tarefas pendentes e vitórias rápidas</Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  placeholderText: { fontSize: 14, color: colors.textMuted },
});