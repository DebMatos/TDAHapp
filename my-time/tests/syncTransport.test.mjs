import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/lib/syncTransport.js', import.meta.url));
const { createRefreshFetch, createSyncRequest } = await import(
  `data:text/javascript;base64,${source.toString('base64')}`
);

const tokenUrl = 'https://project.invalid/auth/v1/token';
const refreshUrl = tokenUrl + '?grant_type=refresh_token';
const identity = { userId: 'a', revision: 1 };
const session = { data: { session: { user: { id: 'a' }, access_token: 'test-token' } } };
const flush = () => new Promise(setImmediate);

test('aborts a stalled Auth refresh and permits a fresh HTTP attempt', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  let calls = 0;
  const response = new Response('{}', { status: 200 });
  const statuses = [];
  const fetch = createRefreshFetch((_input, init) => {
    signal = init.signal;
    if (++calls === 1) {
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
    }
    return Promise.resolve(response);
  }, tokenUrl, run => run(status => statuses.push(status)));
  const pending = fetch(refreshUrl);
  t.mock.timers.tick(8_000);
  await assert.rejects(pending, { code: 'SYNC_TIMEOUT' });
  assert.equal(signal.aborted, true);
  assert.equal(await fetch(refreshUrl), response);
  assert.equal(await response.text(), '{}');
  assert.deepEqual(statuses, [200]);
});

test('resolves Auth once and starts the data deadline after the token is available', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolveToken;
  let dataSignal;
  let authCalls = 0;
  const request = createSyncRequest({
    getSession: () => {
      authCalls++;
      return new Promise(resolve => { resolveToken = resolve; });
    },
  }, () => identity);
  const pending = request('a', undefined, () => ({
    setHeader(name, value) {
      assert.equal(name, 'Authorization');
      assert.equal(value, 'Bearer test-token');
      return this;
    },
    abortSignal(signal) {
      dataSignal = signal;
      return new Promise(() => {});
    },
  }));
  t.mock.timers.tick(44_000);
  assert.equal(dataSignal, undefined);
  resolveToken(session);
  await flush();
  assert.equal(authCalls, 1);
  t.mock.timers.tick(14_999);
  assert.equal(dataSignal.aborted, false);
  t.mock.timers.tick(1);
  await assert.rejects(pending, { code: 'SYNC_TIMEOUT' });
  assert.equal(dataSignal.aborted, true);
});

test('discards a token obtained after a switch or re-login', async () => {
  for (const nextId of ['b', 'a']) {
    let current = identity;
    let resolve;
    const request = createSyncRequest({
      getSession: () => new Promise(done => { resolve = done; }),
    }, () => current);
    const pending = request('a', undefined, () => assert.fail('Old query was dispatched'));
    current = { userId: nextId, revision: 3 };
    resolve(session);
    await assert.rejects(pending, { code: 'SYNC_CANCELLED' });
  }
});

test('never sends a data query after a failed token lookup', async () => {
  const cases = [
    [{ name: 'AuthRetryableFetchError', status: 0 }, 'SESSION_REFRESH_TRANSIENT'],
    [{ code: 'refresh_token_not_found' }, 'SESSION_REAUTH_REQUIRED'],
  ];
  for (const [error, code] of cases) {
    const request = createSyncRequest({ getSession: async () => ({ error }) }, () => identity);
    await assert.rejects(request('a', undefined, () => assert.fail('Unauthenticated query')), { code });
  }
});
