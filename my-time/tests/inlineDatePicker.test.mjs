import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const read = path => fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const fromSource = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { lightColors, darkColors } = await fromSource(read('theme/colors.js'));
const dates = await fromSource(read('utils/taskDateInput.js'));
const source = read('components/InlineDatePicker.js');
const clean = source.replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '').replace('export default function', 'function');
const compiled = babel.transformSync(clean, { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...tree.children.flat(Infinity).flatMap(nodes)];
const sheetSource = read('theme/styles/taskSheets.styles.js').replace(/import[^;]+;/, '').replace(/export /g, '');
const StyleSheet = { create: x => x, absoluteFillObject: {} };
const createTaskSheetStyles = new Function('StyleSheet', `${sheetSource}; return createTaskSheetStyles;`)(StyleSheet);

function harness(colors, value, disabled = false) {
  const slots = []; let cursor = 0;
  const useState = initial => {
    const key = cursor++;
    if (!(key in slots)) slots[key] = typeof initial === 'function' ? initial() : initial;
    return [slots[key], value => { slots[key] = typeof value === 'function' ? value(slots[key]) : value; }];
  };
  const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
  const effects = [], animations = [], selected = [];
  let closed = 0;
  const context = {
    React, useState, useMemo: fn => fn(), useRef: value => useState({ current: value })[0],
    useEffect: fn => effects.push(fn), useTheme: () => ({ colors }), useSafeAreaInsets: () => ({ bottom: 24 }),
    ...dates, createTaskSheetStyles, StyleSheet,
    Animated: { View: 'animated', Value: class {}, timing: (value, config) => {
      const animation = { value, config, started: false, stopped: false,
        start() { this.started = true; }, stop() { this.stopped = true; } };
      animations.push(animation); return animation;
    } },
    ScrollView: 'scroll', Text: 'text', TouchableOpacity: 'button', View: 'view', Ionicons: 'icon',
  };
  const component = new Function(...Object.keys(context), `${compiled}; return InlineDatePicker;`)(...Object.values(context));
  const render = () => {
    cursor = 0;
    return nodes(component({ value, disabled, onSelect: date => selected.push(date), onClose: () => closed++ }));
  };
  const button = label => {
    const result = render().find(n => n.type === 'button' && n.props.accessibilityLabel === label);
    assert.ok(result, `Missing button: ${label}`); return result;
  };
  render();
  const cleanup = effects.shift()();
  return { render, button, selected, animations, cleanup, closed: () => closed };
}

for (const [theme, colors] of [['light', lightColors], ['dark', darkColors]]) {
  test(`${theme}: leap February has Monday-first seven-column weeks and selected day`, () => {
    const h = harness(colors, '29/02/2024');
    assert.equal(h.button('29/02/2024').props.accessibilityState.selected, true);
    assert.equal(h.render().filter(n => n.type === 'button' && /^\d{2}\//.test(n.props.accessibilityLabel)).length, 29);
    assert.equal(h.render().some(n => n.props.accessibilityLabel === '30/02/2024'), false);
    const grid = h.render().find(n => n.props.style?.flexWrap === 'wrap');
    assert.equal(grid.children[0].length, 7);
    const days = grid.children[1];
    assert.equal(days.length % 7, 0);
    assert.deepEqual(days.slice(0, 3).map(n => n.type), ['view', 'view', 'view']);
    assert.equal(days[3].props.accessibilityLabel, '01/02/2024');
    h.button('Mês anterior').props.onPress();
    h.button('31/01/2024').props.onPress();
    assert.deepEqual(h.selected, ['31/01/2024']);
  });

  test(`${theme}: month navigation crosses years and supports past and future dates`, () => {
    const h = harness(colors, '31/12/2026');
    h.button('Mês seguinte').props.onPress();
    h.button('01/01/2027').props.onPress();
    h.button('Mês anterior').props.onPress();
    h.button('Mês anterior').props.onPress();
    h.button('01/11/2026').props.onPress();
    assert.deepEqual(h.selected, ['01/01/2027', '01/11/2026']);
    h.button('Fechar calendário').props.onPress();
    assert.equal(h.closed(), 1);
  });
}

test('entry translates only the picker, cleanup cancels it and navigation keeps safe-area space', () => {
  const h = harness(darkColors, '01/01/2027');
  const animation = h.animations[0];
  assert.equal(animation.started, true);
  assert.equal(animation.config.useNativeDriver, true);
  assert.equal(animation.config.toValue, 0);
  const panel = h.render()[0];
  assert.equal(panel.props.style[0].maxHeight, '55%');
  assert.equal(panel.props.style[0].flexShrink, 1);
  assert.equal(panel.props.style[1].paddingBottom, 32);
  assert.deepEqual(Object.keys(panel.props.style[1].transform[0]), ['translateY']);
  assert.equal(h.render().find(n => n.type === 'scroll').props.nestedScrollEnabled, true);
  h.cleanup(); assert.equal(animation.stopped, true);
});

test('saving disables every calendar action and does not introduce a native modal', () => {
  const h = harness(darkColors, '01/01/2027', true);
  for (const button of h.render().filter(n => n.type === 'button')) {
    assert.equal(button.props.disabled, true);
    assert.equal(button.props.accessibilityState.disabled, true);
  }
  assert.equal(/\bModal\b/.test(source), false);
});
