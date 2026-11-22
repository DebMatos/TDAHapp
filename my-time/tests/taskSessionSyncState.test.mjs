import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const modelSource = fs.readFileSync(new URL('../src/domain/taskSessionModel.js', import.meta.url), 'utf8');
const repoSource = fs.readFileSync(new URL('../src/repositories/localTaskSessionRepository.js', import.meta.url), 'utf8');
const stored = new Map();
const AsyncStorage = {
  getItem: async (key) => stored.get(key) ?? null,
  setItem: async (key, value) => stored.set(key, value),
  removeItem: async (key) => stored.delete(key),
};
const context = vm.createContext({ Date, Error, TypeError, RangeError, JSON, AsyncStorage, encodeURIComponent, console });
vm.runInContext(modelSource.replaceAll('export const ', 'const ') +
  '\nglobalThis.normalizeTaskSession = normalizeTaskSession;', context);
vm.runInContext(repoSource.replace(/^import .*;\s*$/gm, '').replaceAll('export const ', 'const ') +
  '\nglobalThis.api = { loadSessions, saveSessions, setTaskSessionRepositoryUser, claimSessionOwner, loadSessionSyncState, confirmSyncedSession, mergeRemoteSessions, TASK_SESSION_STORAGE_INFO };', context);
const api = context.api;
const open = { id: 's1', taskId: 't1', startedAt: '2026-11-15T14:00:00Z', endedAt: null };
const closed = { ...open, startedAt: '2026-11-15T14:00:00.000Z', endedAt: '2026-11-15T14:20:00Z' };

const selectUser1 = () => api.setTaskSessionRepositoryUser('user1');

test('apaga sessões antigas sem dono e não as atribui à conta', async () => {
  stored.clear();
  stored.set(api.TASK_SESSION_STORAGE_INFO.legacyKey, JSON.stringify([open]));
  selectUser1();
  await Promise.resolve();
  assert.equal(stored.has(api.TASK_SESSION_STORAGE_INFO.legacyKey), false);
  assert.equal((await api.loadSessions()).length, 0);
});

test('não apaga um novo fecho durante confirmação de envio antigo', async () => {
  stored.clear();
  selectUser1();
  await api.saveSessions([open]);
  const old = (await api.loadSessions())[0];
  await api.saveSessions([closed]);
  await api.confirmSyncedSession(old);
  const state = await api.loadSessionSyncState();
  assert.equal(state.pendingIds[0], 's1');
  assert.equal(state.sessions[0].endedAt, '2026-11-15T14:20:00.000Z');
  await api.confirmSyncedSession(state.sessions[0]);
  assert.equal((await api.loadSessionSyncState()).pendingIds.length, 0);
});

test('recupera sessões remotas sem perder alterações locais por enviar', async () => {
  stored.clear();
  selectUser1();
  await api.saveSessions([open]);
  await api.mergeRemoteSessions([{ ...open, id: 's2', taskId: 't2', endedAt: '2026-11-15T14:15:00Z' }]);
  const state = await api.loadSessionSyncState();
  assert.equal(state.sessions.length, 2);
  assert.equal(state.pendingIds.length, 1);
  assert.equal(state.pendingIds[0], 's1');
});

test('não reabre sessões terminadas com dados remotos antigos', async () => {
  stored.clear();
  selectUser1();
  await api.saveSessions([closed]);
  await api.mergeRemoteSessions([open]);
  const state = await api.loadSessionSyncState();
  assert.equal(state.sessions[0].endedAt, '2026-11-15T14:20:00.000Z');
});

test('reconcilia sessões remotas terminadas mesmo com início local pendente', async () => {
  stored.clear();
  selectUser1();
  await api.saveSessions([open]);
  await api.mergeRemoteSessions([closed]);
  const state = await api.loadSessionSyncState();
  assert.equal(state.sessions[0].endedAt, '2026-11-15T14:20:00.000Z');
  assert.equal(state.pendingIds.length, 0);
});

test('bloqueia associação de sessões a outra conta', async () => {
  stored.clear();
  selectUser1();
  await api.saveSessions([open]);
  await api.claimSessionOwner('user1');
  await assert.rejects(api.claimSessionOwner('user2'), /outra conta/);
  assert.equal((await api.loadSessions()).length, 1);
});
