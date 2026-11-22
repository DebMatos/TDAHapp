import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../src/', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const moduleFromSource = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const model = await moduleFromSource(read('domain/taskModel.js'));
const { classifyTaskSyncError } = await moduleFromSource(read('services/taskSyncErrors.js'));
const stripImports = source => source.replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '').replace(/export const /g, 'const ');
const diagnosticsSource = stripImports(read('data/taskSyncDiagnostics.js'));
const diagnosticsExports = [
  'getDiagnosticOperationId',
  'recordTaskSyncTransition',
  'taskSyncDiagnosticsEnabled',
  'traceTaskSyncDiagnostic',
  'subscribeTaskSyncDiagnostics',
];
const loadDiagnostics = (enabled = false) => new Function(
  '__DEV__',
  'classifyTaskSyncError',
  `${diagnosticsSource}; return { ${diagnosticsExports.join(', ')} };`,
)(enabled, classifyTaskSyncError);

const repositorySource = stripImports(read('data/taskRepository.js'))
  .replace('let syncOnline = null;', 'let syncOnline = true;')
  .replace('let syncSessionReady = false;', 'let syncSessionReady = true;')
  .replace('let taskUserId = null;', "let taskUserId = 'u';");

function setup({ withPendingOperations = true, diagnosticsEnabled, loadRemote = async () => [], initialState } = {}) {
  const task = model.createTask({ id: 'a', title: 'A', notes: 'private note' });
  let state = initialState ? structuredClone(initialState) : { tasks: [task], pendingOps: withPendingOperations ? [
    { id: 'first', type: 'update', task },
    { id: 'second', type: 'delete', taskId: 'b' },
  ] : [] };
  let error = { code: '23514', message: 'PRIVATE TASK CONTENT', details: 'PRIVATE' };
  let syncImplementation = async (userId, op) => {
    sent.push(op.id);
    if (error) throw error;
  };
  let failStorage = false;
  let remoteLoads = 0;
  const sent = [];
  const status = new Function('console', `${stripImports(read('data/taskSyncStatus.js'))}; return { subscribeTaskSyncStatus, updateTaskSyncStatus, getTaskSyncMessage };`)({ warn() {} });
  let observed;
  status.subscribeTaskSyncStatus(value => { observed = value; });
  const names = ['normalizeTask', 'normalizeTasks', 'updateTaskModel', 'toggleTaskCompletion', 'discardUnownedTaskState', 'loadState', 'persistState', 'loadRemoteTasks', 'supabase', 'getSessionIdentity', 'syncOperation', 'classifyTaskSyncError', 'updateTaskSyncStatus', 'console'];
  const values = [model.normalizeTask, model.normalizeTasks, model.updateTask, model.toggleTaskCompletion,
    async () => {}, async () => structuredClone(state), async (_userId, next) => { if (failStorage) throw Error('disk'); state = structuredClone(next); return state; },
    (...args) => { remoteLoads += 1; return loadRemote(...args); }, {},
    () => ({ userId: 'u', revision: 0 }),
    (...args) => syncImplementation(...args), classifyTaskSyncError,
    status.updateTaskSyncStatus, { warn() {}, log() {} }];
  const diagnostics = loadDiagnostics(diagnosticsEnabled);
  const repository = new Function(...names, ...diagnosticsExports, `${repositorySource}; return { syncPendingTasks, syncOperationWithTimeout, setTaskSyncOnline, setTaskSyncSessionReady, resumeTaskSync, pullRemoteTasks, loadTasksSnapshot, updateTaskAndLoadTasks, createTaskAndLoadTasks, deleteTask };`)(...values, ...diagnosticsExports.map(name => diagnostics[name]));
  return { repository, sent, state: () => state, observed: () => observed, status, diagnostics,
    setError: value => { error = value; },
    setSyncImplementation: value => { syncImplementation = value; },
    remoteLoads: () => remoteLoads,
    failStorage: () => { failStorage = true; } };
}

