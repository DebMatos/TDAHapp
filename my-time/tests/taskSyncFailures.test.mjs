import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../src/', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const moduleFromSource = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const model = await moduleFromSource(read('domain/taskModel.js'));
const { classifyTaskSyncError } = await moduleFromSource(read('services/taskSyncErrors.js'));
const stripImports = source => source.replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '').replace(/export const /g, 'const ');

function setup() {
  const task = model.createTask({ id: 'a', title: 'A' });
  let state = { tasks: [task], pendingOps: [
    { id: 'first', type: 'update', task },
    { id: 'second', type: 'delete', taskId: 'b' },
  ] };
  let error = { code: '23514', message: 'PRIVATE TASK CONTENT', details: 'PRIVATE' };
  let failStorage = false;
  const sent = [];
  const status = new Function('console', `${stripImports(read('data/taskSyncStatus.js'))}; return { subscribeTaskSyncStatus, updateTaskSyncStatus, getTaskSyncMessage };`)({ warn() {} });
  let observed;
  status.subscribeTaskSyncStatus(value => { observed = value; });
  const names = ['normalizeTask', 'normalizeTasks', 'updateTaskModel', 'toggleTaskCompletion', 'loadState', 'persistState', 'loadRemoteTasks', 'supabase', 'getSessionIdentity', 'syncOperation', 'classifyTaskSyncError', 'updateTaskSyncStatus', 'console'];
  const values = [model.normalizeTask, model.normalizeTasks, model.updateTask, model.toggleTaskCompletion,
    async () => structuredClone(state), async next => { if (failStorage) throw Error('disk'); state = structuredClone(next); return state; },
    async () => [], { auth: { getSession: async () => ({ data: { session: { user: { id: 'u' } } } }) } },
    () => ({ userId: 'u', revision: 0 }),
    async (userId, op) => { sent.push(op.id); if (error) throw error; }, classifyTaskSyncError,
    status.updateTaskSyncStatus, { warn() {}, log() {} }];
  const repository = new Function(...names, `${stripImports(read('data/taskRepository.js'))}; return { syncPendingTasks, loadTasksSnapshot };`)(...values);
  return { repository, sent, state: () => state, observed: () => observed, status,
    setError: value => { error = value; }, failStorage: () => { failStorage = true; } };
}

test('classification uses known protocol signals, never messages or attempt count', () => {
  assert.equal(classifyTaskSyncError({ code: '23514' }).state, 'blocked');
  assert.equal(classifyTaskSyncError({ code: 'PGRST116' }).category, 'conflict');
  assert.equal(classifyTaskSyncError({ status: 403 }).category, 'auth');
  assert.equal(classifyTaskSyncError({ status: 503, code: '23514' }).category, 'transient');
  assert.equal(classifyTaskSyncError({ status: 429 }).state, 'pending');
  assert.equal(classifyTaskSyncError({ name: 'AbortError' }).state, 'pending');
  assert.deepEqual(classifyTaskSyncError({ code: 'PRIVATE', message: 'PRIVATE', attempts: 999 }),
    { category: 'unknown', state: 'pending', lastErrorCode: null });
});

test('known rejection preserves task, queue order and safe diagnostics', async () => {
  const h = setup();
  await assert.rejects(h.repository.syncPendingTasks());
  const state = h.state();
  assert.deepEqual(h.sent, ['first']);
  assert.deepEqual(state.pendingOps.map(op => op.id), ['first', 'second']);
  assert.equal(state.tasks[0].title, 'A');
  const diagnostic = state.pendingOps[0].sync;
  assert.equal(diagnostic.state, 'blocked');
  assert.equal(diagnostic.attempts, 1);
  assert.equal(diagnostic.lastErrorCode, '23514');
  assert.ok(Number.isFinite(Date.parse(diagnostic.lastAttemptAt)));
  assert.equal(JSON.stringify(diagnostic).includes('PRIVATE'), false);
  assert.match(h.status.getTaskSyncMessage(h.observed()), /bloqueada/);
  await h.repository.loadTasksSnapshot();
  assert.equal(h.observed().failureCategory, 'validation');
});

test('failed retries increment diagnostics without dropping dependent operations', async () => {
  const h = setup();
  await assert.rejects(h.repository.syncPendingTasks());
  await assert.rejects(h.repository.syncPendingTasks());
  assert.equal(h.state().pendingOps[0].sync.attempts, 2);
  assert.deepEqual(h.sent, ['first', 'first']);
  h.setError(null);
  assert.equal(await h.repository.syncPendingTasks(), 2);
  assert.equal(h.state().pendingOps.length, 0);
  assert.equal(h.observed().failureCategory, null);
  assert.equal(h.status.getTaskSyncMessage(h.observed()), '');
});

test('unknown failure remains pending regardless of repetition', async () => {
  const h = setup();
  h.setError(Error('unrecognised failure'));
  await assert.rejects(h.repository.syncPendingTasks());
  assert.equal(h.state().pendingOps[0].sync.state, 'pending');
  assert.equal(h.state().pendingOps[0].sync.category, 'unknown');
});

