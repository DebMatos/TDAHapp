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
const clean = source => source.replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '').replace(/export const /g, 'const ').replace('export default function', 'function');
const categories = new Function('lightColors', `${clean(read('config/categories.js'))}; return { getCategory, getCategoryOptions };`)(lightColors);
const compiled = babel.transformSync(clean(read('components/modals/TaskDetailsModal.js')), { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...tree.children.flat(Infinity).flatMap(nodes)];
function harness(colors = lightColors, overrides = {}) {
  const slots = []; let cursor = 0;
  const layouts = [];
  const useState = initial => {
    const key = cursor++;
    if (!(key in slots)) slots[key] = typeof initial === 'function' ? initial() : initial;
    return [slots[key], value => { slots[key] = typeof value === 'function' ? value(slots[key]) : value; }];
  };
  const useRef = initial => {
    const key = cursor++;
    if (!(key in slots)) slots[key] = { current: initial };
    return slots[key];
  };
  const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
  const context = {
    React, useState, useRef, useMemo: fn => fn(), useEffect() {},
    useLayoutEffect: fn => layouts.push(fn),
    useTheme: () => ({ colors }), ...dates, ...categories,
    Animated: { Value: class { setValue() {} }, View: 'animated' },
    Dimensions: { get: () => ({ height: 780 }) }, Keyboard: { dismiss() {} },
    PanResponder: { create: () => ({ panHandlers: {} }) }, Platform: { OS: 'android' },
    StyleSheet: { create: x => x, hairlineWidth: 1 },
    createTaskSheetStyles: () => ({}), TASK_DETAILS_HEIGHT_RATIO: 0.78,
    Modal: 'modal', Pressable: 'pressable', ScrollView: 'scroll', Text: 'text',
    TextInput: 'input', TouchableOpacity: 'button', View: 'view', Ionicons: 'icon', TaskBanner: 'banner',
  };
  const component = new Function(...Object.keys(context), `${compiled}; return TaskDetailsModal;`)(...Object.values(context));
  const saved = [];
  const props = { visible: true, mode: 'edit', initialValues: { title: 'Teste', date: '2027-01-01', startTime: '09:00', durationMinutes: 30, categoryId: 'inbox', status: 'pending', repeat: 'never', notes: '' }, onClose() {}, onSave: async value => saved.push(value), ...overrides };
  const render = () => { cursor = 0; return nodes(component(props)); };
  render(); layouts.splice(0).forEach(fn => fn());
  const button = label => {
    const result = render().find(n => n.type === 'button' && n.props.accessibilityLabel === label);
    assert.ok(result, `Missing button: ${label}`); return result;
  };
  const input = label => {
    const result = render().find(n => n.type === 'input' && n.props.accessibilityLabel === label);
    assert.ok(result, `Missing input: ${label}`); return result;
  };
  return { render, button, input, saved, props };
}
for (const [theme, colors] of [['light', lightColors], ['dark', darkColors]]) {
  test(`${theme}: details open in reading state and selectors close after selection without saving`, () => {
    const h = harness(colors);
    assert.equal(h.render().filter(n => n.type === 'input').length, 0);
    for (const [field, option] of [['categoria', 'Trabalho'], ['prioridade', 'Alta'], ['estado', 'Concluída']]) {
      h.button(`Editar ${field}`).props.onPress();
      h.button(option).props.onPress();
      assert.ok(h.button(`Editar ${field}`));
      assert.equal(h.render().some(n => n.type === 'button' && n.props.accessibilityLabel === option), false);
    }
    h.button('Editar repetição').props.onPress();
    const repeat = h.render().find(n => n.type === 'button' && nodes(n).some(child => child.children.includes('Todos os dias')));
    assert.ok(repeat); repeat.props.onPress();
    assert.ok(h.button('Editar repetição'));
    assert.equal(h.saved.length, 0);
  });
}
test('title and multiline notes confirm to labels; opening another field closes previous editor', async () => {
  const h = harness();
  h.button('Editar título da tarefa').props.onPress();
  h.input('Título da tarefa').props.onChangeText('Novo título');
  h.input('Título da tarefa').props.onSubmitEditing();
  assert.equal(h.render().some(n => n.type === 'input'), false);
  h.button('Editar notas').props.onPress();
  h.input('Notas').props.onChangeText('Linha 1\nLinha 2');
  assert.equal(h.input('Notas').props.multiline, true);
  h.button('Confirmar notas').props.onPress();
  assert.equal(h.render().some(n => n.type === 'input'), false);
  h.button('Editar notas').props.onPress();
  h.button('Editar horário').props.onPress();
  assert.equal(h.render().some(n => n.props.accessibilityLabel === 'Notas'), false);
  h.input('Hora de início').props.onChangeText('1030');
  assert.equal(h.input('Hora de fim').props.value, '11:00');
  h.input('Hora de fim').props.onChangeText('1115');
  h.button('Confirmar horário').props.onPress();
  await h.button('Guardar tarefa').props.onPress();
  assert.equal(h.saved.length, 1);
  assert.equal(h.saved[0].title, 'Novo título');
  assert.equal(h.saved[0].notes, 'Linha 1\nLinha 2');
  assert.equal(h.saved[0].startTime, '10:30');
  assert.equal(h.saved[0].durationMinutes, 45);
});
test('date confirmation rejects incomplete dates, then returns to reading after a valid date', () => {
  const h = harness(); h.button('Editar data').props.onPress();
  h.input('Data, dia mês e ano').props.onChangeText('31022027');
  assert.equal(h.button('Confirmar data').props.disabled, true);
  h.button('Confirmar data').props.onPress();
  assert.equal(h.input('Data, dia mês e ano').props.value, '31/02/2027');
  h.input('Data, dia mês e ano').props.onChangeText('02012027');
  h.button('Confirmar data').props.onPress();
  assert.ok(h.button('Editar data')); assert.equal(h.saved.length, 0);
});
test('create details start in reading state and scrolling closes the editor without losing notes', () => {
  const h = harness(lightColors, { mode: 'create', embedded: true });
  assert.equal(h.render().some(n => n.type === 'input'), false);
  h.button('Editar notas').props.onPress();
  h.input('Notas').props.onChangeText('Rascunho');
  h.render().find(n => n.type === 'scroll').props.onScrollBeginDrag();
  h.button('Editar notas').props.onPress();
  assert.equal(h.input('Notas').props.value, 'Rascunho');
  assert.equal(h.saved.length, 0);
});
test('postponement remains relative to original schedule and toggles off without persisting', () => {
  const h = harness();
  const action = text => {
    const button = h.render().find(n => n.type === 'button' && nodes(n).some(child => child.children.includes(text)));
    assert.ok(button); return button;
  };
  action('+15 min').props.onPress();
  assert.equal(action('+15 min').props.accessibilityState.selected, true);
  action('+30 min').props.onPress();
  h.button('Editar horário').props.onPress();
  assert.equal(h.input('Hora de início').props.value, '09:30');
  h.button('Confirmar horário').props.onPress();
  action('+30 min').props.onPress();
  assert.equal(action('+30 min').props.accessibilityState.selected, false);
  h.button('Editar horário').props.onPress();
  assert.equal(h.input('Hora de início').props.value, '09:00');
  assert.equal(h.saved.length, 0);
});
test('duration preset closes immediately and custom duration confirms with updated end time', () => {
  const h = harness();
  h.button('Editar duração').props.onPress();
  const preset = h.render().find(n => n.type === 'button' && nodes(n).some(child => child.children.includes('1 h')));
  assert.ok(preset); preset.props.onPress();
  h.button('Editar duração').props.onPress();
  h.input('Duração em minutos').props.onChangeText('75');
  h.button('Confirmar duração').props.onPress();
  h.button('Editar horário').props.onPress();
  assert.equal(h.input('Hora de fim').props.value, '10:15');
  assert.equal(h.saved.length, 0);
});
