import { StyleSheet } from 'react-native';
import { darkColors, lightColors } from '../colors';

const baseStyles = StyleSheet.create({
  floatingButton: {
    position: 'absolute', right: 16, bottom: 20, zIndex: 10,
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { resizeMode: 'contain', width: 24, height: 24 },
});

const lightFloatingButton = StyleSheet.create({
  ...baseStyles,
  floatingButton: {
    ...baseStyles.floatingButton,
    backgroundColor: lightColors.floatingButton.background,
    borderWidth: 1,
    borderColor: lightColors.floatingButton.border,
    elevation: 4,
    shadowColor: lightColors.floatingButton.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: lightColors.floatingButton.shadowOpacity ?? 0.15,
    shadowRadius: 5,
  },
});

const darkFloatingButton = StyleSheet.create({
  ...baseStyles,
  floatingButton: {
    ...baseStyles.floatingButton,
    backgroundColor: darkColors.floatingButton.background,
    borderWidth: 1.5,
    borderColor: darkColors.now,
    elevation: 8,
    shadowColor: darkColors.floatingButton.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: darkColors.floatingButton.shadowOpacity ?? 0.4,
    shadowRadius: 8,
  },
});

export const getFloatingButtonStyles = (isDark: boolean) =>
  isDark ? darkFloatingButton : lightFloatingButton;
