import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const parser = require('@babel/parser');
const babel = require('@babel/core');
const root = new URL('../src/', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const details = read('components/modals/TaskDetailsModal.js');
const ast = parser.parse(details, { sourceType: 'module', plugins: ['jsx'] });
let currentExpression, initialExpression;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id?.name === 'currentSnapshot') {
    currentExpression = details.slice(node.init.arguments[0].body.start, node.init.arguments[0].body.end);
  }
  if (node.type === 'CallExpression' && node.callee?.name === 'setSavedSnapshot' && node.arguments[0]?.type === 'CallExpression') {
    initialExpression = details.slice(node.arguments[0].start, node.arguments[0].end);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
const currentNames = ['title', 'dateValue', 'startTime', 'endTime', 'duration', 'categoryId', 'priority', 'status', 'repeat', 'notes'];
const initialNames = ['initialTitle', 'initialDate', 'initialStart', 'initialEnd', 'initialDuration', 'initialCategory', 'initialPriority', 'initialStatus', 'initialRepeat', 'initialNotes'];
const values = [' Example ', '26/10/2026', '09:00', '09:30', 30, 'work', 'high', 'pending', 'never', ' Notes '];
const snapshot = new Function(...currentNames, `return ${currentExpression}`);
const initialSnapshot = new Function(...initialNames, `return ${initialExpression}`);

test('details opened without edits has the same snapshot as its initial values', () => {
  assert.equal(snapshot(...values), initialSnapshot(...values));
});

test('every editable field changes the snapshot; theme is independent', () => {
  for (let i = 0; i < values.length; i += 1) {
    const changed = [...values];
    changed[i] = i === 4 ? 60 : `changed-${values[i]}`;
    assert.notEqual(snapshot(...changed), initialSnapshot(...values), currentNames[i]);
  }
  assert.equal(currentNames.includes('colors'), false);
});

const paletteSource = read('theme/colors.js').replace(/export const /g, 'const ').replace(/export default lightColors;/, '');
const colors = new Function(`${paletteSource};return lightColors;`)();
const source = read('components/DrawerNavContent.js').replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '').replace('export function', 'function');
const compiled = babel.transformSync(source, { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
const flatten = tree => [tree, ...tree.children.flat(Infinity).filter(value => value && typeof value === 'object').flatMap(flatten)];
function drawer({ setThemeMode = async () => {}, signOut = async () => ({ error: null }) } = {}) {
  const state = [];
  let cursor = 0;
  const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
  const useState = initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], value => { state[index] = value; }];
  };
  const component = new Function('React', 'useState', 'View', 'Text', 'TouchableOpacity', 'StyleSheet', 'DrawerContentScrollView', 'Ionicons', 'useTheme', 'supabase', 'SafeAreaView', 'TaskBanner', `${compiled};return DrawerNavContent;`)(
    React, useState, 'view', 'text', 'button', { create: x => x, hairlineWidth: 1 }, 'scroll', 'icon',
    () => ({ colors, themeMode: 'light', setThemeMode, isDark: false }), { auth: { signOut } }, 'safe', 'banner');
  const render = () => { cursor = 0; return flatten(component({})); };
  return {
    nodes: render,
    theme: () => render().find(node => node.props.accessibilityRole === 'radio'),
    logout: () => render().find(node => node.props.accessibilityRole === 'button'),
    notice: () => render().find(node => node.type === 'banner').props.notice,
  };
}

test('theme persistence rejection is handled and explains the applied session theme', async () => {
  let applied;
  const h = drawer({ setThemeMode: async mode => { applied = mode; throw Error('disk'); } });
  await h.theme().props.onPress();
  assert.equal(applied, 'system');
  assert.match(h.notice().message, /aplicado nesta sessão/);
  assert.equal(h.theme().props.disabled, false);
});

test('successful theme change is silent; controls remain unchanged', async () => {
  const h = drawer();
  await h.theme().props.onPress();
  assert.equal(h.notice(), null);
});

for (const thrown of [false, true]) {
  test(`logout ${thrown ? 'thrown failure' : 'returned Supabase error'} produces a dismissible safe banner`, async () => {
    const h = drawer({ signOut: async () => { if (thrown) throw Error('PRIVATE'); return { error: Error('PRIVATE') }; } });
    await h.logout().props.onPress();
    assert.match(h.notice().title, /Não foi possível terminar sessão/);
    assert.equal(JSON.stringify(h.notice()).includes('PRIVATE'), false);
    h.nodes().find(node => node.type === 'banner').props.onDismiss();
    assert.equal(h.notice(), null);
  });
}

test('successful logout is silent and unlocks controls', async () => {
  const h = drawer();
  await h.logout().props.onPress();
  assert.equal(h.notice(), null);
  assert.equal(h.logout().props.disabled, false);
});

test('pending menu operation disables actions and prevents a second operation after render', async () => {
  let release, signOutCalls = 0;
  const h = drawer({ setThemeMode: () => new Promise(resolve => { release = resolve; }), signOut: async () => { signOutCalls++; return { error: null }; } });
  const changing = h.theme().props.onPress();
  assert.equal(h.theme().props.disabled, true);
  assert.equal(h.logout().props.disabled, true);
  await h.logout().props.onPress();
  assert.equal(signOutCalls, 0);
  release();
  await changing;
  assert.equal(h.theme().props.disabled, false);
});
