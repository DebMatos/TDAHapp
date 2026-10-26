import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors } from './colors';

const THEME_STORAGE_KEY = '@tdahapp/theme-mode';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemMode = useColorScheme();
  const [themeMode, setThemeModeState] = useState('system');
  const didSetThemeRef = useRef(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedMode) => {
        if (!active || didSetThemeRef.current) return;
        if (storedMode === null) return;
        if (['system', 'light', 'dark'].includes(storedMode)) {
          setThemeModeState(storedMode);
        } else {
          console.warn('[Theme] Preferência de tema inválida; a usar o tema do dispositivo.');
        }
      })
      .catch((error) => {
        console.warn('[Theme] Falha ao carregar preferência:', error);
      });
    return () => {
      active = false;
    };
  }, []);

  const setThemeMode = useCallback(async (nextMode) => {
    if (!['system', 'light', 'dark'].includes(nextMode)) {
      throw new Error(`Modo de tema inválido: ${nextMode}`);
    }
    didSetThemeRef.current = true;
    setThemeModeState(nextMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch (error) {
      console.warn('[Theme] Falha ao guardar preferência:', error);
      throw error;
    }
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemMode === 'dark');
  const colors = isDark ? darkColors : lightColors;
  const value = useMemo(
    () => ({ colors, themeMode, setThemeMode, isDark }),
    [colors, themeMode, setThemeMode, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser utilizado dentro de ThemeProvider.');
  }
  return context;
}