test('diagnostics expose an unfinished send while local edits continue', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date() });
  let resolveSession;
  const h = setup({
    diagnosticsEnabled: true,
    withPendingOperations: false,
  });
  h.setSyncImplementation(async (_userId, _operation, { reportHttp }) => {
    await new Promise(resolve => { resolveSession = resolve; });
    reportHttp(403);
    throw { code: '42501', message: 'private server error' };
  });
  let history;
  const unsubscribe = h.diagnostics.subscribeTaskSyncDiagnostics(entries => { history = entries; });
  await h.repository.updateTaskAndLoadTasks('a', { title: 'private edit' });
  await new Promise(setImmediate);
  t.mock.timers.tick(10_000);
  const firstRun = h.repository.syncPendingTasks();
  await until(() => Boolean(resolveSession));

  const waiting = history.find(entry => entry.phase === 'send');
  assert.equal(waiting.outcome, 'pending');
  assert.ok(history.some(entry => entry.phase === 'send-requested' && entry.state.syncRequested));
  assert.equal(waiting.state.syncPromise, true);
  assert.equal(history.find(entry => entry.phase === 'queue').pending, 1);
  assert.deepEqual(h.sent, []);

  const operationId = h.state().pendingOps[0].id;
  resolveSession();
  await assert.rejects(firstRun, error => error.code === '42501');
  const failed = history.find(entry => entry.phase === 'send');
  assert.equal(failed.operationId, operationId);
  assert.equal(failed.outcome, 'failed');
  assert.equal(failed.status, 403);
  assert.equal(failed.attempt, 1);
  assert.equal(failed.errorCode, '42501');
  assert.ok(failed.payload.includes('notes'));
  assert.doesNotMatch(JSON.stringify(history), /private note|private edit|private server error/);
  assert.equal(h.state().pendingOps.length, 1);
  unsubscribe();
});

test('diagnostics bound history, isolate late HTTP responses and stay off in production', async () => {
  const diagnostics = loadDiagnostics(true);
  let history;
  diagnostics.subscribeTaskSyncDiagnostics(entries => { history = entries; });
  let report;
  const result = Promise.reject(new Error('cancelled'));
  assert.equal(diagnostics.traceTaskSyncDiagnostic('send', () => ({}), reportHttp => {
    report = reportHttp;
    return result;
  }), result);
  await assert.rejects(result);
  report(204);
  assert.equal(history[0].phase, 'late-response');
  assert.equal(history[0].status, 204);
  assert.equal(history[1].outcome, 'failed');
  assert.equal(history[1].status, undefined);
  for (let index = 0; index < 50; index++) {
    diagnostics.recordTaskSyncTransition('queue', {}, { pending: index });
  }
  assert.equal(history.length, 40);
  assert.equal(history[0].pending, 49);
  assert.equal(history.at(-1).pending, 10);

  diagnostics.traceTaskSyncDiagnostic('send-session', () => ({}), () => new Promise(() => {}));
  for (let index = 0; index < 40; index++) {
    diagnostics.recordTaskSyncTransition('queue', {}, { pending: index });
  }
  assert.equal(history.length, 40);
  assert.equal(history.at(-1).phase, 'send-session');

  const production = loadDiagnostics();
  const unsubscribe = production.subscribeTaskSyncDiagnostics(() => assert.fail('production diagnostics'));
  production.recordTaskSyncTransition('queue', {});
  await production.traceTaskSyncDiagnostic('send', () => assert.fail('production snapshot'), async (reportHttp) => {
    assert.equal(reportHttp, undefined);
  });
  unsubscribe();
});

