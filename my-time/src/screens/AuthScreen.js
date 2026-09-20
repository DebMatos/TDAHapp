import React, { useState } from 'react';
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

export default function AuthScreen() {
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
          placeholderTextColor="#A0958E"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={styles.input}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#A0958E"
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
            <ActivityIndicator color="#FFFFFF" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFDF9',
  },

  card: {
    gap: 12,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#403B37',
  },

  subtitle: {
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 21,
    color: '#8A827C',
  },

  input: {
    height: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E7E3DF',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    color: '#403B37',
  },

  primaryButton: {
    height: 50,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#3A9BB7',
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  secondaryButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3A9BB7',
  },
});