import { StyleSheet } from 'react-native';

export const TASK_DETAILS_HEIGHT_RATIO = 0.78;

// Shared presentation only. Each sheet keeps its own height and gesture logic.
export const createTaskSheetStyles = (colors) => StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.taskSheet.backdrop },
  surface: {
    backgroundColor: colors.taskSheet.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  content: { paddingHorizontal: 18 },
  topBar: { height: 44, position: 'relative', justifyContent: 'center' },
  dragZone: { height: 38, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.taskCardMuted },
  button: { height: 44, alignItems: 'center', justifyContent: 'center' },
  actionButton: {
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.now,
    backgroundColor: colors.floatingButton.background,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },


  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.taskSheet.chipBackground,
    borderColor: colors.taskSheet.chipBorder,
  },
  chipSelected: {
    backgroundColor: colors.selectionSoft || colors.surfaceSoft,
    borderColor: colors.now,            // Anel amarelado/dourado idêntico ao mascote/toggle
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    fontWeight: '600',
    color: colors.selectionText || colors.text,
  },

  // --- BOTÃO DE AÇÃO (GUARDA / SETA) ---
  submitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  submitButtonDisabled: {
    backgroundColor: colors.surfaceMuted, // Fundo subtil desativado
    borderColor: 'transparent',
    elevation: 0,
  },
  submitButtonEnabled: {
    backgroundColor: colors.action,       // Azul-petróleo ativo
    borderColor: colors.now,              // Anel dourado em redor
    elevation: 0,
    shadowOpacity: 0,
  },
});

