import { StyleSheet } from 'react-native';
import { darkColors, lightColors } from '../colors';

// ─── FLOATING BUTTON (LIGHT) ──────────────────────────────────────────────
const lightFloatingButton = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    zIndex: 10,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: lightColors.floatingButton.background,
    borderWidth: 1,
    borderColor: lightColors.floatingButton.border,

    // Sombra física tradicional para Light Mode
    elevation: 4,
    shadowColor: lightColors.floatingButton.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: lightColors.floatingButton.shadowOpacity ?? 0.15,
    shadowRadius: 5,
  },
  icon: {
    resizeMode: 'contain',
    width: 24,
    height: 24,
  },
});

// ─── FLOATING BUTTON (DARK) ───────────────────────────────────────────────
const darkFloatingButton = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    zIndex: 10,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: darkColors.floatingButton.background,
    borderWidth: 1.5,
    borderColor: darkColors.now, // Contorno amarelo vibrante da abelha (#F0CE62)

    // Brilho / Aura em redor do botão para Dark Mode
    elevation: 8,
    shadowColor: darkColors.floatingButton.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: darkColors.floatingButton.shadowOpacity ?? 0.4,
    shadowRadius: 8,
  },
  icon: {
    resizeMode: 'contain',
    width: 24,
    height: 24,
  },
});

/**
 * Retorna os estilos estáticos do botão flutuante com base no tema ativo
 */
export const getFloatingButtonStyles = (isDark: boolean) =>
  isDark ? darkFloatingButton : lightFloatingButton;