test('classification uses known protocol signals, never messages or attempt count', () => {
  assert.equal(classifyTaskSyncError({ code: '23514' }).state, 'blocked');
  assert.equal(classifyTaskSyncError({ code: 'PGRST116' }).category, 'conflict');
  assert.equal(classifyTaskSyncError({ status: 403 }).category, 'auth');
  assert.equal(classifyTaskSyncError({ code: 'SESSION_UNAVAILABLE' }).category, 'auth');
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

test('local update enters the shared queue and reaches the remote sync operation', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date() });
  const h = setup({ withPendingOperations: false });
  let sentOperation;
  h.setError(null);
  h.setSyncImplementation(async (userId, operation) => {
    sentOperation = structuredClone(operation);
  });
  await h.repository.updateTaskAndLoadTasks('a', { title: 'Alterada' });
  await new Promise(setImmediate);
  t.mock.timers.tick(10_000);
  await until(() => h.state().pendingOps.length === 0);
  assert.equal(sentOperation.type, 'update');
  assert.equal(sentOperation.task.title, 'Alterada');
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

test('hung remote operation is aborted and reported as a transient timeout', async () => {
  const h = setup();
  let signal;
  h.setSyncImplementation(async (userId, operation, options) => {
    signal = options.signal;
    await new Promise(() => {});
  });
  await assert.rejects(
    h.repository.syncOperationWithTimeout('u', h.state().pendingOps[0], 20),
    error => error.name === 'AbortError',
  );
  assert.equal(signal.aborted, true);
});

test('confirmed offline state never starts a task synchronization', async () => {
  const h = setup();
  h.repository.setTaskSyncOnline(false);
  assert.equal(await h.repository.syncPendingTasks(), 0);
  assert.deepEqual(h.sent, []);
  assert.equal(h.state().pendingOps.length, 2);
  assert.equal(h.observed().sending, false);
});

test('confirmed connectivity waits for a valid session before sending', async () => {
  const h = setup();
  h.repository.setTaskSyncSessionReady(false);
  h.repository.setTaskSyncOnline(true);
  assert.equal(await h.repository.syncPendingTasks(), 0);
  assert.deepEqual(h.sent, []);
  h.setError(null);
  h.repository.setTaskSyncSessionReady(true);
  await until(() => h.state().pendingOps.length === 0);
  assert.deepEqual(h.sent, ['first', 'second']);
});

test('confirmed offline state never starts a remote task recovery', async () => {
  const h = setup();
  h.repository.setTaskSyncOnline(false);
  const tasks = await h.repository.pullRemoteTasks();
  assert.equal(h.remoteLoads(), 0);
  assert.equal(tasks.length, 1);
  assert.equal(h.observed().pulling, false);
});

test('losing connectivity aborts an active task synchronization', async () => {
  const h = setup();
  let signal;
  h.setSyncImplementation(async (userId, operation, options) => {
    signal = options.signal;
    await new Promise(() => {});
  });
  const syncing = h.repository.syncPendingTasks();
  await until(() => Boolean(signal));
  h.repository.setTaskSyncOnline(false);
  await assert.rejects(syncing, error => error.name === 'AbortError');
  assert.equal(signal.aborted, true);
  assert.equal(h.observed().sending, false);
  assert.equal(h.state().pendingOps.length, 2);
});

test('rapid reconnection starts a new FIFO attempt and ignores the cancelled send result', async () => {
  const h = setup();
  const attempted = [];
  let finishCancelled;
  let finishRetried;
  h.setSyncImplementation(async (_userId, op) => {
    attempted.push(op.id);
    const attempt = attempted.length;
    if (attempt === 1) await new Promise(resolve => { finishCancelled = resolve; });
    if (attempt === 2) await new Promise(resolve => { finishRetried = resolve; });
  });
  const sending = h.repository.syncPendingTasks();
  await until(() => Boolean(finishCancelled));
  h.repository.setTaskSyncOnline(false);
  h.repository.setTaskSyncOnline(true);
  await assert.rejects(sending, { code: 'SYNC_CANCELLED' });
  await until(() => Boolean(finishRetried));
  finishCancelled();
  await new Promise(setImmediate);
  assert.deepEqual(h.state().pendingOps.map(op => op.id), ['first', 'second']);
  finishRetried();
  await until(() => h.observed().sendConfirmed);
  assert.deepEqual(attempted, ['first', 'first', 'second']);
});

test('online transient failure retries automatically and drains the FIFO queue', async () => {
  const h = setup();
  h.setError({ status: 503 });
  h.repository.setTaskSyncOnline(false);
  h.repository.setTaskSyncOnline(true);
  await until(() => h.sent.length === 1);
  h.repository.setTaskSyncOnline(true);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(h.sent.length, 1);
  h.setError(null);
  await new Promise(resolve => setTimeout(resolve, 5_150));
  await until(() => h.state().pendingOps.length === 0);
  assert.deepEqual(h.sent, ['first', 'first', 'second']);
  assert.equal(h.observed().sendConfirmed, true);
});

test('online permanent rejection does not enter an automatic retry loop', async () => {
  const h = setup();
  h.repository.setTaskSyncOnline(false);
  h.repository.setTaskSyncOnline(true);
  await until(() => h.sent.length === 1);
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.deepEqual(h.sent, ['first']);
  assert.equal(h.state().pendingOps[0].sync.state, 'blocked');
  await h.repository.updateTaskAndLoadTasks('a', { title: 'Nova alteração local' });
  h.repository.resumeTaskSync();
  await until(() => !h.observed().sending);
  assert.deepEqual(h.sent, ['first']);
  assert.equal(h.state().pendingOps.length, 3);
});

test('a hung transport preserves local edits and retries the queue in order', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date() });
  let finishOldSession;
  const h = setup();
  h.setSyncImplementation(async (_userId, operation) => {
    if (!finishOldSession) {
      await new Promise(resolve => { finishOldSession = resolve; });
      return;
    }
    h.sent.push(operation.id);
  });
  h.setError(null);
  const sending = h.repository.syncPendingTasks();
  await until(() => Boolean(finishOldSession));
  await h.repository.updateTaskAndLoadTasks('a', { title: 'Guardada localmente' });
  const pendingIds = h.state().pendingOps.map(op => op.id);
  t.mock.timers.tick(60_000);
  await assert.rejects(sending, { code: 'SYNC_TIMEOUT' });
  assert.equal(h.observed().sending, false);
  assert.equal(h.state().tasks[0].title, 'Guardada localmente');
  assert.deepEqual(h.state().pendingOps.map(op => op.id), pendingIds);
  assert.deepEqual(h.sent, []);

  t.mock.timers.tick(5_000);
  await until(() => h.observed().sendConfirmed);
  assert.deepEqual(h.sent, pendingIds);
  finishOldSession();
  await new Promise(setImmediate);
  assert.deepEqual(h.sent, pendingIds);
  assert.equal(h.state().pendingOps.length, 0);
});

