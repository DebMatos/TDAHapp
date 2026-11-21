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

function setup({ withPendingOperations = true, diagnosticsEnabled, getSession } = {}) {
  const task = model.createTask({ id: 'a', title: 'A', notes: 'private note' });
  let state = { tasks: [task], pendingOps: withPendingOperations ? [
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
  const names = ['normalizeTask', 'normalizeTasks', 'updateTaskModel', 'toggleTaskCompletion', 'loadState', 'persistState', 'loadRemoteTasks', 'supabase', 'getSessionIdentity', 'syncOperation', 'classifyTaskSyncError', 'updateTaskSyncStatus', 'console'];
  const values = [model.normalizeTask, model.normalizeTasks, model.updateTask, model.toggleTaskCompletion,
    async () => structuredClone(state), async next => { if (failStorage) throw Error('disk'); state = structuredClone(next); return state; },
    async () => { remoteLoads += 1; return []; }, { auth: { getSession: getSession ?? (async () => ({ data: { session: { user: { id: 'u' } } } })) } },
    () => ({ userId: 'u', revision: 0 }),
    (...args) => syncImplementation(...args), classifyTaskSyncError,
    status.updateTaskSyncStatus, { warn() {}, log() {} }];
  const repositorySource = stripImports(read('data/taskRepository.js'))
    .replace('let syncOnline = null;', 'let syncOnline = true;')
    .replace('let syncSessionReady = false;', 'let syncSessionReady = true;');
  const diagnostics = loadDiagnostics(diagnosticsEnabled);
  const repository = new Function(...names, ...diagnosticsExports, `${repositorySource}; return { syncPendingTasks, syncOperationWithTimeout, setTaskSyncOnline, setTaskSyncSessionReady, pullRemoteTasks, loadTasksSnapshot, updateTaskAndLoadTasks };`)(...values, ...diagnosticsExports.map(name => diagnostics[name]));
  return { repository, sent, state: () => state, observed: () => observed, status, diagnostics,
    setError: value => { error = value; },
    setSyncImplementation: value => { syncImplementation = value; },
    remoteLoads: () => remoteLoads,
    failStorage: () => { failStorage = true; } };
}

test('diagnostics expose an unfinished session check while local edits continue', async () => {
  let resolveSession;
  const h = setup({
    diagnosticsEnabled: true,
    withPendingOperations: false,
    getSession: () => new Promise(resolve => { resolveSession = resolve; }),
  });
  let history;
  const unsubscribe = h.diagnostics.subscribeTaskSyncDiagnostics(entries => { history = entries; });
  const firstRun = h.repository.syncPendingTasks();
  await h.repository.updateTaskAndLoadTasks('a', { title: 'private edit' });
  h.repository.setTaskSyncOnline(false);
  h.repository.setTaskSyncOnline(true, 'Primeiro plano', { isConnected: true, isInternetReachable: true });

  const waiting = history.find(entry => entry.phase === 'send-session');
  assert.equal(waiting.outcome, 'pending');
  assert.equal(history[0].state.syncRequested, true);
  assert.equal(history[0].state.syncPromise, true);
  assert.equal(history.find(entry => entry.phase === 'queue').pending, 1);
  assert.deepEqual(h.sent, []);

  const operationId = h.state().pendingOps[0].id;
  h.setSyncImplementation(async (_userId, _operation, { reportHttp }) => {
    reportHttp(403);
    throw { code: '42501', message: 'private server error' };
  });
  resolveSession({ data: { session: { user: { id: 'u' } } } });
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

test('local update enters the shared queue and reaches the remote sync operation', async () => {
  const h = setup({ withPendingOperations: false });
  let sentOperation;
  h.setError(null);
  h.setSyncImplementation(async (userId, operation) => {
    sentOperation = structuredClone(operation);
  });
  await h.repository.updateTaskAndLoadTasks('a', { title: 'Alterada' });
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
  const diagnostics = loadDiagnostics();
  const repository = new Function(...names, ...diagnosticsExports, `${stripImports(read('data/taskRepository.js'))};return { pullRemoteTasks, createTaskAndLoadTasks, updateTaskAndLoadTasks, deleteTask };`)(...values, ...diagnosticsExports.map(name => diagnostics[name]));
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
