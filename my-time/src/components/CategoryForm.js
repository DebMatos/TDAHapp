import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../config/categories';
import { useTheme } from '../theme/ThemeContext';

const iconLabels = {
  home: 'casa', briefcase: 'trabalho', barbell: 'exercício', book: 'livro estudo', heart: 'coração saúde',
  leaf: 'natureza', cafe: 'café', musical: 'música', laptop: 'computador', code: 'programação', layers: 'projetos',
  star: 'estrela', bicycle: 'bicicleta', airplane: 'viagem', school: 'escola', paw: 'animal', restaurant: 'comida',
  people: 'pessoas', cash: 'dinheiro', construct: 'ferramentas', game: 'jogos', camera: 'fotografia', medkit: 'saúde', gift: 'presente',
};

export default function CategoryForm({ category, favorite = false, canFavorite = true, onCancel, onSave, onArchive, onRestore, busy = false }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState(category?.label ?? '');
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(category?.icon ?? CATEGORY_ICONS[0]);
  const [isFavorite, setIsFavorite] = useState(favorite);
  const [query, setQuery] = useState('');
  const visibleIcons = CATEGORY_ICONS.filter(value => `${value} ${iconLabels[value.split('-')[0]] ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const valid = name.trim().length > 0;
  return (
    <View style={styles.form} accessibilityLabel={category ? `Editar ${category.label}` : 'Criar categoria'}>
      <Text style={styles.label}>Nome</Text>
      <TextInput value={name} onChangeText={setName} editable={!busy} placeholder="Nome da categoria"
        placeholderTextColor={colors.placeholder} accessibilityLabel="Nome da categoria" maxLength={50} style={styles.input} />
      <Text style={styles.label}>Cor</Text>
      <View style={styles.palette} accessibilityRole="radiogroup" accessibilityLabel="Cor da categoria">
        {CATEGORY_COLORS.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Cor ${value}`}
          accessibilityState={{ checked: color === value, disabled: busy }} disabled={busy} onPress={() => setColor(value)}
          style={[styles.color, { backgroundColor: value }, color === value && styles.selectedColor]}>
          {color === value && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
        </Pressable>)}
      </View>
      <Text style={styles.label}>Ícone</Text>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={20} color={colors.textMuted} />
        <TextInput value={query} onChangeText={setQuery} editable={!busy} placeholder="Pesquisar ícones"
          placeholderTextColor={colors.placeholder} accessibilityLabel="Pesquisar ícones" style={styles.searchInput} />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Limpar pesquisa" onPress={() => setQuery('')} style={styles.clear}>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>}
      </View>
      <View style={styles.icons}>
        {visibleIcons.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={iconLabels[value.split('-')[0]] ?? value}
          accessibilityState={{ checked: icon === value, disabled: busy }} disabled={busy} onPress={() => setIcon(value)}
          style={[styles.icon, icon === value && styles.selectedIcon]}>
          <Ionicons name={value} size={23} color={icon === value ? colors.selectionText : colors.textSecondary} />
        </Pressable>)}
      </View>
      {visibleIcons.length === 0 && <Text style={styles.empty}>Nenhum ícone encontrado.</Text>}
      {category && !category.archived && <View style={styles.favoriteRow}>
        <View style={styles.favoriteCopy}>
          <Text style={styles.favoriteTitle}>Mostrar nos formulários de criação</Text>
          <Text style={styles.favoriteHint}>{canFavorite || isFavorite ? 'As favoritas aparecem pela ordem definida nesta página.' : 'Já tens cinco categorias favoritas.'}</Text>
        </View>
        <Switch value={isFavorite} disabled={busy || (!canFavorite && !isFavorite)} onValueChange={setIsFavorite}
          accessibilityLabel={`${isFavorite ? 'Remover' : 'Adicionar'} ${category.label} ${isFavorite ? 'dos' : 'aos'} favoritos`}
          trackColor={{ false: colors.border, true: colors.selectionSoft }} thumbColor={isFavorite ? colors.selection : colors.textFaint} />
      </View>}
      {onArchive && <Pressable accessibilityRole="button" disabled={busy} onPress={onArchive} style={styles.archive}>
        <Ionicons name="archive-outline" size={19} color={colors.danger} /><Text style={styles.archiveText}>Arquivar categoria</Text>
      </Pressable>}
      {onRestore && <Pressable accessibilityRole="button" disabled={busy} onPress={onRestore} style={styles.restore}>
        <Ionicons name="refresh-outline" size={19} color={colors.textSecondary} /><Text style={styles.restoreText}>Restaurar categoria</Text>
      </Pressable>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!valid || busy} accessibilityState={{ disabled: !valid || busy, busy }}
          onPress={() => onSave({ label: name.trim(), color, icon, favorite: isFavorite })} style={[styles.primary, (!valid || busy) && styles.disabled]}>
          <Text style={styles.primaryText}>{category ? 'Guardar' : 'Criar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const createStyles = colors => StyleSheet.create({
  form: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  input: { minHeight: 44, borderRadius: 12, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 14, fontSize: 16 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, color: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  selectedColor: { borderWidth: 3, borderColor: colors.surface },
  search: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.input, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 }, clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, icon: { width: 48, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft },
  selectedIcon: { backgroundColor: colors.selectionSoft }, empty: { color: colors.textMuted, paddingVertical: 12 },
  favoriteRow: { minHeight: 58, marginTop: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  favoriteCopy: { flex: 1 }, favoriteTitle: { color: colors.text, fontSize: 15, fontWeight: '600' }, favoriteHint: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  archive: { minHeight: 44, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  archiveText: { color: colors.danger, fontWeight: '600' }, actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 2 },
  restore: { minHeight: 44, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  restoreText: { color: colors.text, fontWeight: '600' },
  secondary: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: colors.text, fontWeight: '600' },
  primary: { minHeight: 44, minWidth: 112, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.onAction, fontWeight: '700' }, disabled: { opacity: 0.45 },
});
