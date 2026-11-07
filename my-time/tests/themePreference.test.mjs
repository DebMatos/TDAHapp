import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const source = fs.readFileSync(new URL('../src/theme/ThemeContext.js', import.meta.url), 'utf8')
  .replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '').replace(/export function/g, 'function');
const compiled = babel.transformSync(source, { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
function harness(stored, failWrite = false) {
  const slots = [], effects = [], writes = [];
  let cursor = 0;
  const useState = initial => {
    const key = cursor++;
    if (!(key in slots)) slots[key] = initial;
    return [slots[key], value => { slots[key] = value; }];
  };
  const context = {
    React: { createElement: (_, props) => props.value }, createContext: () => ({ Provider: 'provider' }),
    useState, useRef: initial => useState({ current: initial })[0], useMemo: fn => fn(),
    useCallback: fn => fn, useEffect: fn => { if (!effects.length) effects.push(fn); },
    AsyncStorage: { getItem: async () => stored, setItem: async (key, value) => { writes.push([key, value]); if (failWrite) throw Error('disk'); } },
    lightColors: {}, darkColors: {},
  };
  const provider = new Function(...Object.keys(context), `${compiled};return ThemeProvider;`)(...Object.values(context));
  const render = () => { cursor = 0; return provider({}); };
  render();
  return { render, writes, load: async () => { effects[0](); await new Promise(resolve => setImmediate(resolve)); } };
}
test('dark is the default and saved manual modes are restored', async () => {
  for (const stored of [null, 'dark', 'light', 'invalid']) {
    const h = harness(stored);
    assert.equal(h.render().themeMode, 'dark');
    await h.load();
    assert.equal(h.render().themeMode, stored === 'light' ? 'light' : 'dark');
  }
});
test('legacy system preference is migrated and persisted as light', async () => {
  const h = harness('system');
  await h.load();
  assert.equal(h.render().themeMode, 'light');
  assert.deepEqual(h.writes, [['@tdahapp/theme-mode', 'light']]);
});
test('manual choice takes precedence over pending hydration and rejects system', async () => {
  const h = harness('system');
  await h.render().setThemeMode('dark');
  await h.load();
  assert.equal(h.render().themeMode, 'dark');
  assert.deepEqual(h.writes, [['@tdahapp/theme-mode', 'dark']]);
  await assert.rejects(h.render().setThemeMode('system'), /inválido/);
});
test('failed migration retains light; failed manual write keeps the session choice and rejects', async () => {
  const h = harness('system', true);
  await h.load();
  assert.equal(h.render().themeMode, 'light');
  await assert.rejects(h.render().setThemeMode('dark'), /disk/);
  assert.equal(h.render().isDark, true);
});
