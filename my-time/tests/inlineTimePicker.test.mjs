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
  let cursor = 0, keyboardDismissals = 0;
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
      timing: () => ({ start() {}, stop() {} }) }, Keyboard: { dismiss() { keyboardDismissals++; } },
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
  return { render, find, props, changes, scrolls, runEffects, timers, dismissals: () => keyboardDismissals };
}

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
    assert.equal(h.scrolls.length, 0); // Already centered: no jump to another cycle.
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

test('only long press of the selected wheel number edits; release does not overwrite editing', () => {
  let edits = 0;
  const h = harness('TimeWheel', { value: 9, onEdit: () => edits++ });
  const selected = () => h.find('Hora de início: 09').props;
  selected().onPressIn(); selected().onPress();
  assert.equal(edits, 0);
  assert.deepEqual(h.changes, []);
  selected().onPressIn(); selected().onLongPress(); selected().onPress();
  assert.equal(edits, 1);
  assert.deepEqual(h.changes, []);
  const adjacent = h.find('Hora de início: 10').props;
  adjacent.onPressIn(); adjacent.onLongPress(); adjacent.onPress();
  assert.equal(edits, 1);
  assert.equal(h.changes.at(-1), 10);
});

test('choosing a neighbour animates to its nearest copy and preserves the initial native offset', () => {
  const h = harness('TimeWheel', { range: 24, value: 9 });
  const initial = h.render().find(n => n.type === 'scroll').props.contentOffset;
  h.find('Hora de início: 10').props.onPress();
  h.runEffects();
  assert.deepEqual(h.scrolls.at(-1), { y: (3 * 24 + 10) * 44, animated: true });
  assert.equal(h.render().find(n => n.type === 'scroll').props.contentOffset, initial);
  const count = h.scrolls.length;
  h.runEffects();
  assert.equal(h.scrolls.length, count);
});

test('only an outer cycle is recycled without animation', () => {
  const h = harness('TimeWheel', { range: 60, value: 10 });
  const scroll = () => h.render().find(n => n.type === 'scroll').props;
  scroll().onScrollBeginDrag();
  scroll().onScroll({ nativeEvent: { contentOffset: { y: 5 * 44 } } });
  scroll().onMomentumScrollEnd();
  assert.deepEqual(h.scrolls.at(-1), { y: (3 * 60 + 5) * 44, animated: false });
  assert.deepEqual(h.changes, [5]);
});

for (const [theme, colors] of [['light', themes.lightColors], ['dark', themes.darkColors]]) {
  test(`${theme}: two inputs occupy the original center columns and share a valid complete time`, () => {
    const h = harness('InlineTimePicker', {}, colors);
    h.render().find(n => typeof n.type === 'function').props.onEdit();
    const inputs = h.render().filter(n => n.type === 'input');
    assert.equal(inputs.length, 2);
    assert.equal(inputs[0].props.style.width, 96);
    const center = h.render().find(n => n.props.style?.position === 'absolute');
    assert.equal(center.props.style.top, 44);
    assert.equal(center.props.style.flexDirection, 'row');
    assert.equal(nodes(h.render()[0].children[0]).some(n => n.type === 'input'), false);
    h.find('Editar horas').props.onChangeText('23');
    assert.equal(h.find('Editar horas').props.value, '23');
    assert.equal(h.find('Editar minutos').props.value, '');
    assert.deepEqual(h.changes, []);
    h.find('Editar minutos').props.onChangeText('2');
    assert.deepEqual(h.changes, []);
    h.find('Editar minutos').props.onChangeText('21');
    assert.deepEqual(h.changes, ['23:21']);
    assert.equal(h.dismissals(), 1);
    assert.equal(h.render().some(n => n.type === 'input'), false);
    assert.deepEqual(h.render().filter(n => typeof n.type === 'function').map(n => n.props.value), [23, 21]);
  });
}

for (const [digits, expected] of [['241', '02:41'], ['77', '07:07'], ['99', '09:09'],
  ['086', '08:06'], ['0759', '07:59'], ['236', '23:06'], ['305', '03:05']]) {
  test(`pasted sequence ${digits} resolves to ${expected}`, () => {
    const h = harness('InlineTimePicker');
    h.render().find(n => typeof n.type === 'function').props.onEdit();
    h.find('Editar horas').props.onChangeText(digits);
    assert.deepEqual(h.changes, [expected]);
  });
}

