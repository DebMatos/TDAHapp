import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDefaultCategories, normalizeCategories } from '../config/categories';
const STORAGE_PREFIX = '@my_time_categories_local_v1:';
const storageKey = userId => {
  if (typeof userId !== 'string' || !userId) throw new Error('É necessária uma conta para aceder às categorias locais.');
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`;
};
export const loadCategoryState = async userId => {
  const stored = await AsyncStorage.getItem(storageKey(userId));
  if (stored === null) return { categories: createDefaultCategories(), pendingOps: [], isNew: true };
  const parsed = JSON.parse(stored);
  if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.pendingOps)) throw new Error('Dados locais de categorias inválidos.');
  return { categories: normalizeCategories(parsed.categories), pendingOps: parsed.pendingOps, isNew: false };
};
export const saveCategoryState = async (userId, state) => {
  const normalized = { categories: normalizeCategories(state.categories), pendingOps: state.pendingOps };
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(normalized));
  return normalized;
};
export const CATEGORY_STORAGE_INFO = { schemaVersion: 1, keyPrefix: STORAGE_PREFIX };
