import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Exercise the real taskService implementation without needing React Native or Supabase.
const source = fs.readFileSync(
  new URL('../src/services/taskService.js', import.meta.url),
  'utf8',
);
const executable = source
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*'\.\.\/data\/taskRepository';/, '')
  .replace(/export const /g, 'const ');

test('task creation generates different IDs even during the same millisecond', async () => {
  const originalNow = Date.now;
  const captured = [];
  const createTaskAndLoadTasks = async (task) => {
    captured.push(task);
    return [task];
  };
  const createTask = new Function(
    'createTaskAndLoadTasks',
    executable + '\nreturn createTask;',
  )(createTaskAndLoadTasks);

  try {
    Date.now = () => 1770000000000;
    for (let i = 0; i < 100; i += 1) {
      await createTask({ title: 'Teste', id: 'ignored-id' });
    }
  } finally {
    Date.now = originalNow;
  }

  const ids = captured.map((task) => task.id);
  assert.equal(new Set(ids).size, 100);
  assert.ok(ids.every((id) => /^task-1770000000000-[a-z0-9]+$/.test(id)));
  assert.ok(captured.every((task) => task.title === 'Teste'));
});
