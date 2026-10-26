import { StyleSheet } from 'react-native';
import { darkColors, lightColors } from '../../theme/colors';

const AXIS_WIDTH = 50;

const baseStyles = {
  safe: {
    flex: 1,
  },
  timelineViewport: {
    flex: 1,
    position: 'relative',
    marginTop: 2,
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourTextOverview: {
    fontSize: 9,
  },
  railContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: AXIS_WIDTH - 0.5,
    width: 1,
    zIndex: 2,
  },
  railSegment: {
    position: 'absolute',
    left: 0,
    width: 1,
  },
  hourDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: -2,
    marginRight: -2,
    zIndex: 3,
  },
  halfHourLine: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderStyle: 'dashed' as const,
  },
  nowDot: {
    position: 'absolute',
    left: -3,
    top: -2.5,
    width: 6.5,
    height: 6.5,
    borderRadius: 4,
  },
  nowBeeImage: {
    position: 'absolute',
    right: -6,
    top: -10,
    width: 20,
    height: 20,
    resizeMode: 'contain' as const,
    transform: [{ rotate: '90deg' }],
  },
  bee: {
    resizeMode: 'contain' as const,
    width: 24,
    height: 24,
  },
} as const;

export const lightHomeStyles = StyleSheet.create({
  ...baseStyles,
  safe: { ...baseStyles.safe, backgroundColor: lightColors.surface },
  timelineCanvas: { position: 'relative', backgroundColor: lightColors.surface },
  hourText: {
    width: AXIS_WIDTH,
    paddingRight: 10,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '400',
    color: lightColors.textMuted,
  },
  hourTextOverview: { ...baseStyles.hourTextOverview, color: lightColors.textFaint },
  hourLine: {
    position: 'absolute',
    left: 50,
    right: 20,
    height: 1,
    backgroundColor: lightColors.borderSoft,
  },
  hourLineOverview: { backgroundColor: lightColors.timelineGrid },
  halfHourLine: { ...baseStyles.halfHourLine, borderBottomColor: lightColors.timelineGrid },
  nowLine: {
    position: 'absolute',
    left: AXIS_WIDTH,
    right: 20,
    height: 1.5,
    zIndex: 90,
    backgroundColor: lightColors.now,
  },
  nowDot: { ...baseStyles.nowDot, backgroundColor: lightColors.now },

  // Botão em Light Mode
  goToNowButton: {
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

    elevation: 4,
    shadowColor: lightColors.floatingButton.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: lightColors.floatingButton.shadowOpacity ?? 0.15,
    shadowRadius: 5,
  },
});

export const darkHomeStyles = StyleSheet.create({
  ...baseStyles,
  safe: { ...baseStyles.safe, backgroundColor: darkColors.surface },
  timelineCanvas: { position: 'relative', backgroundColor: darkColors.surface },
  hourText: {
    width: AXIS_WIDTH,
    paddingRight: 10,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '400',
    color: darkColors.textMuted,
  },
  hourTextOverview: { ...baseStyles.hourTextOverview, color: darkColors.textFaint },
  hourLine: {
    position: 'absolute',
    left: 50,
    right: 20,
    height: 1,
    backgroundColor: darkColors.borderSoft,
  },
  hourLineOverview: { backgroundColor: darkColors.timelineGrid },
  halfHourLine: { ...baseStyles.halfHourLine, borderBottomColor: darkColors.timelineGrid },
  nowLine: {
    position: 'absolute',
    left: AXIS_WIDTH,
    right: 20,
    height: 1.5,
    zIndex: 90,
    backgroundColor: darkColors.now,
  },
  nowDot: { ...baseStyles.nowDot, backgroundColor: darkColors.now },

  // Botão em Dark Mode
  goToNowButton: {
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
    borderColor: darkColors.now,

    elevation: 8,
    shadowColor: darkColors.floatingButton.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: darkColors.floatingButton.shadowOpacity ?? 0.4,
    shadowRadius: 8,
  },
});

export const getHomeScreenStyles = (isDark: boolean) =>
  isDark ? darkHomeStyles : lightHomeStyles;