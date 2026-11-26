import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/config/categories.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/m, 'const lightColors = { background: "#fff", categories: { inbox: { color: "#000", surface: "#fff" } } };');
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('as predefinidas não incluem Compras e mantêm quatro favoritas', () => {
  const categories = api.createDefaultCategories('2026-11-25T00:00:00.000Z');
  assert.deepEqual(categories.map(item => item.id), ['inbox', 'work', 'personal', 'exercise']);
  assert.equal(api.getFavoriteCategories(categories).length, 4);
});

test('favoritas respeitam ordem, arquivo e limite de cinco', () => {
  const categories = Array.from({ length: 7 }, (_, index) => ({ id: `c${index}`, label: `C${index}`, icon: 'star-outline', color: '#769379', archived: index === 1, favoriteOrder: 6 - index }));
  assert.deepEqual(api.getFavoriteCategories(categories).map(item => item.id), ['c6', 'c5', 'c4', 'c3', 'c2']);
});

test('opções dos formulários contêm apenas favoritas e respeitam a ordem definida', () => {
  const categories = api.createDefaultCategories();
  categories[0].favoriteOrder = 2;
  categories[1].favoriteOrder = null;
  categories[2].favoriteOrder = 0;
  categories[3].favoriteOrder = 1;
  assert.deepEqual(api.getFavoriteCategoryOptions(categories).map(item => item.id), ['personal', 'exercise', 'inbox']);
});

test('categorias predefinidas são de sistema e categorias personalizadas pertencem ao utilizador', () => {
  assert.ok(api.createDefaultCategories().every(category => category.isSystem));
  assert.equal(api.normalizeCategory({ id: 'category-custom', label: 'Projeto', icon: 'layers-outline', color: '#769379' }).isSystem, false);
});

test('Caixa de entrada é a única categoria não arquivável', () => {
  assert.equal(api.canArchiveCategory('inbox'), false);
  assert.equal(api.canArchiveCategory('work'), true);
  assert.equal(api.canArchiveCategory('category-custom'), true);
});

test('Compras antigas continuam resolúveis sem voltar às opções predefinidas', () => {
  const category = api.getCategory('shopping', undefined, api.createDefaultCategories());
  assert.equal(category.label, 'Compras');
});
