import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/data/taskSyncPresentation.js', import.meta.url), 'utf8');
const {
  TASK_SYNC_PRESENTATIONS,
  getConnectivityPresentation,
  getFailureCategoryLabel,
  getPullPresentation,
  getQueuePresentation,
  getSendPresentation,
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('complete synchronization presentation makes the confirmation explicit', () => {
  assert.equal(TASK_SYNC_PRESENTATIONS.synced.title, 'Tudo sincronizado');
  assert.match(TASK_SYNC_PRESENTATIONS.synced.message, /sem alterações pendentes/);
});

test('detail rows distinguish confirmed, pending, active and failed states', () => {
  assert.equal(getConnectivityPresentation('online').state, 'ok');
  assert.equal(getConnectivityPresentation('offline').state, 'error');
  assert.equal(getQueuePresentation(0).state, 'ok');
  assert.equal(getQueuePresentation(2).state, 'warning');
  assert.equal(getSendPresentation({ sending: true }).state, 'active');
  assert.equal(getSendPresentation({ sendFailed: true }).state, 'error');
  assert.equal(getPullPresentation({ pullConfirmed: true }).state, 'ok');
});

test('failure labels expose safe categories without raw server details', () => {
  assert.match(getFailureCategoryLabel('validation'), /rejeitou/);
  assert.match(getFailureCategoryLabel('auth'), /sessão/);
  assert.equal(getFailureCategoryLabel(null), null);
});