test('a hung remote read times out and retries independently of a completed send', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finishOldRead;
  let firstSignal;
  const recovered = model.createTask({ id: 'fresh', title: 'Fresh read' });
  const late = model.createTask({ id: 'late', title: 'Late response' });
  const h = setup({
    loadRemote: async (_userId, signal) => {
      if (firstSignal) return [recovered];
      firstSignal = signal;
      return new Promise(resolve => { finishOldRead = resolve; });
    },
  });
  h.setError(null);
  const pulling = h.repository.pullRemoteTasks();
  await until(() => Boolean(finishOldRead));
  assert.equal(await h.repository.syncPendingTasks(), 2);
  t.mock.timers.tick(60_000);
  await assert.rejects(pulling, { code: 'SYNC_TIMEOUT' });
  assert.equal(firstSignal.aborted, true);
  assert.equal(h.observed().pulling, false);

  t.mock.timers.tick(5_000);
  await until(() => h.observed().pullConfirmed && !h.observed().pulling);
  finishOldRead([late]);
  await new Promise(setImmediate);
  assert.deepEqual(h.state().tasks.map(task => task.id), ['a', 'fresh']);
  assert.equal(h.remoteLoads(), 2);
});

test('foreground rechecks the FIFO head after an auth failure with existing connectivity', async () => {
  const h = setup();
  h.setError({ status: 401 });
  await assert.rejects(h.repository.syncPendingTasks(), { status: 401 });
  h.setError(null);
  h.repository.resumeTaskSync();
  await until(() => h.observed().sendConfirmed);
  assert.deepEqual(h.sent, ['first', 'first', 'second']);
});

