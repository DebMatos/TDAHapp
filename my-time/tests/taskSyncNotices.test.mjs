import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('timeline banners use local task errors without subscribing to remote sync', () => {
  const home = read('screens/Home/HomeScreen.js');
  assert.match(home, /const banner = taskError;/);
  assert.match(home, /Não foi possível guardar a alteração neste dispositivo/);
  assert.doesNotMatch(home, /subscribeTaskSyncStatus|syncNotice/);
  assert.match(read('components/TaskSyncStatus.js'), /getTaskSyncMessage/);
});

test('the sync indicator runs one two-second turn and respects reduced motion', () => {
  const icon = read('components/TaskSyncStatus.js');
  assert.match(icon, /if \(mode !== 'syncing' \|\| reduceMotion\) return;/);
  assert.match(icon, /Animated\.timing\(rotation/);
  assert.match(icon, /duration: 2000/);
  assert.doesNotMatch(icon, /Animated\.loop/);
});
