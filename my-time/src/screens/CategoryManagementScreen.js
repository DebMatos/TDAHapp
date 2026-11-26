import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CategoryForm from '../components/CategoryForm';
import { useCategories } from '../data/CategoryContext';
import { createCategory, saveCategoryOrder, updateCategory } from '../data/categoryRepository';
import { canArchiveCategory, getFavoriteCategories, MAX_FAVORITE_CATEGORIES } from '../config/categories';
import { useTheme } from '../theme/ThemeContext';

export default function CategoryManagementScreen({ navigation }) {
  const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { categories, loading, error } = useCategories();
  const [expanded, setExpanded] = useState(null); const [archivedOpen, setArchivedOpen] = useState(false);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const favorites = getFavoriteCategories(categories);
  const favoriteIds = new Set(favorites.map(item => item.id));
  const others = categories.filter(item => !item.archived && !favoriteIds.has(item.id)).sort((a, b) => a.label.localeCompare(b.label, 'pt'));
  const archived = categories.filter(item => item.archived).sort((a, b) => a.label.localeCompare(b.label, 'pt'));
  const run = async (action, success = '') => {
    if (busy) return; setBusy(true); setNotice('');
    try { await action(); setExpanded(null); setNotice(success); } catch { setNotice('Não foi possível guardar a alteração. Tenta novamente.'); }
    finally { setBusy(false); }
  };
  const saveItem = async (item, values) => {
    const { favorite, ...changes } = values;
    const wasFavorite = favoriteIds.has(item.id);
    if (favorite && !wasFavorite && favorites.length >= MAX_FAVORITE_CATEGORIES) {
      throw Object.assign(new Error('Limite de favoritas atingido.'), { code: 'FAVORITES_LIMIT' });
    }
    await updateCategory(item.id, changes);
    if (favorite !== wasFavorite) {
      const orderedIds = favorite
        ? [...favorites.map(value => value.id), item.id]
        : favorites.filter(value => value.id !== item.id).map(value => value.id);
      await saveCategoryOrder(orderedIds);
    }
  };
  const editForm = item => expanded === item.id ? <CategoryForm key={`form-${item.id}`} category={item} busy={busy}
    favorite={favoriteIds.has(item.id)} canFavorite={favoriteIds.has(item.id) || favorites.length < MAX_FAVORITE_CATEGORIES}
    onCancel={() => setExpanded(null)} onSave={changes => void run(() => saveItem(item, changes), 'Categoria atualizada.')}
    onArchive={!item.archived && canArchiveCategory(item.id) ? () => void run(() => updateCategory(item.id, { archived: true, favoriteOrder: null }), 'Categoria arquivada.') : null}
    onRestore={item.archived ? () => void run(() => updateCategory(item.id, { archived: false, favoriteOrder: null }), 'Categoria restaurada.') : null} /> : null;
  const row = (item, draggable = false, drag) => <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${item.label}`} onPress={() => setExpanded(expanded === item.id ? null : item.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.rowStart}>
        {draggable && <Pressable accessibilityRole="button" accessibilityLabel={`Reordenar ${item.label}`} onLongPress={drag} delayLongPress={150}
          style={styles.drag}><Ionicons name="reorder-three-outline" size={24} color={colors.textMuted} /></Pressable>}
        <Ionicons name={item.icon} size={23} color={item.color} /><Text numberOfLines={1} style={styles.cardText}>{item.label}</Text>
      </View>
    </Pressable>{editForm(item)}</>;
  const listHeader = <>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === 'create' }} onPress={() => setExpanded(expanded === 'create' ? null : 'create')} style={styles.createButton}>
      <Ionicons name={expanded === 'create' ? 'close' : 'add'} size={25} color={colors.onNow} /><Text style={styles.createText}>Criar categoria</Text>
      <Ionicons name={expanded === 'create' ? 'chevron-up' : 'chevron-down'} size={21} color={colors.onNow} />
    </Pressable>
    {expanded === 'create' && <CategoryForm busy={busy} onCancel={() => setExpanded(null)} onSave={values => void run(() => createCategory(values), 'Categoria criada.')} />}
    {(notice || error) ? <Text accessibilityLiveRegion="polite" style={[styles.notice, notice.includes('Não foi') || error ? styles.error : null]}>{error || notice}</Text> : null}
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Favoritas</Text><Text style={styles.counter}>{favorites.length}/{MAX_FAVORITE_CATEGORIES}</Text></View>
    {loading ? <Text style={styles.empty}>A carregar categorias…</Text> : favorites.length === 0 ? <Text style={styles.empty}>Ainda não tens categorias favoritas.</Text> : null}
  </>;
  const listFooter = <>
    <Text style={[styles.sectionTitle, styles.otherTitle]}>Outras categorias</Text>
    {others.length === 0 ? <Text style={styles.empty}>Todas as categorias ativas estão nas favoritas.</Text> : others.map(item => <View key={item.id}>{row(item)}</View>)}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: archivedOpen }} onPress={() => setArchivedOpen(value => !value)} style={styles.archivedHeader}>
      <View style={styles.rowStart}><Ionicons name="archive-outline" size={22} color={colors.textSecondary} /><Text style={styles.archivedTitle}>Categorias arquivadas{archived.length ? ` (${archived.length})` : ''}</Text></View>
      <Ionicons name={archivedOpen ? 'chevron-up' : 'chevron-down'} size={21} color={colors.textSecondary} />
    </Pressable>
    {archivedOpen && (archived.length === 0 ? <Text style={styles.empty}>Não existem categorias arquivadas.</Text> : archived.map(item => <View key={item.id}>{row(item)}</View>))}
  </>;
  return <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => navigation.navigate('Home')} style={styles.headerButton}>
      <Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable><Text accessibilityRole="header" style={styles.title}>Categorias</Text><View style={styles.headerButton} /></View>
    <DraggableFlatList data={favorites} keyExtractor={item => item.id} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled" ListHeaderComponent={listHeader} ListFooterComponent={listFooter}
      onDragEnd={({ data }) => void run(() => saveCategoryOrder(data.map(item => item.id)), 'Ordem das favoritas atualizada.')}
      renderItem={({ item, drag, isActive }) => <ScaleDecorator><View style={isActive && styles.activeDrag}>{row(item, true, drag)}</View></ScaleDecorator>} />
  </View>;
}
const createStyles = colors => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, title: { flex: 1, color: colors.text, fontSize: 24, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 }, createButton: { minHeight: 54, paddingHorizontal: 18, borderRadius: 18, backgroundColor: colors.now, flexDirection: 'row', alignItems: 'center', gap: 12 },
  createText: { flex: 1, color: colors.onNow, fontSize: 17, fontWeight: '700' }, sectionHeader: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '700' }, counter: { color: colors.textSecondary, fontSize: 16 }, otherTitle: { marginTop: 14 },
  card: { minHeight: 58, borderRadius: 15, paddingLeft: 10, paddingRight: 7, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft },
  rowStart: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }, cardText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  drag: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  archivedHeader: { minHeight: 58, marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  archivedTitle: { color: colors.text, fontSize: 16, fontWeight: '600' }, empty: { color: colors.textMuted, paddingVertical: 10 }, notice: { color: colors.selectionText, paddingHorizontal: 4 }, error: { color: colors.danger },
  pressed: { opacity: 0.7 }, activeDrag: { opacity: 0.92 },
});
