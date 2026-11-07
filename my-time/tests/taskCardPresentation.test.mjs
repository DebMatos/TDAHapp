import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const babel = require('@babel/core');
const parser = require('@babel/parser');
const read = path => fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const fromSource = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { lightColors, darkColors } = await fromSource(read('theme/colors.js'));
const constants = await fromSource(read('constants/timeline.js'));
const time = await fromSource(read('utils/time.js').replace(
  /import[^;]+;/, `const DAY_MINUTES = ${constants.DAY_MINUTES}; const SNAP_MINUTES = ${constants.SNAP_MINUTES};`,
));
const clean = source => source.replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '').replace(/export const /g, 'const ');
const { getCategory } = new Function('lightColors', `${clean(read('config/categories.js'))};return {getCategory};`)(lightColors);
const source = read('components/TaskCardClean.js');
const compiled = babel.transformSync(clean(source).replace('export default function', 'function'), { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
function render(colors, task, height) {
  const component = new Function('React', 'useCallback', 'useMemo', 'useRef', 'DAY_MINUTES', 'formatTimeFromMinutes', 'timeToMinutes', 'formatDuration', 'snapMinutes', 'Animated', 'PanResponder', 'StyleSheet', 'Text', 'TouchableOpacity', 'View', 'getCategory', 'Ionicons', 'useTheme', `${compiled};return TaskCardClean;`)(
    React, fn => fn, fn => fn(), value => ({ current: value }), 1440,
    time.formatTimeFromMinutes, time.timeToMinutes, time.formatDuration, time.snapMinutes,
    { Value: class { constructor(value) { this.value = value; } }, View: 'animated' },
    { create: () => ({ panHandlers: {} }) }, { create: x => x, hairlineWidth: 1, absoluteFill: {} },
    'text', 'button', 'view', getCategory, 'icon', () => ({ colors }));
  return component({ task, ppm: height / task.durationMinutes, getVisualY: () => 120, getMinuteFromY: () => 540, onPress() {}, onToggle() {} });
}
const nodes = tree => [tree, ...tree.children.flat(Infinity).filter(value => value && typeof value === 'object').flatMap(nodes)];
const flattenStyle = style => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flattenStyle)) : style ?? {};
for (const [name, colors] of [['light', lightColors], ['dark', darkColors]]) {
  test(`${name}: category accents survive every task state and zoom variant`, () => {
    for (const categoryId of Object.keys(colors.categories)) {
      for (const status of ['pending', 'completed', 'abandoned']) {
        for (const height of [4, 10, 20, 60]) {
          const task = { id: 'a', title: 'Example', categoryId, status, durationMinutes: 30, startTime: '09:00' };
          const tree = render(colors, task, height);
          const root = flattenStyle(tree.props.style);
          assert.equal(root.top, 120);
          assert.equal(root.height, height);
          assert.equal(root.backgroundColor, status === 'pending' ? colors.categories[categoryId].surface : colors.taskCardNeutral);
          assert.ok(nodes(tree).some(node => flattenStyle(node.props.style).backgroundColor === colors.categories[categoryId].color));
          const open = nodes(tree).find(node => node.props.accessibilityRole === 'button');
          assert.match(open.props.accessibilityLabel, /Abrir tarefa Example/);
          assert.ok(open.props.accessibilityLabel.includes(getCategory(categoryId, colors).label));
          const checkbox = nodes(tree).find(node => node.props.accessibilityRole === 'checkbox');
          if (checkbox) assert.equal(checkbox.props.accessibilityState.checked, status === 'completed');
        }
      }
    }
  });
}

test('status bar uses resolved theme without modifying navigation or native configuration', () => {
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  const ast = parser.parse(app, { sourceType: 'module', plugins: ['jsx'] });
  const declaration = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'ThemeStatusBar');
  const code = app.slice(declaration.start, declaration.end);
  const compiledBar = babel.transformSync(code, { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
  for (const isDark of [false, true]) {
    const component = new Function('React', 'useTheme', 'StatusBar', `${compiledBar};return ThemeStatusBar;`)(React, () => ({ isDark }), 'statusbar');
    assert.equal(component().props.style, isDark ? 'light' : 'dark');
  }
});
