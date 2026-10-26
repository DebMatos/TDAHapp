import { StyleSheet } from 'react-native';

export const TASK_DETAILS_HEIGHT_RATIO = 0.78;

// Shared presentation only. Each sheet keeps its own height and gesture logic.
export const createTaskSheetStyles = (colors) => StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.backdrop },
  surface: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  content: { paddingHorizontal: 18 },
  topBar: { height: 44, position: 'relative', justifyContent: 'center' },
  dragZone: { height: 38, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.taskCardMuted },
  button: { height: 44, alignItems: 'center', justifyContent: 'center' },
});
