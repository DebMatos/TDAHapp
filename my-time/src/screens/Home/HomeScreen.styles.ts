import { StyleSheet } from 'react-native';
import { AXIS_WIDTH } from '../../constants/timeline';
import { darkColors, lightColors } from '../../theme/colors';

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  timelineViewport: { flex: 1, position: 'relative', marginTop: 2 },
  timelineCanvas: { position: 'relative' },
  hourRow: {
    position: 'absolute', left: 0, right: 0, height: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  hourText: {
    width: AXIS_WIDTH, paddingRight: 10, textAlign: 'right',
    fontSize: 12, fontWeight: '400',
  },
  hourTextOverview: { fontSize: 9 },
  hourLine: { position: 'absolute', left: AXIS_WIDTH, right: 20, height: 1 },
  railContainer: {
    position: 'absolute', top: 0, bottom: 0, left: AXIS_WIDTH - 0.5,
    width: 1, zIndex: 2,
  },
  railSegment: { position: 'absolute', left: 0, width: 1 },
  hourDot: {
    width: 4, height: 4, borderRadius: 2,
    marginLeft: -2, marginRight: -2, zIndex: 3,
  },
  halfHourLine: {
    backgroundColor: 'transparent', borderBottomWidth: 1, borderStyle: 'dashed',
  },
  nowLine: {
    position: 'absolute', left: AXIS_WIDTH, right: 20, height: 1.5, zIndex: 90,
  },
  nowDot: {
    position: 'absolute', left: -3, top: -2.5,
    width: 6.5, height: 6.5, borderRadius: 4,
  },
  nowBeeImage: {
    position: 'absolute', right: -6, top: -10,
    width: 20, height: 20, resizeMode: 'contain',
    transform: [{ rotate: '90deg' }],
  },
});

const createHomeStyles = (colors: typeof lightColors) => StyleSheet.create({
  ...baseStyles,
  safe: { ...baseStyles.safe, backgroundColor: colors.surface },
  timelineCanvas: { ...baseStyles.timelineCanvas, backgroundColor: colors.surface },
  hourText: { ...baseStyles.hourText, color: colors.textMuted },
  hourTextOverview: { ...baseStyles.hourTextOverview, color: colors.textFaint },
  hourLine: { ...baseStyles.hourLine, backgroundColor: colors.borderSoft },
  hourLineOverview: { backgroundColor: colors.timelineGrid },
  halfHourLine: { ...baseStyles.halfHourLine, borderBottomColor: colors.timelineGrid },
  nowLine: { ...baseStyles.nowLine, backgroundColor: colors.now },
  nowDot: { ...baseStyles.nowDot, backgroundColor: colors.now },
});

export const lightHomeStyles = createHomeStyles(lightColors);
export const darkHomeStyles = createHomeStyles(darkColors);

export const getHomeScreenStyles = (isDark: boolean) =>
  isDark ? darkHomeStyles : lightHomeStyles;
