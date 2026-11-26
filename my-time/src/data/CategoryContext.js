import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createDefaultCategories, getCategory, getFavoriteCategoryOptions, setRuntimeCategories } from '../config/categories';
import { loadCategories, subscribeCategories } from './categoryRepository';
import { useTheme } from '../theme/ThemeContext';
const CategoryContext = createContext(null);
export function CategoryProvider({ children }) {
  const { colors } = useTheme();
  const [categories, setCategories] = useState(createDefaultCategories);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeCategories(value => { if (active) { setRuntimeCategories(value); setCategories(value); } });
    loadCategories().then(value => { if (active) { setRuntimeCategories(value); setCategories(value); } })
      .catch(() => { if (active) setError('Não foi possível carregar as categorias.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; unsubscribe(); };
  }, []);
  const value = useMemo(() => ({ categories, loading, error,
    favoriteCategories: getFavoriteCategoryOptions(categories, colors),
    resolveCategory: id => getCategory(id, colors, categories) }), [categories, colors, error, loading]);
  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}
export const useCategories = () => {
  const value = useContext(CategoryContext);
  if (!value) throw new Error('useCategories deve ser utilizado dentro de CategoryProvider.');
  return value;
};
