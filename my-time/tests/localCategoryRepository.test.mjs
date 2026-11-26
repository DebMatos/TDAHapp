import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const configSource = fs.readFileSync(new URL('../src/config/categories.js', import.meta.url), 'utf8');
const repoSource = fs.readFileSync(new URL('../src/repositories/localCategoryRepository.js', import.meta.url), 'utf8');
const stored = new Map();
const AsyncStorage = { getItem: async key => stored.get(key) ?? null, setItem: async (key, value) => stored.set(key, value) };
const context = vm.createContext({ AsyncStorage, Date, Error, JSON, Math, Set, String, Array, Number, encodeURIComponent });
vm.runInContext(configSource.replace(/^import .*;$/m, 'const lightColors = { background: "#fff", categories: { inbox: { color: "#000", surface: "#fff" } } };')
  .replaceAll('export const ', 'const ') + '\nglobalThis.createDefaultCategories=createDefaultCategories; globalThis.normalizeCategories=normalizeCategories;', context);
vm.runInContext(repoSource.replace(/^import .*;\s*$/gm, '').replaceAll('export const ', 'const ') +
  '\nglobalThis.api={loadCategoryState,saveCategoryState,CATEGORY_STORAGE_INFO};', context);

test('categorias locais são isoladas por conta e persistem arquivo', async () => {
  const categories = context.createDefaultCategories(); categories[1].archived = true; categories[1].favoriteOrder = null;
  await context.api.saveCategoryState('a', { categories, pendingOps: [{ id: 'op-1' }] });
  assert.equal((await context.api.loadCategoryState('a')).categories[1].archived, true);
  assert.equal((await context.api.loadCategoryState('b')).categories[1].archived, false);
});

test('recusa armazenamento sem conta', async () => {
  await assert.rejects(context.api.loadCategoryState(null), /conta/);
});
