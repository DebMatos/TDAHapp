import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TodoScreen() {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFDF9' },
  header: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EFE6E1' },
  title: { fontSize: 20, fontWeight: '700', color: '#2C2521' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  placeholderText: { fontSize: 14, color: '#8C827B' },
});