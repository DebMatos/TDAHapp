import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/data/taskSyncNotices.js', import.meta.url), 'utf8');
const { createTaskSyncNoticeTracker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const failure = { connectivity: 'online', pending: 1, sendFailed: true };

test('one remote notice per failure episode, not per retry or operation', () => {
  const track = createTaskSyncNoticeTracker();
  assert.equal(track({ pending: null }), null);
  assert.equal(track(failure).kind, 'notice');
  assert.equal(track({ ...failure, sending: true, sendFailed: false }), null);
  assert.equal(track(failure), null);
  assert.equal(track({ ...failure, pending: 2 }), null);
});

test('only confirmed recovery clears and rearms notices; success remains silent', () => {
  const track = createTaskSyncNoticeTracker();
  const recovered = { connectivity: 'online', pending: 0, sendConfirmed: true, pullConfirmed: true };
  assert.equal(track(recovered), null);
  track(failure);
  assert.equal(track({ ...failure, pending: 0, sendFailed: false }), null);
  assert.equal(track(recovered).kind, 'clear');
  assert.equal(track(recovered), null);
  assert.equal(track(failure).kind, 'notice');
});

test('offline and unknown connectivity suppress banners without consuming episode', () => {
  const track = createTaskSyncNoticeTracker();
  assert.equal(track({ ...failure, connectivity: 'offline' }), null);
  assert.equal(track({ ...failure, connectivity: 'unknown' }), null);
  assert.equal(track(failure).kind, 'notice');
});

test('active synchronization defers notice, not permanently suppresses it', () => {
  const track = createTaskSyncNoticeTracker();
  assert.equal(track({ ...failure, pulling: true }), null);
  assert.equal(track(failure).kind, 'notice');
});

test('known actionable failures stay dismissible errors; transient notices are informational', () => {
  for (const category of ['validation', 'conflict', 'auth']) {
    const event = createTaskSyncNoticeTracker()({ ...failure, failureCategory: category });
    assert.equal(event.notice.tone, 'error');
    assert.match(event.notice.message, /locais foram mantidas/);
    assert.equal(event.notice.retry, undefined);
  }
  assert.equal(createTaskSyncNoticeTracker()(failure).notice.tone, 'info');
});

test('pull-only failure uses safe copy without claiming a local write or creating a retry mutation', () => {
  const event = createTaskSyncNoticeTracker()({ connectivity: 'online', pending: 0, pullFailed: true });
  assert.equal(event.kind, 'notice');
  assert.match(event.notice.message, /ícone de sincronização/);
  assert.equal(event.notice.retry, undefined);
});
