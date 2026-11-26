import { runSyncRequest, syncDataClient } from '../lib/supabase';
import { normalizeCategory, normalizeCategories } from '../config/categories';
const fromDatabase = row => normalizeCategory({ id: row.id, label: row.name, icon: row.icon, color: row.color,
  archived: row.archived, favoriteOrder: row.favorite_order, isSystem: row.is_system,
  createdAt: row.created_at, updatedAt: row.updated_at });
const toDatabase = (category, userId) => ({ id: category.id, user_id: userId, name: category.label, icon: category.icon,
  color: category.color, archived: category.archived, favorite_order: category.favoriteOrder, is_system: category.isSystem,
  created_at: category.createdAt, updated_at: category.updatedAt });
export const loadRemoteCategories = async (userId, signal) => {
  const { data, error } = await runSyncRequest(userId, signal, () => syncDataClient.from('categories')
    .select('*').eq('user_id', userId).order('created_at', { ascending: true }));
  if (error) throw error;
  return normalizeCategories(data.map(fromDatabase));
};
export const upsertRemoteCategories = async (userId, categories, signal) => {
  const canonical = normalizeCategories(categories);
  if (canonical.length === 0) return canonical;
  const { error } = await runSyncRequest(userId, signal, () => syncDataClient.from('categories')
    .upsert(canonical.map(category => toDatabase(category, userId)), { onConflict: 'user_id,id' }));
  if (error) throw error;
  return canonical;
};
