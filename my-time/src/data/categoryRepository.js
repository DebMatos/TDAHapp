import { normalizeCategory, normalizeCategories } from '../config/categories';
import { loadCategoryState, saveCategoryState } from '../repositories/localCategoryRepository';
import { loadRemoteCategories, upsertRemoteCategories } from '../repositories/supabaseCategoryRepository';
let userId = null, revision = 0, online = false, sessionReady = false;
let writeQueue = Promise.resolve(), syncPromise = null;
const listeners = new Set();
const owner = () => {
  if (!userId) throw new Error('É necessária uma conta para aceder às categorias.');
  return { userId, revision };
};
const assertOwner = value => {
  if (value.userId !== userId || value.revision !== revision) throw Object.assign(new Error('A conta foi alterada.'), { code: 'LOCAL_USER_CHANGED' });
};
const enqueue = operation => {
  const result = writeQueue.then(operation); writeQueue = result.catch(() => {}); return result;
};
const notify = categories => listeners.forEach(listener => listener(categories));
const operation = category => ({ id: `category-op-${Date.now()}-${Math.random().toString(36).slice(2)}`, category });
export const setCategoryRepositoryUser = next => {
  const value = typeof next === 'string' && next ? next : null;
  if (value !== userId) { userId = value; revision += 1; }
};
export const setCategorySyncState = ({ isOnline, isSessionReady }) => {
  const wasReady = online && sessionReady;
  if (typeof isOnline === 'boolean') online = isOnline;
  if (typeof isSessionReady === 'boolean') sessionReady = isSessionReady;
  if (!wasReady && online && sessionReady) void syncCategories();
};
export const subscribeCategories = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const loadCategories = async () => {
  const current = owner(); await writeQueue;
  const state = await loadCategoryState(current.userId); assertOwner(current); notify(state.categories);
  if (online && sessionReady) void syncCategories();
  return state.categories;
};
const commit = build => {
  const current = owner();
  return enqueue(async () => {
    const state = await loadCategoryState(current.userId); assertOwner(current);
    const saved = await saveCategoryState(current.userId, build(state)); assertOwner(current); notify(saved.categories); return saved.categories;
  }).then(categories => { if (online && sessionReady) void syncCategories(); return categories; });
};
export const createCategory = values => {
  const now = new Date().toISOString();
  const category = normalizeCategory({ ...values, id: `category-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    archived: false, favoriteOrder: null, isSystem: false, createdAt: now, updatedAt: now });
  return commit(state => ({ ...state, categories: [...state.categories, category], pendingOps: [...state.pendingOps, operation(category)] }));
};
export const updateCategory = (categoryId, changes) => commit(state => {
  const existing = state.categories.find(item => item.id === categoryId);
  if (!existing) throw Object.assign(new Error('Categoria não encontrada.'), { code: 'CATEGORY_NOT_FOUND' });
  const category = normalizeCategory({ ...existing, ...changes, id: existing.id, updatedAt: new Date().toISOString() });
  return { ...state, categories: state.categories.map(item => item.id === categoryId ? category : item), pendingOps: [...state.pendingOps, operation(category)] };
});
export const saveCategoryOrder = orderedIds => commit(state => {
  const order = new Map(orderedIds.map((id, index) => [id, index])), now = new Date().toISOString();
  const changed = state.categories.filter(item => !item.archived && (order.has(item.id) || item.favoriteOrder !== null)
    && item.favoriteOrder !== (order.get(item.id) ?? null))
    .map(item => normalizeCategory({ ...item, favoriteOrder: order.get(item.id) ?? null, updatedAt: now }));
  const byId = new Map(changed.map(item => [item.id, item]));
  return { ...state, categories: state.categories.map(item => byId.get(item.id) ?? item), pendingOps: [...state.pendingOps, ...changed.map(operation)] };
});
export const syncCategories = () => {
  if (!online || !sessionReady || !userId) return Promise.resolve();
  if (syncPromise) return syncPromise;
  const current = owner();
  syncPromise = enqueue(async () => {
    let state = await loadCategoryState(current.userId); assertOwner(current);
    if (state.pendingOps.length > 0) {
      const pendingIds = new Set(state.pendingOps.map(item => item.id));
      const latestByCategory = new Map(state.pendingOps.map(item => [item.category.id, item.category]));
      await upsertRemoteCategories(current.userId, [...latestByCategory.values()]); assertOwner(current);
      state = await saveCategoryState(current.userId, {
        ...state,
        pendingOps: state.pendingOps.filter(item => !pendingIds.has(item.id)),
      });
    }
    const remote = await loadRemoteCategories(current.userId); assertOwner(current);
    if (remote.length === 0) {
      await upsertRemoteCategories(current.userId, state.categories); assertOwner(current);
      return state;
    }
    const pendingIds = new Set(state.pendingOps.map(item => item.category.id));
    const merged = new Map(state.categories.map(category => [category.id, category]));
    remote.forEach(category => {
      const local = merged.get(category.id);
      if (!pendingIds.has(category.id) && (state.isNew || !local || category.updatedAt > local.updatedAt)) merged.set(category.id, category);
    });
    const saved = await saveCategoryState(current.userId, { ...state, categories: normalizeCategories([...merged.values()]) });
    notify(saved.categories); return saved;
  }).catch(error => { console.warn('[Categories] Sincronização adiada:', error); }).finally(() => { syncPromise = null; });
  return syncPromise;
};
