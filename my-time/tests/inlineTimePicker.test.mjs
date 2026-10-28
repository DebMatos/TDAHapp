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

function harness(kind, overrides = {}, colors = themes.darkColors) {
  const slots = [], effects = [], scrolls = [], changes = [], timers = [];
  let cursor = 0;
  const useState = initial => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  };
  const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
  const context = {
    React, useState, useRef: value => useState({ current: value })[0], useMemo: fn => fn(), useEffect: fn => effects.push(fn),
    useTheme: () => ({ colors }), ...time, createTaskSheetStyles: () => ({ pickerPanel: {} }),
    Animated: { Value: class { constructor(value) { this.initial = value; } }, View: 'animated',
      timing: () => ({ start() {}, stop() {} }) }, Keyboard: { dismiss() {} },
    StyleSheet: { create: x => x }, ScrollView: 'scroll', Text: 'text', TextInput: 'input',
    TouchableOpacity: 'button', View: 'view', Ionicons: 'icon',
    setTimeout: fn => { const timer = { fn, cancelled: false }; timers.push(timer); return timer; },
    clearTimeout: timer => { if (timer) timer.cancelled = true; },
  };
  const components = new Function(...Object.keys(context), `${compiled}; return { InlineTimePicker, TimeWheel };`)(...Object.values(context));
  const props = { value: kind === 'TimeWheel' ? 0 : '09:05', range: 24, label: 'Hora de início', styles: {},
    onEdit() {}, onClose() {}, onChange: value => { changes.push(value); props.value = value; }, ...overrides };
  const render = () => { cursor = 0; return nodes(components[kind](props)); };
  const find = label => {
    const node = render().find(n => n.props.accessibilityLabel === label);
    assert.ok(node, `Missing ${label}`); return node;
  };
  const initial = render();
  if (kind === 'TimeWheel') initial.find(n => n.type === 'scroll').props.ref.current = { scrollTo: value => scrolls.push(value) };
  const runEffects = () => { effects.length = 0; render(); effects.splice(0).forEach(fn => fn()); };
  return { render, find, props, changes, scrolls, runEffects, timers };
}

for (const [theme, colors] of [['light', themes.lightColors], ['dark', themes.darkColors]]) {
  test(`${theme}: four digits format and confirm one complete time, then synchronize both wheels`, () => {
    const h = harness('InlineTimePicker', {}, colors);
    h.find('Editar hora completa').props.onPress();
    h.find('Hora completa, HH:MM').props.onChangeText('2321');
    assert.equal(h.find('Hora completa, HH:MM').props.value, '23:21');
    assert.deepEqual(h.changes, []);
    h.find('Aplicar hora').props.onPress();
    assert.deepEqual(h.changes, ['23:21']);
    const wheels = h.render().filter(n => typeof n.type === 'function');
    assert.deepEqual(wheels.map(n => [n.props.range, n.props.value]), [[24, 23], [60, 21]]);
    wheels[1].props.onChange(0);
    assert.equal(h.changes.at(-1), '23:00');
    h.find('Editar hora completa').props.onPress();
    assert.equal(h.find('Hora completa, HH:MM').props.value, '23:00');
  });
}

test('incomplete and invalid typing never changes the task; leading zeros survive', () => {
  const h = harness('InlineTimePicker');
  h.find('Editar hora completa').props.onPress();
  for (const value of ['', '2', '23', '231', '2400', '2360', '9999']) {
    h.find('Hora completa, HH:MM').props.onChangeText(value);
    assert.equal(h.find('Aplicar hora').props.disabled, true);
    h.find('Hora completa, HH:MM').props.onSubmitEditing();
    assert.deepEqual(h.changes, []);
  }
  h.find('Hora completa, HH:MM').props.onChangeText('0005');
  h.find('Hora completa, HH:MM').props.onSubmitEditing();
  assert.deepEqual(h.changes, ['00:05']);
});

for (const range of [24, 60]) {
  test(`wheel ${range}: circular forward/reverse, independent scroll, snapping and recentering`, () => {
    const h = harness('TimeWheel', { range, value: range - 1 });
    const scroll = () => h.render().find(n => n.type === 'scroll').props;
    h.runEffects();
    assert.equal(scroll().snapToInterval, 44);
    scroll().onScrollBeginDrag();
    scroll().onScroll({ nativeEvent: { contentOffset: { y: 4 * range * 44 } } });
    scroll().onScrollEndDrag();
    scroll().onMomentumScrollBegin();
    assert.equal(h.timers.at(-1).cancelled, true);
    scroll().onMomentumScrollEnd();
    assert.deepEqual(h.changes, [0]);
    assert.equal(h.scrolls.at(-1).y, 3 * range * 44);
    scroll().onScrollBeginDrag();
    scroll().onScroll({ nativeEvent: { contentOffset: { y: (3 * range - 1) * 44 } } });
    scroll().onScrollEndDrag(); h.timers.at(-1).fn();
    assert.equal(h.changes.at(-1), range - 1);
    h.props.value = 5; h.runEffects();
    assert.equal(h.scrolls.at(-1).y, (3 * range + 5) * 44);
    scroll().onScrollBeginDrag();
    scroll().onScroll({ nativeEvent: { contentOffset: { y: (3 * range + 5.7) * 44 } } });
    scroll().onMomentumScrollEnd();
    assert.equal(h.changes.at(-1), 6);
  });
}

test('disabled picker blocks confirmation and both pickers enter from above', () => {
  const h = harness('InlineTimePicker');
  h.find('Editar hora completa').props.onPress();
  h.find('Hora completa, HH:MM').props.onChangeText('1215');
  h.props.disabled = true;
  h.find('Aplicar hora').props.onPress();
  assert.deepEqual(h.changes, []);
  assert.equal(h.render()[0].props.style[1].transform[0].translateY.initial, -48);
  assert.ok(read('components/InlineDatePicker.js').includes('new Animated.Value(-48)'));
});

test('a delayed wheel settle cannot change the draft after saving disables the picker', () => {
  const h = harness('TimeWheel', { range: 24, value: 9 });
  const scroll = () => h.render().find(n => n.type === 'scroll').props;
  scroll().onScrollBeginDrag();
  scroll().onScroll({ nativeEvent: { contentOffset: { y: (3 * 24 + 14) * 44 } } });
  scroll().onScrollEndDrag();
  h.props.disabled = true; h.render();
  h.timers.at(-1).fn();
  assert.deepEqual(h.changes, []);
  assert.equal(h.scrolls.at(-1).y, (3 * 24 + 9) * 44);
});
