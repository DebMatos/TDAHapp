import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const clean = source => source.replace(/^import .*;\s*$/gm, '').replaceAll('export const ', 'const ');
const config = new Function('lightColors', `${clean(read('config/categories.js'))}; return { normalizeCategory, normalizeCategories };`)(
  { background: '#fff', categories: { inbox: { color: '#000', surface: '#fff' } } },
);

test('repositório remoto envia categorias num único upsert em lote', async () => {
  const requests = [];
  const syncDataClient = { from: table => ({
    upsert: (rows, options) => {
      requests.push({ table, rows, options });
      return { error: null };
    },
  }) };
  const runSyncRequest = async (_userId, _signal, buildQuery) => buildQuery();
  const source = clean(read('repositories/supabaseCategoryRepository.js'));
  const api = new Function('runSyncRequest', 'syncDataClient', 'normalizeCategory', 'normalizeCategories',
    `${source}; return { upsertRemoteCategories };`)(runSyncRequest, syncDataClient, config.normalizeCategory, config.normalizeCategories);

  await api.upsertRemoteCategories('user-1', [
    { id: 'work', label: 'Trabalho', icon: 'briefcase-outline', color: '#C86D51', isSystem: true },
    { id: 'category-a', label: 'Projeto', icon: 'layers-outline', color: '#769379', isSystem: false },
  ]);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].table, 'categories');
  assert.deepEqual(requests[0].rows.map(row => row.id), ['work', 'category-a']);
  assert.deepEqual(requests[0].options, { onConflict: 'user_id,id' });
});

test('sincronização consolida alterações e não reinicia para estado de rede repetido', async () => {
  const now = '2026-11-26T00:00:00.000Z';
  const categories = [
    config.normalizeCategory({ id: 'work', label: 'Trabalho final', icon: 'briefcase-outline', color: '#C86D51', isSystem: true, updatedAt: now }),
    config.normalizeCategory({ id: 'category-a', label: 'Projeto', icon: 'layers-outline', color: '#769379', isSystem: false, updatedAt: now }),
  ];
  let state = {
    categories,
    pendingOps: [
      { id: 'op-1', category: { ...categories[0], label: 'Trabalho antigo' } },
      { id: 'op-2', category: categories[0] },
      { id: 'op-3', category: categories[1] },
    ],
    isNew: false,
  };
  const batches = [];
  const loadCategoryState = async () => state;
  const saveCategoryState = async (_userId, next) => { state = next; return state; };
  const upsertRemoteCategories = async (_userId, values) => { batches.push(values); };
  const loadRemoteCategories = async () => categories;
  const source = clean(read('data/categoryRepository.js'));
  const api = new Function('normalizeCategory', 'normalizeCategories', 'loadCategoryState', 'saveCategoryState',
    'loadRemoteCategories', 'upsertRemoteCategories', 'console',
    `${source}; return { setCategoryRepositoryUser, setCategorySyncState, syncCategories };`)(
      config.normalizeCategory, config.normalizeCategories, loadCategoryState, saveCategoryState,
      loadRemoteCategories, upsertRemoteCategories, { warn() {} },
    );

  api.setCategoryRepositoryUser('user-1');
  api.setCategorySyncState({ isOnline: true });
  assert.equal(batches.length, 0);
  api.setCategorySyncState({ isSessionReady: true });
  await api.syncCategories();
  api.setCategorySyncState({ isOnline: true, isSessionReady: true });

  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].map(category => [category.id, category.label]), [
    ['work', 'Trabalho final'],
    ['category-a', 'Projeto'],
  ]);
  assert.equal(state.pendingOps.length, 0);
});