test('a token renewal during an in-flight 401 is picked up without another session event', async () => {
  const h = setup();
  const attempted = [];
  let rejectFirst;
  h.setSyncImplementation(async (_userId, op) => {
    attempted.push(op.id);
    if (attempted.length === 1) await new Promise((_, reject) => { rejectFirst = reject; });
  });
  const sending = h.repository.syncPendingTasks();
  await until(() => Boolean(rejectFirst));
  h.repository.setTaskSyncSessionReady(true);
  rejectFirst({ status: 401 });
  await assert.rejects(sending, { status: 401 });
  await until(() => h.observed().sendConfirmed);
  assert.deepEqual(attempted, ['first', 'first', 'second']);
});

function setupPull() {
  let state = { tasks: [model.createTask({ id: 'a', title: 'Original' })], pendingOps: [] };
  let readWaiting = false, releaseRead, authListener;
  const auth = {
    onAuthStateChange: listener => { authListener = listener; },
  };
  // Execute the actual synchronous identity tracker, without creating a client.
  const lib = read('lib/supabase.js');
  const tracker = lib.slice(lib.indexOf('// Track identity'), lib.indexOf('// Sync queries'));
  const getSessionIdentity = new Function('supabase', `${tracker.replace(/export const /g, 'const ')};return getSessionIdentity;`)({ auth });
  const emit = (event, userId) => authListener(event, userId ? { user: { id: userId } } : null);
  emit('INITIAL_SESSION', 'u');
  const names = ['normalizeTask', 'normalizeTasks', 'updateTaskModel', 'toggleTaskCompletion', 'discardUnownedTaskState', 'loadState', 'persistState', 'loadRemoteTasks', 'supabase', 'getSessionIdentity', 'syncOperation', 'classifyTaskSyncError', 'updateTaskSyncStatus', 'console'];
  const values = [model.normalizeTask, model.normalizeTasks, model.updateTask, model.toggleTaskCompletion,
    async () => {}, async () => structuredClone(state), async (_userId, next) => (state = structuredClone(next)),
    async () => {
      if (!readWaiting) {
        readWaiting = true;
        await new Promise(resolve => { releaseRead = resolve; });
      }
      return [model.createTask({ id: 'remote', title: 'Remote' })];
    }, { auth }, getSessionIdentity,
    async () => {}, classifyTaskSyncError, () => {}, { warn() {}, log() {} }];
  const diagnostics = loadDiagnostics();
  const repository = new Function(...names, ...diagnosticsExports, `${repositorySource};return { pullRemoteTasks, createTaskAndLoadTasks, updateTaskAndLoadTasks, deleteTask, setTaskSyncOnline };`)(...values, ...diagnosticsExports.map(name => diagnostics[name]));
  return { repository, emit, identity: getSessionIdentity, waiting: () => readWaiting,
    release: () => releaseRead(), state: () => state };
}