test('auth failure stops FIFO without marking data as permanently invalid', async () => {
  const h = setup();
  h.setError({ status: 401 });
  await assert.rejects(h.repository.syncPendingTasks());
  assert.equal(h.state().pendingOps[0].sync.state, 'pending');
  assert.equal(h.state().pendingOps[0].sync.category, 'auth');
  assert.deepEqual(h.sent, ['first']);
  assert.match(h.status.getTaskSyncMessage(h.observed()), /sessão/);
});

test('diagnostic write failure preserves original queue and send error', async () => {
  const h = setup();
  const original = { code: '23514' };
  h.setError(original);
  h.failStorage();
  await assert.rejects(h.repository.syncPendingTasks(), error => error === original);
  assert.equal(h.state().pendingOps.length, 2);
  assert.equal(h.state().pendingOps[0].sync, undefined);
});

function setupPull() {
  let state = { tasks: [model.createTask({ id: 'a', title: 'Original' })], pendingOps: [] };
  let authCalls = 0, authWaiting = false, releaseAuth, authListener;
  const auth = {
    onAuthStateChange: listener => { authListener = listener; },
    getSession: async () => {
      if (++authCalls === 2) {
        authWaiting = true;
        await new Promise(resolve => { releaseAuth = resolve; });
      }
      return { data: { session: { user: { id: 'u' } } } };
    },
  };
  // Execute the actual synchronous identity tracker, without creating a client.
  const lib = read('lib/supabase.js');
  const tracker = lib.slice(lib.indexOf('// Track identity'), lib.indexOf("if (Platform.OS !== 'web')"));
  const getSessionIdentity = new Function('supabase', `${tracker.replace(/export const /g, 'const ')};return getSessionIdentity;`)({ auth });
  const emit = (event, userId) => authListener(event, userId ? { user: { id: userId } } : null);
  emit('INITIAL_SESSION', 'u');
  const names = ['normalizeTask', 'normalizeTasks', 'updateTaskModel', 'toggleTaskCompletion', 'loadState', 'persistState', 'loadRemoteTasks', 'supabase', 'getSessionIdentity', 'syncOperation', 'classifyTaskSyncError', 'updateTaskSyncStatus', 'console'];
  const values = [model.normalizeTask, model.normalizeTasks, model.updateTask, model.toggleTaskCompletion,
    async () => structuredClone(state), async next => (state = structuredClone(next)),
    async () => [model.createTask({ id: 'remote', title: 'Remote' })], { auth }, getSessionIdentity,
    async () => { throw Error('offline'); }, classifyTaskSyncError, () => {}, { warn() {}, log() {} }];
  const repository = new Function(...names, `${stripImports(read('data/taskRepository.js'))};return { pullRemoteTasks, createTaskAndLoadTasks, updateTaskAndLoadTasks, deleteTask };`)(...values);
  return { repository, emit, identity: getSessionIdentity, waiting: () => authWaiting,
    release: () => releaseAuth(), state: () => state };
}

const until = async predicate => {
  for (let i = 0; i < 300; i += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw Error('Expected condition not reached');
};

for (const action of ['create', 'update', 'delete']) {
  test(`P1: ${action} completes while pull session revalidation is suspended`, async () => {
    const h = setupPull();
    const pull = h.repository.pullRemoteTasks();
    await until(h.waiting);
    if (action === 'create') await h.repository.createTaskAndLoadTasks({ id: 'b', title: 'Local' });
    if (action === 'update') await h.repository.updateTaskAndLoadTasks('a', { title: 'Edited' });
    if (action === 'delete') await h.repository.deleteTask('a');
    if (action === 'create') assert.ok(h.state().tasks.some(task => task.id === 'b'));
    if (action === 'update') assert.equal(h.state().tasks[0].title, 'Edited');
    if (action === 'delete') assert.equal(h.state().tasks.length, 0);
    h.release();
    await pull;
    assert.ok(h.state().tasks.some(task => task.id === 'remote'));
  });
}

test('P1: sign-out during revalidation rejects remote response', async () => {
  const h = setupPull();
  const pull = h.repository.pullRemoteTasks();
  await until(h.waiting);
  h.emit('SIGNED_OUT', null);
  h.release();
  await assert.rejects(pull, /Sessão alterada/);
  assert.deepEqual(h.state().tasks.map(task => task.id), ['a']);
});

test('P1: sign-out and sign-in to the same account still invalidates response', async () => {
  const h = setupPull();
  const pull = h.repository.pullRemoteTasks();
  await until(h.waiting);
  h.emit('SIGNED_OUT', null);
  h.emit('SIGNED_IN', 'u');
  h.release();
  await assert.rejects(pull, /Sessão alterada/);
  assert.equal(h.state().tasks.length, 1);
});

test('P1: normal token refresh keeps identity revision and allows pull', async () => {
  const h = setupPull();
  const revision = h.identity().revision;
  const pull = h.repository.pullRemoteTasks();
  await until(h.waiting);
  h.emit('TOKEN_REFRESHED', 'u');
  assert.equal(h.identity().revision, revision);
  h.release();
  await pull;
  assert.equal(h.state().tasks.length, 2);
});
