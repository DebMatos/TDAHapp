import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/services/taskSessionSyncService.js', import.meta.url), 'utf8')
  .replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '').replaceAll('export const ', 'const ');
const flush = () => new Promise(setImmediate);

const setup = (loadRemoteSessions) => {
  let identity = { userId: 'a', revision: 1 };
  const written = [];
  const dependencies = {
    getSessionIdentity: () => identity,
    loadRemoteSessions,
    classifyTaskSyncError: error => ({ category: error.code === 'SESSION_REFRESH_TRANSIENT' ? 'transient' : 'unknown' }),
    claimSessionOwner: async () => {},
    loadSessionSyncState: async () => ({ sessions: [{ id: 's' }], pendingIds: ['s'] }),
    mergeRemoteSessions: async (_, userId) => written.push(['merge', userId]),
    upsertRemoteSession: async userId => written.push(['send', userId]),
    confirmSyncedSession: async (_, userId) => written.push(['confirm', userId]),
  };
  const api = new Function(...Object.keys(dependencies),
    `${source}\nreturn { syncTaskSessions, setTaskSessionSyncOnline };`,
  )(...Object.values(dependencies));
  api.setTaskSessionSyncOnline(true);
  return { ...api, written, switchUser: () => { identity = { userId: 'b', revision: 2 }; } };
};

test('session sync retries a temporary renewal failure without losing pending work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const api = setup(async () => {
    if (++calls === 1) throw Object.assign(new Error(), { code: 'SESSION_REFRESH_TRANSIENT' });
    return [];
  });
  await assert.rejects(api.syncTaskSessions(), { code: 'SESSION_REFRESH_TRANSIENT' });
  assert.deepEqual(api.written, []);
  await flush();
  t.mock.timers.tick(5_000);
  await flush();
  assert.deepEqual(api.written, [['merge', 'a'], ['send', 'a'], ['confirm', 'a']]);
});

test('session sync ignores a delayed response from the previous account', async () => {
  let release;
  let oldSignal;
  const api = setup(async (userId, signal) => {
    if (userId === 'b') return [];
    oldSignal = signal;
    return new Promise(resolve => { release = resolve; });
  });
  const old = api.syncTaskSessions();
  await flush();
  api.switchUser();
  await api.syncTaskSessions();
  assert.equal(oldSignal.aborted, true);
  release([{ id: 'old-session' }]);
  await assert.rejects(old, /Sessão de utilizador alterada/);
  assert.deepEqual(api.written, [['merge', 'b'], ['send', 'b'], ['confirm', 'b']]);
});
