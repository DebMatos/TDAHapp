import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Feather } from '@expo/vector-icons';

const TOGGLE_METRICS = {
  trackWidth: 89, // Largura total do toggle
  trackHeight: 35, // Altura total
  thumbSize: 30, // Tamanho da bola
  borderWidth: 1,
  padding: 2, // Espaçamento da bola às bordas
};

// The thumb starts after the track border and padding in normal layout.
const thumbTravel = TOGGLE_METRICS.trackWidth - TOGGLE_METRICS.thumbSize
  - 2 * (TOGGLE_METRICS.padding + TOGGLE_METRICS.borderWidth);

export const CustomThemeToggle = ({ disabled = false, onSaveError }) => {
  const { colors, isDark, setThemeMode } = useTheme();
  const theme = colors.themeToggle;
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // 0 = Claro, 1 = Escuro
  const animValue = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(animValue, {
      toValue: isDark ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [animValue, isDark]);

  const handlePress = async () => {
    if (disabled || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await setThemeMode(isDark ? 'light' : 'dark');
    } catch {
      onSaveError?.();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, thumbTravel],
  });

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || saving}
      accessibilityRole="switch"
      accessibilityLabel="Tema escuro"
      accessibilityHint="Alterna entre os temas claro e escuro"
      accessibilityState={{ checked: isDark, disabled: disabled || saving, busy: saving }}
      style={[styles.track, { backgroundColor: theme.track, borderColor: theme.border }]}
    >
      {/* Texto no fundo da cápsula */}
      <View style={styles.labelsContainer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[styles.labelText, { color: theme.label }, isDark ? styles.textVisible : styles.textHidden]}>
          Escuro
        </Text>
        <Text style={[styles.labelText, { color: theme.label }, !isDark ? styles.textVisible : styles.textHidden]}>
          Claro
        </Text>
      </View>

      {/* Bolinha estilizada como o botão flutuante da abelha */}
      <Animated.View
        style={[
          styles.thumb,
          isDark ? styles.thumbDark : styles.thumbLight,
          { backgroundColor: theme.thumb, borderColor: theme.thumbBorder, shadowColor: theme.shadow },
          { transform: [{ translateX }] },
        ]}
      >
        <Feather name={isDark ? 'moon' : 'sun'} size={14} color={theme.icon} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // Trilho / Cápsula principal
  track: {
    width: TOGGLE_METRICS.trackWidth,
    height: TOGGLE_METRICS.trackHeight,
    borderRadius: TOGGLE_METRICS.trackHeight / 2,
    padding: TOGGLE_METRICS.padding,
    justifyContent: 'center',
    position: 'relative',
    borderWidth: TOGGLE_METRICS.borderWidth,
  },
  thumbLight: {
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  // Alinhamento do texto "Claro" / "Escuro"
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Garante que o texto fica posicionado mesmo ao lado da área de paragem da bola
    paddingLeft: TOGGLE_METRICS.padding + 8,
    paddingRight: TOGGLE_METRICS.padding + 8,
    position: 'absolute',
    width: '100%',
    left: 0,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textVisible: {
    opacity: 1,
  },
  textHidden: {
    opacity: 0,
  },

  thumb: {
    width: TOGGLE_METRICS.thumbSize,
    height: TOGGLE_METRICS.thumbSize,
    borderRadius: TOGGLE_METRICS.thumbSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  thumbDark: {
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
});
