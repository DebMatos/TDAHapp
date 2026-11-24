import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
const load = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const plan = await load(read('services/taskReminderPlan.js'));
const themes = await load(read('theme/colors.js'));
const source = read('screens/NotificationSettingsScreen.js')
  .replace(/^import [\s\S]*?;\n/gm, '').replace('export default function', 'function');
const compiled = babel.transformSync(source, {
  configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'],
}).code;

function mount(colors, permissionValue = 'blocked') {
  const slots = [];
  const writes = [];
  let cursor = 0;
  let settingsOpened = false;
  const context = {
    ...plan,
    React: { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useEffect(effect) { if (!slots[cursor++]) { slots[cursor - 1] = true; effect(); } },
    useTheme: () => ({ colors, isDark: colors === themes.darkColors }),
    AppState: { addEventListener: () => ({ remove() {} }) },
    Keyboard: { dismiss() {} },
    Linking: { openSettings: async () => { settingsOpened = true; } },
    StyleSheet: { create: value => value },
    remindersSupported: true,
    getReminderPermission: async () => permissionValue,
    readReminderPreferences: async () => plan.defaultReminderPreferences,
    saveReminderPreferences: async value => writes.push(value),
    ...Object.fromEntries(['View', 'Text', 'ScrollView', 'Switch', 'TextInput', 'TouchableOpacity', 'SafeAreaView', 'Ionicons'].map(name => [name, name])),
  };
  const screen = new Function(...Object.keys(context), compiled + '\nreturn NotificationSettingsScreen;')(...Object.values(context));
  const nodes = node => [node, ...node.children.flat(Infinity).filter(child => child && typeof child === 'object').flatMap(nodes)];
  const render = () => { cursor = 0; return nodes(screen({ navigation: { navigate() {} } })); };
  const control = type => render().find(node => node.type === type).props;
  const button = label => render().find(node => node.type === 'TouchableOpacity' && nodes(node).some(item => item.children.includes(label)));
  render();
  return { control, button, render, writes, settingsOpened: () => settingsOpened };
}

for (const [theme, colors] of Object.entries({ light: themes.lightColors, dark: themes.darkColors })) {
  test(theme + ': direct editing, shortcuts, units and permission recovery', async () => {
    const ui = mount(colors);
    await Promise.resolve();
    assert.equal(ui.control('TextInput').value, '15');
    assert.equal(ui.control('TextInput').keyboardType, 'number-pad');
    assert.deepEqual(ui.control('Switch').trackColor, {
      false: colors.surfaceMuted,
      true: colors.selectionSoft,
    });
    assert.equal(ui.control('Switch').thumbColor, colors.selection);
    assert.equal(ui.control('Switch').ios_backgroundColor, colors.surfaceMuted);
    assert.ok(ui.render().some(node => node.children.includes('Avisos de tarefas')));
    assert.equal(ui.render().some(node => node.children.includes('Notificações de tarefas')), false);
    const leadControl = ui.render().find(node => node.type === 'View'
      && Array.isArray(node.props.style)
      && node.props.style[0]?.borderRadius === 12
      && node.props.style[0]?.padding === 4);
    assert.equal(leadControl.props.style[1].backgroundColor,
      theme === 'dark' ? colors.surfaceSoft : colors.surfaceMuted);
    const selectedUnit = ui.button('Minutos');
    assert.equal(selectedUnit.props.style[1].backgroundColor,
      theme === 'dark' ? colors.selectionSoft : colors.selection);
    const selectedUnitLabel = ui.render().find(node => node.type === 'Text'
      && node.children.includes('Minutos'));
    assert.equal(selectedUnitLabel.props.style.color,
      theme === 'dark' ? colors.selectionText : colors.surface);
    assert.equal(ui.button('15 min').props.accessibilityState.selected, true);
    await ui.button('Abrir definições do sistema').props.onPress();
    assert.equal(ui.settingsOpened(), true);
    ui.button('1 hora').props.onPress();
    assert.equal(ui.control('TextInput').value, '1');
    assert.equal(ui.button('Horas').props.accessibilityState.checked, true);
    ui.button('Dias').props.onPress();
    assert.deepEqual(ui.writes.at(-1), { enabled: true, lead: 1440, unit: 'days' });
    ui.control('TextInput').onChangeText('2');
    ui.control('TextInput').onEndEditing();
    assert.deepEqual(ui.writes.at(-1), { enabled: true, lead: 2880, unit: 'days' });
    assert.equal(ui.button('1 dia').props.accessibilityState.selected, false);
    ui.button('Minutos').props.onPress();
    ui.control('TextInput').onChangeText('0');
    const writesBefore = ui.writes.length;
    ui.control('TextInput').onEndEditing();
    assert.equal(ui.writes.length, writesBefore);
    ui.control('Switch').onValueChange(false);
    assert.equal(ui.control('TextInput').editable, false);
    assert.equal(ui.control('Switch').thumbColor, colors.textMuted);
    assert.equal(ui.writes.at(-1).enabled, false);
    ui.control('Switch').onValueChange(true);
    assert.equal(ui.control('TextInput').editable, true);
    assert.equal(ui.control('Switch').thumbColor, colors.selection);
  });
}

test('permission recovery is hidden when system authorization is already granted', async () => {
  const ui = mount(themes.lightColors, 'granted');
  await Promise.resolve();
  assert.equal(ui.button('Autorizar notificações'), undefined);
  assert.equal(ui.button('Abrir definições do sistema'), undefined);
});
