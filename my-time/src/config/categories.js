import { lightColors } from '../theme/colors';

export const MAX_FAVORITE_CATEGORIES = 5;
export const DEFAULT_CATEGORIES = [
  { id: 'inbox', label: 'Caixa de entrada', icon: 'archive-outline', color: '#6B8296', favoriteOrder: 0, isSystem: true },
  { id: 'work', label: 'Trabalho', icon: 'briefcase-outline', color: '#C86D51', favoriteOrder: 1, isSystem: true },
  { id: 'personal', label: 'Pessoal', icon: 'home-outline', color: '#D4975A', favoriteOrder: 2, isSystem: true },
  { id: 'exercise', label: 'Exercício', icon: 'barbell-outline', color: '#769379', favoriteOrder: 3, isSystem: true },
];
const SYSTEM_CATEGORY_IDS = new Set(DEFAULT_CATEGORIES.map(category => category.id));
let runtimeCategories = DEFAULT_CATEGORIES;
export const setRuntimeCategories = categories => { runtimeCategories = normalizeCategories(categories); };
const LEGACY_CATEGORIES = {
  shopping: { id: 'shopping', label: 'Compras', icon: 'cart-outline', color: '#9580A1', archived: false },
};
export const CATEGORY_COLORS = ['#C86D51', '#769379', '#6B8296', '#D6A536', '#9580A1', '#D0816C', '#8C857B'];
export const CATEGORY_ICONS = [
  'home-outline', 'briefcase-outline', 'barbell-outline', 'book-outline', 'heart-outline', 'leaf-outline',
  'cafe-outline', 'musical-notes-outline', 'laptop-outline', 'code-slash-outline', 'layers-outline', 'star-outline',
  'bicycle-outline', 'airplane-outline', 'school-outline', 'paw-outline', 'restaurant-outline', 'people-outline',
  'cash-outline', 'construct-outline', 'game-controller-outline', 'camera-outline', 'medkit-outline', 'gift-outline',
];
const normalizeHex = color => /^#[0-9a-f]{6}$/i.test(color ?? '') ? color.toUpperCase() : CATEGORY_COLORS[0];
export const createDefaultCategories = (now = new Date().toISOString()) => DEFAULT_CATEGORIES.map(category => ({
  ...category, archived: false, createdAt: now, updatedAt: now,
}));
export const normalizeCategory = category => ({
  id: String(category.id), label: String(category.label ?? '').trim(),
  icon: CATEGORY_ICONS.includes(category.icon) || category.icon === 'archive-outline' ? category.icon : 'folder-outline',
  color: normalizeHex(category.color), archived: Boolean(category.archived),
  isSystem: typeof category.isSystem === 'boolean' ? category.isSystem : SYSTEM_CATEGORY_IDS.has(String(category.id)),
  favoriteOrder: Number.isInteger(category.favoriteOrder) && category.favoriteOrder >= 0 ? category.favoriteOrder : null,
  createdAt: category.createdAt ?? new Date().toISOString(), updatedAt: category.updatedAt ?? new Date().toISOString(),
});
export const normalizeCategories = categories => {
  const seen = new Set();
  return (Array.isArray(categories) ? categories : []).map(normalizeCategory).filter(category => {
    if (!category.id || !category.label || seen.has(category.id)) return false;
    seen.add(category.id); return true;
  });
};
export const getFavoriteCategories = categories => normalizeCategories(categories)
  .filter(category => !category.archived && category.favoriteOrder !== null)
  .sort((a, b) => a.favoriteOrder - b.favoriteOrder).slice(0, MAX_FAVORITE_CATEGORIES);
export const getFavoriteCategoryOptions = (categories, colors = lightColors) =>
  getFavoriteCategories(categories).map(category => categoryAppearance(category, colors));
export const getActiveCategoryOptions = categories => {
  const normalized = normalizeCategories(categories);
  const favorites = getFavoriteCategories(normalized);
  const favoriteIds = new Set(favorites.map(category => category.id));
  return [...favorites, ...normalized.filter(category => !category.archived && !favoriteIds.has(category.id))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt'))];
};
export const categoryAppearance = (category, colors = lightColors) => {
  const themed = colors.categories?.[category.id];
  return { ...category, color: themed?.color ?? category.color ?? colors.categories.inbox.color,
    surface: themed?.surface ?? `${category.color ?? colors.categories.inbox.color}${colors.background === '#141412' ? '24' : '14'}` };
};
export const getCategoryOptions = (colors = lightColors, categories = runtimeCategories) =>
  getActiveCategoryOptions(categories).map(category => categoryAppearance(category, colors));
export const getCategory = (categoryId, colors = lightColors, categories = runtimeCategories) => {
  const category = normalizeCategories(categories).find(item => item.id === categoryId) ?? LEGACY_CATEGORIES[categoryId]
    ?? normalizeCategories(categories).find(item => item.id === 'inbox') ?? DEFAULT_CATEGORIES[0];
  return categoryAppearance(category, colors);
};
export const canArchiveCategory = categoryId => categoryId !== 'inbox';
