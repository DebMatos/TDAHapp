import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../src/repositories/supabaseTaskRepository.js', import.meta.url),
  'utf8',
);
const executable = source
  .replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '')
  .replace(/export const /g, 'const ');

test('remote task creation is idempotent and ignores an existing primary key', async () => {
  let captured;
  const query = {
    upsert(row, options) {
      captured = { row, options };
      return this;
    },
    abortSignal() {
      return Promise.resolve({ error: null });
    },
  };
  const supabase = { from: table => {
    assert.equal(table, 'tasks');
    return query;
  } };
  const normalizeTask = task => ({
    notes: null,
    projectId: null,
    categoryId: 'inbox',
    priority: null,
    date: null,
    startTime: '07:00',
    durationMinutes: 30,
    dueDate: null,
    dueTime: null,
    status: 'pending',
    repeat: null,
    subtasks: [],
    position: 0,
    source: 'manual',
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T10:00:00.000Z',
    completedAt: null,
    abandonedAt: null,
    ...task,
  });
  const createTask = new Function(
    'supabase',
    'normalizeTask',
    'normalizeTasks',
    `${executable}; return createTask;`,
  )(supabase, normalizeTask, tasks => tasks);

  const task = normalizeTask({ id: 'task-same-id', title: 'Sem duplicar' });
  assert.deepEqual(await createTask('user-1', task, new AbortController().signal), task);
  assert.equal(captured.row.id, 'task-same-id');
  assert.equal(captured.row.user_id, 'user-1');
  assert.deepEqual(captured.options, { onConflict: 'id', ignoreDuplicates: true });
});

test('remote task errors carry the PostgREST response status into the sync classifier', async () => {
  const response = { error: { message: 'JWT expired' }, status: 401 };
  const query = {
    delete() { return this; },
    eq() { return this; },
    abortSignal: async () => response,
  };
  const deleteTask = new Function('supabase', `${executable}; return deleteTask;`)({ from: () => query });
  await assert.rejects(deleteTask('user-1', 'task-1'), { message: 'JWT expired', status: 401 });
});
