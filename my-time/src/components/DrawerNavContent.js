import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { supabase } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import TaskBanner from './TaskBanner';
import { CustomThemeToggle } from './ThemeToggle';

export function DrawerNavContent(props) {
  const { colors } = useTheme();
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    if (busy) return;
    setNotice(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch {
      setNotice({
        title: 'Não foi possível terminar sessão',
        message: 'A saída não foi confirmada. Verifica a ligação e tenta novamente. Os dados locais não foram apagados.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Cabeçalho do Menu */}
        <View style={[styles.header, { borderBottomColor: colors.borderSoft }]}>
          <Text style={[styles.appTitle, { color: colors.text }]}>My Time</Text>
        </View>

        <View style={styles.appearanceRow}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            Tema
          </Text>
          <CustomThemeToggle
            disabled={busy}
            onSaveError={() => setNotice({
              title: 'A preferência de tema não ficou guardada',
              message: 'O tema foi aplicado nesta sessão, mas pode não ser mantido ao reabrir a aplicação. Tenta selecionar o tema novamente.',
            })}
          />
        </View>

      </DrawerContentScrollView>
      {/* Rodapé do Menu (Terminar Sessão) */}
      <View style={[styles.footer, { borderTopColor: colors.borderSoft }]}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.signOutText, { color: colors.danger }]}>
            Terminar sessão
          </Text>
        </TouchableOpacity>
      </View>
      <TaskBanner notice={notice} onDismiss={() => setNotice(null)} placement="top" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: {
    paddingBottom: 16,
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  appearanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 8,
    gap: 12,

  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
