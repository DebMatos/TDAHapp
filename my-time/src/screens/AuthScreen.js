import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PASSWORD_RECOVERY_REDIRECT } from '../auth/passwordRecovery';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeContext';

const MINIMUM_PASSWORD_LENGTH = 6;

const friendlyError = (fallback) => {
  if (/network|fetch|timeout/i.test(fallback || '')) {
    return 'Não foi possível ligar ao serviço. Verifica a ligação e tenta novamente.';
  }
  if (/rate|too many/i.test(fallback || '')) {
    return 'Foram feitos demasiados pedidos. Aguarda alguns minutos e tenta novamente.';
  }
  return 'Não foi possível concluir o pedido. Confirma os dados e tenta novamente.';
};

function PasswordField({ value, onChangeText, placeholder, autoComplete, visible,
  onToggleVisibility, editable, styles, colors }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{placeholder}</Text>
      <View style={styles.passwordField}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="••••••••"
          placeholderTextColor={colors.placeholder}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          editable={editable}
          style={styles.passwordInput}
          accessibilityLabel={placeholder}
        />
        <Pressable
          onPress={onToggleVisibility}
          disabled={!editable}
          hitSlop={8}
          style={({ pressed }) => [styles.visibilityButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={visible ? `Ocultar ${placeholder.toLowerCase()}` : `Mostrar ${placeholder.toLowerCase()}`}
          accessibilityState={{ disabled: !editable, expanded: visible }}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={21}
            color={colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

export default function AuthScreen({
  passwordRecovery = { active: false, loading: false, error: null },
  onPasswordRecoveryComplete,
  onCancelPasswordRecovery,
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const busy = loading || passwordRecovery.loading;
  const recoveryMode = passwordRecovery.active;

  const signIn = async () => {
    if (!email.trim() || !password) {
      setNotice({ tone: 'error', text: 'Preenche o email e a palavra-passe.' });
      return;
    }
    setNotice(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setNotice({ tone: 'error', text: 'Email ou palavra-passe incorretos.' });
    } catch (error) {
      setNotice({ tone: 'error', text: friendlyError(error?.message) });
    } finally {
      setLoading(false);
    }
  };

  const signUp = async () => {
    if (!email.trim() || !password) {
      setNotice({ tone: 'error', text: 'Preenche o email e a palavra-passe.' });
      return;
    }
    setNotice(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) setNotice({ tone: 'error', text: friendlyError(error.message) });
      else if (!data.session) {
        setNotice({ tone: 'success', text: 'Enviámos um email para confirmares a conta.' });
      }
    } catch (error) {
      setNotice({ tone: 'error', text: friendlyError(error?.message) });
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setNotice({ tone: 'error', text: 'Introduz um endereço de email válido.' });
      return;
    }
    setNotice(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: PASSWORD_RECOVERY_REDIRECT,
      });
      if (error) throw error;
      setNotice({
        tone: 'success',
        text: 'Se existir uma conta associada a este email, receberás as instruções para redefinir a palavra-passe.',
      });
    } catch (error) {
      setNotice({ tone: 'error', text: friendlyError(error?.message) });
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (newPassword.length < MINIMUM_PASSWORD_LENGTH) {
      setNotice({ tone: 'error', text: `A nova palavra-passe deve ter pelo menos ${MINIMUM_PASSWORD_LENGTH} caracteres.` });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ tone: 'error', text: 'As palavras-passe não coincidem.' });
      return;
    }
    setNotice(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      setNewPassword('');
      setConfirmPassword('');
      setNotice({ tone: 'success', text: 'Palavra-passe alterada. Já podes iniciar sessão.' });
      onPasswordRecoveryComplete?.();
    } catch (error) {
      setNotice({ tone: 'error', text: friendlyError(error?.message) });
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (nextMode) => {
    setNotice(null);
    setMode(nextMode);
  };

  const renderNotice = () => {
    const activeNotice = passwordRecovery.error
      ? { tone: 'error', text: passwordRecovery.error }
      : notice;
    if (!activeNotice) return <View style={styles.noticePlaceholder} />;
    return (
      <View
        style={[styles.notice, activeNotice.tone === 'error' ? styles.errorNotice : styles.successNotice]}
        accessibilityRole={activeNotice.tone === 'error' ? 'alert' : 'text'}
        accessibilityLiveRegion="polite"
      >
        <Ionicons
          name={activeNotice.tone === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
          size={19}
          color={activeNotice.tone === 'error' ? colors.danger : colors.success}
        />
        <Text style={styles.noticeText}>{activeNotice.text}</Text>
      </View>
    );
  };

  const renderRecovery = () => {
    if (passwordRecovery.loading) {
      return (
        <View style={styles.centeredState} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.action} />
          <Text style={styles.stateText}>A validar o link de recuperação…</Text>
        </View>
      );
    }
    if (passwordRecovery.error) {
      return (
        <>
          <Text style={styles.title}>Link indisponível</Text>
          <Text style={styles.subtitle}>Pede um novo email de recuperação para continuares.</Text>
          {renderNotice()}
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={onCancelPasswordRecovery}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Voltar ao login</Text>
          </Pressable>
        </>
      );
    }
    return (
      <>
        <Text style={styles.title}>Nova palavra-passe</Text>
        <Text style={styles.subtitle}>Escolhe uma nova palavra-passe para voltares a entrar na My Time.</Text>
        <Text style={styles.requirement}>Usa pelo menos {MINIMUM_PASSWORD_LENGTH} caracteres.</Text>
        <PasswordField
          value={newPassword} onChangeText={setNewPassword} placeholder="Nova palavra-passe"
          autoComplete="new-password" visible={newPasswordVisible}
          onToggleVisibility={() => setNewPasswordVisible((value) => !value)}
          editable={!busy} styles={styles} colors={colors}
        />
        <PasswordField
          value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirmar palavra-passe"
          autoComplete="new-password" visible={confirmPasswordVisible}
          onToggleVisibility={() => setConfirmPasswordVisible((value) => !value)}
          editable={!busy} styles={styles} colors={colors}
        />
        {renderNotice()}
        <PrimaryButton busy={busy} onPress={updatePassword} label="Guardar nova palavra-passe" styles={styles} colors={colors} />
      </>
    );
  };

  const renderResetRequest = () => (
    <>
      <Text style={styles.title}>Recuperar acesso</Text>
      <Text style={styles.subtitle}>Indica o email da tua conta. Enviaremos um link para definires uma nova palavra-passe.</Text>
      <EmailField email={email} setEmail={setEmail} editable={!busy} styles={styles} colors={colors} />
      {renderNotice()}
      <PrimaryButton busy={busy} onPress={requestPasswordReset} label="Enviar link de recuperação" styles={styles} colors={colors} />
      <SecondaryButton onPress={() => changeMode('sign-in')} disabled={busy} label="Voltar ao login" styles={styles} />
    </>
  );

  const renderSignIn = () => (
    <>
      <Text style={styles.title}>Bem-vindo de volta</Text>
      <Text style={styles.subtitle}>Entra para continuares a organizar o teu dia.</Text>
      <EmailField email={email} setEmail={setEmail} editable={!busy} styles={styles} colors={colors} />
      <PasswordField
        value={password} onChangeText={setPassword} placeholder="Palavra-passe"
        autoComplete="current-password" visible={passwordVisible}
        onToggleVisibility={() => setPasswordVisible((value) => !value)}
        editable={!busy} styles={styles} colors={colors}
      />
      <Pressable
        style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]}
        onPress={() => changeMode('reset-request')}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.forgotButtonText}>Esqueci-me da palavra-passe</Text>
      </Pressable>
      {renderNotice()}
      <PrimaryButton busy={busy} onPress={signIn} label="Iniciar sessão" styles={styles} colors={colors} />
      <SecondaryButton onPress={signUp} disabled={busy} label="Criar conta" styles={styles} />
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand} accessibilityRole="header">
            <Image
              source={isDark ? require('../../assets/pirilampo.png') : require('../../assets/abelha.png')}
              style={styles.mascot}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessible
              accessibilityLabel={isDark ? 'Pirilampo da My Time' : 'Abelha da My Time'}
            />
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>My Time</Text>
              <Text style={styles.brandTagline}>O teu dia, ao teu ritmo.</Text>
            </View>
          </View>
          <View style={styles.card}>
            {recoveryMode ? renderRecovery() : mode === 'reset-request' ? renderResetRequest() : renderSignIn()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmailField({ email, setEmail, editable, styles, colors }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>Email</Text>
      <TextInput
        value={email} onChangeText={setEmail} placeholder="nome@exemplo.pt"
        placeholderTextColor={colors.placeholder} keyboardType="email-address"
        autoCapitalize="none" autoCorrect={false} autoComplete="email"
        editable={editable} style={styles.input} accessibilityLabel="Email"
      />
    </View>
  );
}

function PrimaryButton({ busy, onPress, label, styles, colors }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
      onPress={onPress} disabled={busy} accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
    >
      {busy ? <ActivityIndicator color={colors.onAction} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

function SecondaryButton({ onPress, disabled, label, styles }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
      onPress={onPress} disabled={disabled} accessibilityRole="button"
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32, backgroundColor: colors.background },
  brand: { width: '100%', maxWidth: 440, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20, paddingHorizontal: 6 },
  mascot: { width: 66, height: 66 },
  brandCopy: { flex: 1 },
  brandName: { fontSize: 24, fontWeight: '700', letterSpacing: 0.2, color: colors.text },
  brandTagline: { marginTop: 2, fontSize: 14, lineHeight: 19, color: colors.textMuted },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft, borderRadius: 22, backgroundColor: colors.surface },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: colors.text },
  subtitle: { marginBottom: 8, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  requirement: { marginBottom: 2, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  fieldGroup: { gap: 7 },
  fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.textSecondary },
  input: { height: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text },
  passwordField: { height: 50, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input },
  passwordInput: { flex: 1, height: '100%', paddingLeft: 14, paddingRight: 6, color: colors.text },
  visibilityButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  forgotButton: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingLeft: 12 },
  forgotButtonText: { fontSize: 14, fontWeight: '600', color: colors.action },
  noticePlaceholder: { minHeight: 8 },
  notice: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  errorNotice: { borderColor: colors.danger, backgroundColor: colors.surfaceSoft },
  successNotice: { borderColor: colors.success, backgroundColor: colors.surfaceSoft },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  primaryButton: { height: 50, marginTop: 2, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.action },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: colors.onAction },
  secondaryButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: colors.action },
  centeredState: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 16 },
  stateText: { fontSize: 15, color: colors.textSecondary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.55 },
});