test('sequential 2, 4, 1 transfers the rejected hour digit to minutes and applies 02:41', () => {
  const h = harness('InlineTimePicker');
  h.render().find(n => typeof n.type === 'function').props.onEdit();
  h.find('Editar horas').props.onChangeText('2');
  assert.equal(h.find('Editar horas').props.value, '2');
  h.find('Editar horas').props.onChangeText('24');
  assert.equal(h.find('Editar horas').props.value, '02');
  assert.equal(h.find('Editar minutos').props.value, '4');
  assert.deepEqual(h.find('Editar minutos').props.selection, { start: 1, end: 1 });
  h.find('Editar minutos').props.onChangeText('41');
  assert.deepEqual(h.changes, ['02:41']);
});

test('3 completes the hour and focus moves to minutes; only 6–9 auto-completes a single minute', () => {
  const h = harness('InlineTimePicker');
  h.render().find(n => typeof n.type === 'function').props.onEdit();
  h.find('Editar horas').props.onChangeText('3');
  const minutes = h.find('Editar minutos');
  let focused = 0;
  minutes.props.ref.current = { focus: () => focused++ };
  h.runEffects();
  assert.equal(focused, 1);
  assert.equal(h.find('Editar horas').props.value, '03');
  h.find('Editar minutos').props.onChangeText('5');
  assert.deepEqual(h.changes, []);
  h.find('Editar minutos').props.onChangeText('59');
  assert.deepEqual(h.changes, ['03:59']);
});

test('long pressing minutes edits that column while preserving hours; zeros and invalid input stay safe', () => {
  const h = harness('InlineTimePicker');
  h.render().filter(n => typeof n.type === 'function')[1].props.onEdit();
  assert.deepEqual(h.find('Editar minutos').props.selection, { start: 0, end: 2 });
  h.find('Editar minutos').props.onChangeText('60');
  h.find('Editar minutos').props.onSubmitEditing();
  assert.deepEqual(h.changes, []);
  h.find('Editar minutos').props.onChangeText('05');
  assert.deepEqual(h.changes, ['09:05']);
});

test('backspace in empty minutes returns to the hour prefix without applying a partial value', () => {
  const h = harness('InlineTimePicker');
  h.render().find(n => typeof n.type === 'function').props.onEdit();
  h.find('Editar horas').props.onChangeText('23');
  h.find('Editar minutos').props.onKeyPress({ nativeEvent: { key: 'Backspace' } });
  assert.equal(h.find('Editar horas').props.value, '2');
  assert.deepEqual(h.find('Editar horas').props.selection, { start: 1, end: 1 });
  assert.deepEqual(h.changes, []);
  h.find('Editar horas').props.onChangeText('21');
  h.find('Editar minutos').props.onChangeText('06');
  assert.deepEqual(h.changes, ['21:06']);
});

test('busy input cannot apply and both pickers retain their top-down entry', () => {
  const h = harness('InlineTimePicker');
  h.render().find(n => typeof n.type === 'function').props.onEdit();
  h.props.disabled = true;
  h.find('Editar horas').props.onChangeText('2321');
  assert.deepEqual(h.changes, []);
  assert.equal(h.render()[0].props.style[1].transform[0].translateY.initial, -48);
  assert.ok(read('components/InlineDatePicker.js').includes('new Animated.Value(-48)'));
});


test('tapping either input selects its digits for replacement, including the already focused field', () => {
  const h = harness('InlineTimePicker');
  h.render().find(n => typeof n.type === 'function').props.onEdit();
  h.find('Editar horas').props.onChangeText('23');
  h.find('Editar minutos').props.onChangeText('4');
  assert.deepEqual(h.find('Editar minutos').props.selection, { start: 1, end: 1 });
  h.find('Editar minutos').props.onPressOut();
  assert.deepEqual(h.find('Editar minutos').props.selection, { start: 0, end: 1 });
  h.find('Editar horas').props.onPressOut();
  assert.deepEqual(h.find('Editar horas').props.selection, { start: 0, end: 2 });
  h.find('Editar horas').props.onChangeText('07');
  assert.equal(h.find('Editar horas').props.value, '07');
  assert.equal(h.find('Editar minutos').props.value, '');
  h.find('Editar minutos').props.onChangeText('59');
  assert.deepEqual(h.changes, ['07:59']);
});