const until = async predicate => {
  for (let i = 0; i < 300; i += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw Error('Expected condition not reached');
};

for (const action of ['create', 'update', 'delete']) {
  test(`P1: ${action} completes while the remote read is suspended`, async () => {
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

test('P1: switching accounts during a read rejects the old response', async () => {
  const h = setupPull();
  const pull = h.repository.pullRemoteTasks();
  await until(h.waiting);
  h.emit('SIGNED_OUT', null);
  h.emit('SIGNED_IN', 'other-account');
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

test('going offline during a read invalidates a late response', async () => {
  const h = setupPull();
  const pulling = h.repository.pullRemoteTasks();
  await until(h.waiting);
  h.repository.setTaskSyncOnline(false);
  await assert.rejects(pulling, { code: 'SYNC_CANCELLED' });
  h.release();
  await new Promise(setImmediate);
  assert.deepEqual(h.state().tasks.map(task => task.id), ['a']);
});

test('each task has its own deadline and creation sends its final schedule', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date() });
  const h = setup({ withPendingOperations: false });
  const sent = [];
  h.setSyncImplementation(async (_id, operation) => { sent.push(operation); });
  const flush = () => new Promise(setImmediate);
  await h.repository.createTaskAndLoadTasks({ id: 'run', title: 'Correr', startTime: '17:00' });
  await flush();
  t.mock.timers.tick(2_000);
  await h.repository.updateTaskAndLoadTasks('a', { title: 'Compras' });
  await flush();
  t.mock.timers.tick(2_000);
  await h.repository.updateTaskAndLoadTasks('run', { startTime: '18:00', durationMinutes: 60 });
  await flush();
  assert.equal(h.state().pendingOps.length, 2);
  t.mock.timers.tick(8_000);
  await flush();
  assert.deepEqual(sent.map(op => op.task.id), ['a']);
  t.mock.timers.tick(2_000);
  await flush();
  assert.deepEqual(sent.map(op => op.type), ['update', 'create']);
  assert.equal(sent[1].task.startTime, '18:00');
  assert.equal(sent[1].task.durationMinutes, 60);
  assert.equal(h.state().pendingOps.length, 0);
});

test('offline compacted operations survive restart and have a capped deadline', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date() });
  const h = setup({ withPendingOperations: false });
  h.repository.setTaskSyncOnline(false);
  const first = Date.now();
  await h.repository.updateTaskAndLoadTasks('a', { title: 'First' });
  for (let i = 0; i < 6; i += 1) {
    t.mock.timers.tick(4_000);
    await h.repository.updateTaskAndLoadTasks('a', { title: `Edit ${i}` });
  }
  const state = h.state();
  assert.equal(state.pendingOps.length, 1);
  assert.equal(state.pendingOps[0].sendAfter, first + 30_000);
  const restarted = setup({ initialState: state });
  restarted.setError(null);
  assert.equal(await restarted.repository.syncPendingTasks(), 0);
  t.mock.timers.tick(6_000);
  await until(() => restarted.observed().sendConfirmed);
  assert.equal(restarted.sent.length, 1);
  assert.equal(restarted.state().tasks[0].title, 'Edit 5');
});

test('started operations stay immutable and a never-sent creation can be cancelled', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date() });
  const h = setup({ withPendingOperations: false });
  let finish;
  const flush = () => new Promise(setImmediate);
  h.setSyncImplementation(async (_id, op) => {
    if (op.type === 'create') await new Promise(resolve => { finish = resolve; });
  });
  await h.repository.createTaskAndLoadTasks({ id: 'discard', title: 'Discard' });
  await h.repository.deleteTask('discard');
  assert.equal(h.state().pendingOps.length, 0);
  await h.repository.createTaskAndLoadTasks({ id: 'run', title: 'Original' });
  await flush();
  t.mock.timers.tick(10_000);
  await until(() => Boolean(finish));
  const [started] = h.state().pendingOps;
  assert.ok(started.startedAt);
  await h.repository.updateTaskAndLoadTasks('run', { title: 'Final' });
  assert.deepEqual(h.state().pendingOps.map(op => [op.type, op.task.title]), [
    ['create', 'Original'], ['update', 'Final'],
  ]);
  finish();
  await flush();
  assert.deepEqual(h.state().pendingOps.map(op => op.type), ['update']);
});
