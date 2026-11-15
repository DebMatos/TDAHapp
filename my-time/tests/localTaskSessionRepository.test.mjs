import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const modelSource = fs.readFileSync(new URL('../src/domain/taskSessionModel.js', import.meta.url), 'utf8');
const repoSource = fs.readFileSync(new URL('../src/repositories/localTaskSessionRepository.js', import.meta.url), 'utf8');

const stored = new Map();
const AsyncStorage = {
  getItem: async (key) => stored.get(key) ?? null,
  setItem: async (key, value) => { stored.set(key, value); },
};

const context = vm.createContext({ Date, Error, TypeError, RangeError, JSON, AsyncStorage });
vm.runInContext(modelSource.replaceAll('export const ', 'const ') +
  '\nglobalThis.normalizeTaskSession = normalizeTaskSession;', context);
vm.runInContext(repoSource
  .replace(/^import .*;\s*$/gm, '')
  .replaceAll('export const ', 'const ') +
  '\nglobalThis.loadSessions = loadSessions; globalThis.saveSessions = saveSessions; globalThis.TASK_SESSION_STORAGE_INFO = TASK_SESSION_STORAGE_INFO;', context);

const { loadSessions, saveSessions, TASK_SESSION_STORAGE_INFO } = context;
const session = { id: 's1', taskId: 't1', startedAt: '2026-11-15T14:12:00Z', endedAt: null };

test('sem dados locais devolve lista vazia', async () => {
  stored.clear();
  assert.equal((await loadSessions()).length, 0);
});

test('guarda sessões e recupera uma sessão ainda em curso', async () => {
  stored.clear();
  const saved = await saveSessions([session]);
  assert.equal(saved.length, 1);
  const loaded = await loadSessions();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].taskId, 't1');
  assert.equal(loaded[0].endedAt, null);
  assert.equal(loaded[0].startedAt, '2026-11-15T14:12:00.000Z');
});

test('preserva múltiplas sessões fechadas e abertas', async () => {
  stored.clear();
  await saveSessions([
    { ...session, endedAt: '2026-11-15T14:32:00Z' },
    { ...session, id: 's2', startedAt: '2026-11-15T14:40:00Z' },
  ]);
  const loaded = await loadSessions();
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].endedAt, '2026-11-15T14:32:00.000Z');
  assert.equal(loaded[1].endedAt, null);
});

test('recusa dados malformados sem os apagar', async () => {
  stored.clear();
  stored.set(TASK_SESSION_STORAGE_INFO.key, '{"sessions":[]}');
  await assert.rejects(loadSessions(), /inválidos/);
  assert.equal(stored.get(TASK_SESSION_STORAGE_INFO.key), '{"sessions":[]}');
});

test('não substitui os dados locais quando falha a validação', async () => {
  stored.clear();
  await saveSessions([session]);
  const before = stored.get(TASK_SESSION_STORAGE_INFO.key);
  await assert.rejects(saveSessions([{ ...session, startedAt: 'invalid' }]), /startedAt/);
  assert.equal(stored.get(TASK_SESSION_STORAGE_INFO.key), before);
});
