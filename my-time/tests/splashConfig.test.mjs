import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = JSON.parse(
  fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'),
).expo;

test('native splash follows the system light and dark themes', () => {
  assert.equal(config.userInterfaceStyle, 'automatic');

  const splashPlugins = config.plugins.filter(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );

  assert.equal(splashPlugins.length, 1);
  assert.deepEqual(splashPlugins[0][1], {
    image: './assets/abelhaInicio.png',
    resizeMode: 'contain',
    backgroundColor: '#EAE7E1',
    imageWidth: 180,
    dark: {
      image: './assets/prilampoInicio.png',
      backgroundColor: '#141412',
    },
  });
  assert.equal('plugins' in splashPlugins[0][1], false);
});
