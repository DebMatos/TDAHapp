import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeContext';

export default function AuthScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);

    const { error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    setLoading(false);

    if (error) {
      Alert.alert('Não foi possível iniciar sessão', error.message);
    }
  };

  const signUp = async () => {
    setLoading(true);

    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Não foi possível criar a conta', error.message);
      return;
    }

    if (!session) {
      Alert.alert(
        'Confirma o email',
        'Enviámos um email para confirmares a conta.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>TDAHapp</Text>

        <Text style={styles.subtitle}>
          Inicia sessão para guardares as tuas tarefas.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={styles.input}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          style={styles.input}
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={signIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onAction} />
          ) : (
            <Text style={styles.primaryButtonText}>
              Iniciar sessão
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={signUp}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>
            Criar conta
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },

  card: {
    gap: 12,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
  },

  subtitle: {
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },

  input: {
    height: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.input,
    color: colors.text,
  },

  primaryButton: {
    height: 50,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.action,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onAction,
  },

  secondaryButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.action,
  },
});