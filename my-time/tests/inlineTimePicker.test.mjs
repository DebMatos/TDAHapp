import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const read = path => fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const fromSource = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const themes = await fromSource(read('theme/colors.js'));
const time = await fromSource(read('utils/time.js').replace(/import[^;]+;/, 'const DAY_MINUTES=1440,SNAP_MINUTES=5;'));
const source = read('components/InlineTimePicker.js');
const clean = source.replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '').replace('export default function', 'function');
const compiled = babel.transformSync(clean, { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...tree.children.flat(Infinity).flatMap(nodes)];

function harness(overrides = {}, colors = themes.darkColors) {
  const slots = [], effects = [], changes = [], changeCalls = [];
  let cursor = 0, keyboardDismissals = 0;
  const useState = initial => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  };
  const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
  const context = {
    React, useState, useRef: value => useState({ current: value })[0], useMemo: fn => fn(), useEffect: fn => effects.push(fn),
    useTheme: () => ({ colors, isDark: colors === themes.darkColors }), ...time, createTaskSheetStyles: () => ({ pickerPanel: {} }),
    Animated: { Value: class { constructor(value) { this.initial = value; } }, View: 'animated', timing: () => ({ start() {}, stop() {} }) },
    Date: class { getHours() { return 14; } getMinutes() { return 7; } }, require: path => path,
    Keyboard: { dismiss() { keyboardDismissals++; } }, StyleSheet: { create: x => x },
    Image: 'image', Text: 'text', TextInput: 'input', TouchableOpacity: 'button', View: 'view',
  };
  const InlineTimePicker = new Function(...Object.keys(context), `${compiled}; return InlineTimePicker;`)(...Object.values(context));
  const props = { value: '09:05', onChange: (...args) => {
    changes.push(args[0]); changeCalls.push(args); props.value = args[0];
  }, ...overrides };
  const render = () => { cursor = 0; return nodes(InlineTimePicker(props)); };
  const find = label => {
    const node = render().find(n => n.props.accessibilityLabel === label);
    assert.ok(node, `Missing ${label}`);
    return node;
  };
  return { render, find, props, changes, changeCalls, dismissals: () => keyboardDismissals };
}

test('renders only the existing numeric inputs without scroll wheels', () => {
  const h = harness();
  assert.equal(h.render().filter(node => node.type === 'input').length, 2);
  assert.equal(h.render().some(node => node.type === 'scroll'), false);
  assert.equal(source.includes('TimeWheel'), false);
  assert.equal(source.includes('ScrollView'), false);
});

for (const [theme, colors] of [['light', themes.lightColors], ['dark', themes.darkColors]]) {
  test(`${theme}: numeric fields use themed surfaces and selection`, () => {
    const h = harness({}, colors);
    const hours = h.find('Editar horas');
    assert.equal(hours.props.style[0].backgroundColor, colors.surfaceSoft);
    assert.equal(hours.props.style[0].borderColor, colors.border);
    assert.equal(hours.props.style[1].backgroundColor, colors.selectionSoft);
    assert.equal(hours.props.selectionColor, 'transparent');
    const now = h.find('Usar hora atual');
    assert.equal(now.props.style[0].backgroundColor, colors.floatingButton.background);
    assert.equal(now.props.style[0].borderColor, theme === 'dark' ? colors.now : colors.floatingButton.border);
  });
}

test('Agora copies the device time, keeps the picker open and allows a manual adjustment', () => {
  const h = harness();
  h.find('Usar hora atual').props.onPress();
  assert.equal(h.find('Editar horas').props.value, '14');
  assert.equal(h.find('Editar minutos').props.value, '07');
  assert.deepEqual(h.changeCalls, [['14:07', { keepOpen: true }]]);
  assert.equal(h.dismissals(), 0);
  assert.deepEqual(h.find('Editar minutos').props.selection, { start: 0, end: 2 });
  h.find('Editar minutos').props.onChangeText('08');
  assert.deepEqual(h.changes, ['14:07', '14:08']);
  assert.equal(h.dismissals(), 1);
});

for (const [digits, expected] of [['241', '02:41'], ['77', '07:07'], ['99', '09:09'], ['086', '08:06'], ['0759', '07:59'], ['236', '23:06'], ['305', '03:05']]) {
  test(`pasted sequence ${digits} resolves to ${expected}`, () => {
    const h = harness();
    h.find('Editar horas').props.onChangeText(digits);
    assert.deepEqual(h.changes, [expected]);
  });
}

test('sequential entry, selection and confirmation preserve the numeric editing contract', () => {
  const h = harness();
  h.find('Editar horas').props.onChangeText('24');
  assert.equal(h.find('Editar horas').props.value, '02');
  assert.equal(h.find('Editar minutos').props.value, '4');
  h.find('Editar minutos').props.onChangeText('41');
  assert.deepEqual(h.changes, ['02:41']);
  assert.equal(h.dismissals(), 1);
  h.find('Editar horas').props.onPressOut();
  assert.deepEqual(h.find('Editar horas').props.selection, { start: 0, end: 2 });
});

test('backspace returns from empty minutes to the hour prefix without applying a partial value', () => {
  const h = harness();
  h.find('Editar horas').props.onChangeText('23');
  h.find('Editar minutos').props.onKeyPress({ nativeEvent: { key: 'Backspace' } });
  assert.equal(h.find('Editar horas').props.value, '2');
  assert.deepEqual(h.changes, []);
});

test('disabled inputs cannot apply a new time and use no entry animation', () => {
  const h = harness({ disabled: true });
  h.find('Editar horas').props.onChangeText('2321');
  h.find('Usar hora atual').props.onPress();
  assert.deepEqual(h.changes, []);
  assert.equal(source.includes('Animated'), false);
  assert.equal(h.find('Usar hora atual').props.accessibilityState.disabled, true);
});
