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
  const React = { createElement: (type, props, ...children) => typeof type === 'function' ? type(props) : ({ type, props: props ?? {}, children }) };
  const useState = initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], value => { state[index] = value; }];
  };
  const toggleSource = read('components/ThemeToggle.js').replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '').replace('export const', 'const');
  const toggleCode = babel.transformSync(toggleSource, { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
  const useRef = value => useState({ current: value })[0];
  const CustomThemeToggle = new Function('React', 'useState', 'useRef', 'useEffect', 'useTheme', 'Pressable', 'View', 'Text', 'StyleSheet', 'Animated', 'Feather', `${toggleCode};return CustomThemeToggle;`)(
    React, useState, useRef, () => {}, () => ({ colors, isDark: false, setThemeMode }), 'toggle', 'view', 'text', { create: x => x },
    { Value: class { interpolate() {} }, View: 'animated' }, 'icon');
  const component = new Function('React', 'useState', 'View', 'Text', 'TouchableOpacity', 'StyleSheet', 'DrawerContentScrollView', 'Ionicons', 'useTheme', 'supabase', 'SafeAreaView', 'TaskBanner', 'CustomThemeToggle', `${compiled};return DrawerNavContent;`)(
    React, useState, 'view', 'text', 'button', { create: x => x, hairlineWidth: 1 }, 'scroll', 'icon',
    () => ({ colors, themeMode: 'light', setThemeMode, isDark: false }), { auth: { signOut } }, 'safe', 'banner', CustomThemeToggle);
  const render = () => { cursor = 0; return flatten(component({})); };
  return {
    nodes: render,
    theme: () => render().find(node => node.props.accessibilityRole === 'switch'),
    logout: () => render().find(node => node.props.accessibilityRole === 'button'),
    notice: () => render().find(node => node.type === 'banner').props.notice,
  };
}

test('theme persistence rejection is handled and explains the applied session theme', async () => {
  let applied;
  const h = drawer({ setThemeMode: async mode => { applied = mode; throw Error('disk'); } });
  await h.theme().props.onPress();
  assert.equal(applied, 'dark');
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

test('pending theme write disables the toggle and prevents duplicate writes', async () => {
  let release, calls = 0;
  const h = drawer({ setThemeMode: () => { calls++; return new Promise(resolve => { release = resolve; }); } });
  const changing = h.theme().props.onPress();
  assert.equal(h.theme().props.disabled, true);
  await h.theme().props.onPress();
  assert.equal(calls, 1);
  release();
  await changing;
  assert.equal(h.theme().props.disabled, false);
  assert.equal(h.theme().props.accessibilityState.checked, false);
});

function formHandler(file, name, context) {
  const source = read(`components/modals/${file}.js`);
  const tree = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  let expression;
  const scan = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id?.name === name) expression = source.slice(node.init.start, node.init.end);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(scan);
      else if (value && typeof value === 'object') scan(value);
    }
  };
  scan(tree);
  assert.ok(expression, name);
  return new Function('context', `with (context) { return ${expression}; }`)(context);
}

test('Quick Create handles rejected saves and keeps draft; expansion blocked while saving', async () => {
  const context = { title: ' Draft ', description: ' Notes ', duration: 30, categoryId: 'work', priority: 'high', isSaving: false, isDateValid: true, transitioned: { current: false },
    dateValue: '26/10/2026', dateInputToStorageDate: () => '2026-10-26', initialMinutes: 540,
    formatTimeFromMinutes: () => '09:00', TIMELINE_START_MINUTES: 420,
    get isBusy() { return this.isSaving; },
    setIsSaving: value => { context.isSaving = value; }, onSave: async () => { throw Error('storage'); } };
  await formHandler('CreateTaskModal', 'handleSave', context)();
  assert.equal(context.isSaving, false);
  assert.equal(context.title, ' Draft ');
  context.isSaving = true;
  context.onExpand = () => assert.fail('should not leave saving form');
  formHandler('CreateTaskModal', 'handleExpand', context)();
});

test('Details cannot save during delete and cannot delete during save', async () => {
  const context = { isBusy: true, canSave: true, onSave: () => assert.fail('save'), onDelete: () => assert.fail('delete') };
  await formHandler('TaskDetailsModal', 'handleSave', context)();
  await formHandler('TaskDetailsModal', 'handleDelete', context)();
});

test('Details deletion releases busy state on failure and leaves closing to parent', async () => {
  const changes = [];
  const context = { isBusy: false, onDelete: async () => { throw Error('storage'); }, setIsDeleting: value => changes.push(value) };
  await formHandler('TaskDetailsModal', 'handleDelete', context)();
  assert.deepEqual(changes, [true, false]);
});

test('Details deletion invokes parent exactly once and releases busy state on success', async () => {
  let count = 0;
  const changes = [];
  const context = { isBusy: false, onDelete: async () => { count++; }, setIsDeleting: value => changes.push(value) };
  await formHandler('TaskDetailsModal', 'handleDelete', context)();
  assert.equal(count, 1);
  assert.deepEqual(changes, [true, false]);
});

test('all form buttons expose disabled state and all fields stop editing during writes', () => {
  for (const file of ['CreateTaskModal', 'TaskDetailsModal']) {
    const source = read(`components/modals/${file}.js`);
    const tree = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
    const scan = node => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'JSXOpeningElement') {
        const has = name => node.attributes.some(attribute => attribute.name?.name === name);
        if (node.name.name === 'TouchableOpacity') {
          assert.ok(has('disabled'), file);
          assert.ok(has('accessibilityRole'), file);
          assert.ok(has('accessibilityState'), file);
        }
        if (node.name.name === 'TextInput') {
          assert.ok(has('editable'), file);
          assert.ok(has('accessibilityLabel'), file);
        }
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(scan);
        else if (value && typeof value === 'object') scan(value);
      }
    };
    scan(tree);
  }
});
