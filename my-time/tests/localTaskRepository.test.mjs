import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const modelSource = fs.readFileSync(new URL('../src/domain/taskModel.js', import.meta.url), 'utf8');
const repoSource = fs.readFileSync(new URL('../src/repositories/localTaskRepository.js', import.meta.url), 'utf8');
const stored = new Map();
const AsyncStorage = {
  getItem: async key => stored.get(key) ?? null,
  setItem: async (key, value) => { stored.set(key, value); },
  removeItem: async key => { stored.delete(key); },
};
const context = vm.createContext({ Date, Error, JSON, Math, TypeError, AsyncStorage, encodeURIComponent });
vm.runInContext(modelSource.replaceAll('export const ', 'const ') +
  '\nglobalThis.normalizeTasks = normalizeTasks;', context);
vm.runInContext(repoSource.replace(/^import .*;\s*$/gm, '').replaceAll('export const ', 'const ') +
  '\nglobalThis.api = { loadState, saveState, discardUnownedTaskState, TASK_STORAGE_INFO };', context);
const api = context.api;
const task = {
  id: 'task-1', title: 'Privada', notes: null, projectId: null, categoryId: 'inbox',
  priority: null, date: null, startTime: '17:00', durationMinutes: 30, dueDate: null,
  dueTime: null, status: 'pending', repeat: null, subtasks: [], position: 0,
  source: 'manual', createdAt: '2026-11-21T10:00:00.000Z',
  updatedAt: '2026-11-21T10:00:00.000Z', completedAt: null, abandonedAt: null,
};

test('separa tarefas e filas locais por conta', async () => {
  stored.clear();
  await api.saveState('account-a', { tasks: [task], pendingOps: [{ id: 'op-a' }] });
  assert.equal(await api.loadState('account-b'), null);
  await api.saveState('account-b', { tasks: [{ ...task, id: 'task-b', title: 'B' }], pendingOps: [] });
  assert.equal((await api.loadState('account-a')).tasks[0].title, 'Privada');
  assert.equal((await api.loadState('account-b')).tasks[0].title, 'B');
  assert.notEqual(
    `${api.TASK_STORAGE_INFO.keyPrefix}${encodeURIComponent('account-a')}`,
    `${api.TASK_STORAGE_INFO.keyPrefix}${encodeURIComponent('account-b')}`,
  );
});

test('apaga dados antigos sem proprietário sem os atribuir à conta atual', async () => {
  stored.clear();
  stored.set(api.TASK_STORAGE_INFO.legacyKey, JSON.stringify({ tasks: [task], pendingOps: [] }));
  await api.discardUnownedTaskState();
  assert.equal(stored.has(api.TASK_STORAGE_INFO.legacyKey), false);
  assert.equal(await api.loadState('account-b'), null);
});

test('recusa acesso local sem conta', async () => {
  await assert.rejects(api.loadState(null), /conta/);
  await assert.rejects(api.saveState('', { tasks: [], pendingOps: [] }), /conta/);
});
