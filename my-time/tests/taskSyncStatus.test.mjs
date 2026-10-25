import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/data/taskSyncStatus.js', import.meta.url), 'utf8');
const freshStatus = () => new Function(`${source.replace(/export const /g, 'const ')};return { updateTaskSyncStatus, updateTaskSyncConnectivity, subscribeTaskSyncStatus, getTaskSyncState };`)();
const online = { isConnected: true, isInternetReachable: true };
const complete = { pending: 0, sendConfirmed: true, pullConfirmed: true };
const setup = () => {
  const api = freshStatus();
  let current;
  api.subscribeTaskSyncStatus(value => { current = value; });
  return { api, state: () => current, mode: () => api.getTaskSyncState(current) };
};

test('empty or unread queue does not establish synchronization', () => {
  const h = setup();
  assert.equal(h.mode(), 'checking');
  h.api.updateTaskSyncConnectivity(online);
  h.api.updateTaskSyncStatus({ pending: 0 });
  assert.equal(h.mode(), 'checking');
  h.api.updateTaskSyncStatus({ sendConfirmed: true });
  assert.equal(h.mode(), 'checking');
  h.api.updateTaskSyncStatus({ pullConfirmed: true });
  assert.equal(h.mode(), 'synced');
});

test('offline takes precedence over activity and error, preserving the error', () => {
  const h = setup();
  h.api.updateTaskSyncStatus({ pending: 1, sending: true, sendFailed: true });
  h.api.updateTaskSyncConnectivity({ isConnected: false, isInternetReachable: null });
  assert.equal(h.mode(), 'offline');
  assert.equal(h.state().sendFailed, true);
});

test('active work precedes error; pending and checking are honest transitional states', () => {
  const h = setup();
  h.api.updateTaskSyncConnectivity(online);
  h.api.updateTaskSyncStatus({ pending: 1 });
  assert.equal(h.mode(), 'pending');
  h.api.updateTaskSyncStatus({ sendFailed: true, pulling: true });
  assert.equal(h.mode(), 'syncing');
  h.api.updateTaskSyncStatus({ pulling: false });
  assert.equal(h.mode(), 'error');
});

test('new pending work invalidates previous send confirmation, even after queue empties', () => {
  const h = setup();
  h.api.updateTaskSyncConnectivity(online);
  h.api.updateTaskSyncStatus(complete);
  assert.equal(h.mode(), 'synced');
  h.api.updateTaskSyncStatus({ pending: 1 });
  h.api.updateTaskSyncStatus({ pending: 0 });
  assert.equal(h.mode(), 'checking');
  h.api.updateTaskSyncStatus({ sendConfirmed: true });
  assert.equal(h.mode(), 'synced');
});

test('reconnection requires fresh confirmation; duplicate online events preserve it', () => {
  const h = setup();
  h.api.updateTaskSyncConnectivity(online);
  h.api.updateTaskSyncStatus(complete);
  h.api.updateTaskSyncConnectivity(online);
  assert.equal(h.mode(), 'synced');
  h.api.updateTaskSyncConnectivity({ isConnected: true, isInternetReachable: false });
  assert.equal(h.mode(), 'offline');
  h.api.updateTaskSyncConnectivity(online);
  assert.equal(h.mode(), 'checking');
});

test('unknown reachability is not offline and cannot display confirmed sync', () => {
  const h = setup();
  h.api.updateTaskSyncConnectivity({ isConnected: true, isInternetReachable: null });
  h.api.updateTaskSyncStatus(complete);
  assert.equal(h.state().connectivity, 'unknown');
  assert.equal(h.mode(), 'checking');
});

test('failed pull invalidates confirmation; persisted blocking metadata is visible', () => {
  const h = setup();
  h.api.updateTaskSyncConnectivity(online);
  h.api.updateTaskSyncStatus(complete);
  h.api.updateTaskSyncStatus({ pullFailed: true });
  assert.equal(h.state().pullConfirmed, false);
  assert.equal(h.mode(), 'error');
  h.api.updateTaskSyncStatus({ pullFailed: false, pending: 1, failureCategory: 'validation' });
  assert.equal(h.mode(), 'error');
});
