import React from 'react';
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
export function DrawerNavContent(props) {
  const { colors, themeMode, setThemeMode, isDark } = useTheme();

  const themeOptions = [
    { label: 'Automático (Sistema)', value: 'system', icon: 'hardware-chip-outline' },
    { label: 'Modo Claro', value: 'light', icon: 'sunny-outline' },
    { label: 'Modo Escuro', value: 'dark', icon: 'moon-outline' },
  ];

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('[Auth] Falha ao terminar sessão:', error);
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

        {/* Secção de Aparência / Tema */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            APARÊNCIA
          </Text>

          {themeOptions.map((option) => {
            const isSelected = themeMode === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? colors.surfaceSoft
                        : colors.surfaceMuted
                      : 'transparent',
                    borderColor: isSelected ? colors.now : 'transparent',
                  },
                ]}
                onPress={() => setThemeMode(option.value)}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={isSelected ? colors.text : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: colors.text,
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </View>

                {isSelected && (
                  <Ionicons name="checkmark" size={18} color={colors.now} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </DrawerContentScrollView>

      {/* Rodapé do Menu (Terminar Sessão) */}
      <View style={[styles.footer, { borderTopColor: colors.borderSoft }]}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.signOutText, { color: colors.danger }]}>
            Terminar sessão
          </Text>
        </TouchableOpacity>
      </View>
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
  appSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    fontSize: 14,
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
});