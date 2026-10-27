import React, { useEffect, useRef } from 'react';
import { Pressable, View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import Icon from 'react-native-vector-icons/Feather';
import { lightColors, darkColors } from '../theme/colors';

const TOGGLE_METRICS = {
  trackWidth: 89, // Largura total do toggle
  trackHeight: 35, // Altura total
  thumbSize: 30, // Tamanho da bola
  padding: 2, // Espaçamento da bola às bordas
};

const getTranslateRange = ({ trackWidth, thumbSize, padding }) => {
  const minX = padding;
  const maxX = trackWidth - thumbSize - padding;
  return [minX, maxX - 6];
};

export const CustomThemeToggle = () => {
  const { isDark, setThemeMode } = useTheme();
  const theme = isDark ? darkColors : lightColors;
  // 0 = Claro, 1 = Escuro
  const animValue = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: isDark ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isDark]);

  const handlePress = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setThemeMode(nextTheme);
  };
  const [minX, maxX] = getTranslateRange(TOGGLE_METRICS);

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [minX, maxX],
  });

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.track, isDark ? styles.trackDark : styles.trackLight]}
    >
      {/* Texto no fundo da cápsula */}
      <View style={styles.labelsContainer}>
        <Text style={[styles.labelText, isDark ? styles.textVisible : styles.textHidden]}>
          Escuro
        </Text>
        <Text style={[styles.labelText, !isDark ? styles.textVisible : styles.textHidden]}>
          Claro
        </Text>
      </View>

      {/* Bolinha estilizada como o botão flutuante da abelha */}
      <Animated.View
        style={[
          styles.thumb,
          isDark ? styles.thumbDark : styles.thumbLight,
          { transform: [{ translateX }] },
        ]}
      >
        <Icon name={isDark ? 'moon' : 'sun'} size={14} color={isDark ? '#FACC15' : '#EAB308'} />
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
    borderWidth: 1,
  },
  // 1. Cápsula no modo claro: Fundo neutro com borda suave
  trackLight: {
    backgroundColor: '#F4F4F5', // Um cinza quente/neutro (Zinc-100)
    borderColor: '#E4E4E7', // Borda subtil
  },

  thumbLight: {
    backgroundColor: lightColors.surfaceMuted, // Branco puro',
    borderWidth: 1.5,
    borderColor: '#EAB308', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  trackDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
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
    color: '#a1a1aa',
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
    backgroundColor: '#1c1c1e',
    borderWidth: 1.5,
    borderColor: '#eab308', 
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
});
