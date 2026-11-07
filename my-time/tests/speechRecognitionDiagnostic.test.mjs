import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/screens/speechRecognitionDiagnostic.js', import.meta.url), 'utf8');
const { createSpeechDiagnostic, localePresence } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function harness(overrides = {}) {
  const listeners = new Map();
  const calls = { starts: [], aborts: 0, stops: 0, queries: [], permissions: 0 };
  const logs = [];
  let state;
  const speech = {
    addListener: (name, handler) => {
      listeners.set(name, handler);
      return { remove: () => listeners.delete(name) };
    },
    getSpeechRecognitionServices: () => ['test.samsung', 'test.other'],
    getDefaultRecognitionService: () => ({ packageName: 'test.samsung' }),
    isRecognitionAvailable: () => true,
    getSupportedLocales: async options => {
      calls.queries.push(options);
      return { locales: ['pt-PT', 'pt-BR'], installedLocales: ['pt-BR'] };
    },
    requestMicrophonePermissionsAsync: async () => {
      calls.permissions++;
      return { granted: true };
    },
    start: options => calls.starts.push(options),
    stop: () => calls.stops++,
    abort: () => calls.aborts++,
    ...overrides,
  };
  const controller = createSpeechDiagnostic(speech, next => { state = next; }, entry => logs.push(entry));
  return { controller, calls, listeners, logs, state: () => state, emit: (name, body) => listeners.get(name)?.(body) };
}

test('queries the default package and separates supported from installed languages', async () => {
  const h = harness();
  try {
    await h.controller.refresh(35);
    assert.deepEqual(h.calls.queries, [{ androidRecognitionServicePackage: 'test.samsung' }]);
    const d = h.state().diagnostics;
    assert.equal(d.defaultService, 'test.samsung');
    assert.equal(d.available, true);
    assert.equal(localePresence(d.locales, 'pt-PT'), 'Sim');
    assert.equal(localePresence(d.installedLocales, 'pt-PT'), 'Não consta da lista devolvida');
    assert.equal(localePresence(['PT_pt'], 'pt-PT'), 'Sim');
  } finally { h.controller.dispose(); }
});

test('an inconclusive query does not block either requested language or force a service/offline mode', async () => {
  for (const lang of ['pt-PT', 'pt-BR']) {
    const h = harness({ getSupportedLocales: async () => { throw Error('not implemented'); } });
    try {
      await h.controller.refresh(35);
      assert.equal(localePresence(h.state().diagnostics.locales, lang), 'Não foi possível determinar');
      await h.controller.start(lang);
      assert.equal(h.calls.permissions, 1);
      assert.equal(h.calls.starts[0].lang, lang);
      assert.equal(h.calls.starts[0].requiresOnDeviceRecognition, false);
      assert.equal(h.calls.starts[0].recordingOptions.persist, false);
      assert.equal('androidRecognitionServicePackage' in h.calls.starts[0], false);
    } finally { h.controller.dispose(); }
  }
});

test('old Android and empty query responses remain unknown', async () => {
  const h = harness();
  try {
    await h.controller.refresh(32);
    assert.equal(h.calls.queries.length, 0);
    assert.equal(localePresence([], 'pt-PT'), 'Não foi possível determinar');
    assert.equal(localePresence(h.state().diagnostics.locales, 'pt-PT'), 'Não foi possível determinar');
  } finally { h.controller.dispose(); }
});

test('denied permission never starts audio and reports a recoverable error', async () => {
  const h = harness({ requestMicrophonePermissionsAsync: async () => ({ granted: false, canAskAgain: false }) });
  try {
    await h.controller.start('pt-PT');
    assert.equal(h.calls.starts.length, 0);
    assert.equal(h.calls.aborts, 0);
    assert.equal(h.state().status, 'erro');
    assert.equal(h.state().busy, false);
    assert.match(h.state().error, /Definições/);
  } finally { h.controller.dispose(); }
});

test('prevents duplicate starts and prevents a late permission response starting after disposal', async () => {
  let resolvePermission;
  const h = harness({ requestMicrophonePermissionsAsync: () => new Promise(resolve => { resolvePermission = resolve; }) });
  const first = h.controller.start('pt-PT');
  await h.controller.start('pt-BR');
  h.controller.dispose();
  resolvePermission({ granted: true });
  await first;
  assert.equal(h.calls.starts.length, 0);
  assert.equal(h.listeners.size, 0);
});

test('listening, stop, final result and end produce a completed per-language result', async () => {
  const h = harness();
  try {
    await h.controller.start('pt-PT');
    h.emit('start');
    assert.equal(h.state().status, 'a ouvir');
    h.emit('result', { isFinal: false, results: [{ transcript: 'Amanhã' }] });
    h.controller.stop();
    assert.equal(h.calls.stops, 1);
    assert.equal(h.state().status, 'a processar');
    h.emit('audioend');
    h.emit('result', { isFinal: true, results: [{ transcript: 'Amanhã às dez.' }] });
    h.emit('end');
    assert.equal(h.state().status, 'concluído');
    assert.equal(h.state().busy, false);
    assert.equal(h.state().results['pt-PT'], 'Amanhã às dez.');
    await h.controller.start('pt-BR');
    h.emit('error', { error: 'language-not-supported', message: 'real service error' });
    h.emit('end');
    assert.equal(h.state().status, 'erro');
    assert.match(h.state().error, /language-not-supported.*\nreal service error/);
    assert.equal(h.state().results['pt-PT'], 'Amanhã às dez.');
  } finally { h.controller.dispose(); }
});

test('partial text without a final result is not reported as completed', async () => {
  const h = harness();
  try {
    await h.controller.start('pt-PT');
    h.emit('result', { isFinal: false, results: [{ transcript: 'parcial' }] });
    h.emit('end');
    assert.equal(h.state().status, 'erro');
    assert.equal(h.state().transcript, 'parcial');
    assert.deepEqual(h.state().results, {});
  } finally { h.controller.dispose(); }
});

test('explicit cancellation invalidates permission requests and active sessions are aborted on disposal', async () => {
  let resolvePermission;
  const pending = harness({ requestMicrophonePermissionsAsync: () => new Promise(resolve => { resolvePermission = resolve; }) });
  const start = pending.controller.start('pt-PT');
  pending.controller.cancel();
  resolvePermission({ granted: true });
  await start;
  assert.equal(pending.calls.starts.length, 0);
  pending.controller.dispose();
  const active = harness();
  await active.controller.start('pt-PT');
  active.controller.dispose();
  assert.equal(active.calls.aborts, 1);
  assert.equal(active.listeners.size, 0);
});

test('temporary background/focus transitions during permission do not cancel the requested test', async () => {
  let resolvePermission;
  const h = harness({ requestMicrophonePermissionsAsync: () => new Promise(resolve => { resolvePermission = resolve; }) });
  try {
    h.controller.observeAppState('initial', 'active');
    const start = h.controller.start('pt-PT');
    h.controller.observeAppState('blur');
    h.controller.observeAppState('change', 'background');
    resolvePermission({ granted: true, status: 'granted', canAskAgain: true });
    await start;
    h.controller.observeAppState('change', 'active');
    h.controller.observeAppState('focus');
    h.emit('start');
    assert.equal(h.calls.starts.length, 1);
    assert.equal(h.calls.aborts, 0);
    assert.equal(h.state().status, 'a ouvir');
    const background = h.logs.find(log => log.event === 'appstate.change' && log.value === 'background');
    assert.equal(background.permissionPending, true);
    assert.equal(background.action, 'observe-only');
    assert.equal(h.logs.some(log => log.event === 'command.cancel'), false);
  } finally { h.controller.dispose(); }
});

test('temporary background while listening preserves the final result and excludes transcript text from logs', async () => {
  const h = harness();
  try {
    await h.controller.start('pt-PT');
    h.emit('start');
    h.emit('audiostart');
    h.controller.observeAppState('blur');
    h.controller.observeAppState('change', 'background');
    h.controller.observeAppState('change', 'active');
    h.controller.observeAppState('focus');
    h.emit('result', { isFinal: true, results: [{ transcript: 'texto privado de teste' }] });
    h.emit('end');
    assert.equal(h.calls.aborts, 0);
    assert.equal(h.state().status, 'concluído');
    assert.equal(h.state().results['pt-PT'], 'texto privado de teste');
    assert.equal(JSON.stringify(h.logs).includes('texto privado de teste'), false);
    assert.ok(h.logs.every((log, index) => log.sequence === index + 1 && log.timestamp && log.session));
  } finally { h.controller.dispose(); }
});

test('a real service error after background is preserved, including native code, without an app cancellation', async () => {
  const h = harness();
  try {
    await h.controller.start('pt-PT');
    h.emit('start');
    h.controller.observeAppState('change', 'background');
    h.emit('error', { error: 'client', code: 5, message: 'Connection to speech recognition service lost' });
    h.controller.observeAppState('change', 'active');
    h.emit('end');
    assert.equal(h.calls.aborts, 0);
    assert.equal(h.state().status, 'erro');
    assert.match(h.state().error, /Connection to speech recognition service lost/);
    const error = h.logs.find(log => log.event === 'recognition.error');
    assert.equal(error.nativeCode, 5);
    assert.equal(error.abortReason, null);
    assert.equal(h.logs.some(log => log.event === 'command.cancel'), false);
  } finally { h.controller.dispose(); }
});

test('an app abort is attributed to explicit cancellation and its aborted event does not overwrite the cause', async () => {
  const h = harness();
  try {
    await h.controller.start('pt-PT');
    h.emit('start');
    h.controller.cancel();
    h.emit('error', { error: 'aborted', code: -1, message: 'Speech recognition aborted.' });
    h.emit('end');
    assert.match(h.state().error, /cancelado explicitamente/);
    const abort = h.logs.find(log => log.event === 'command.abort');
    assert.equal(abort.reason, 'explicit-cancel');
    const event = h.logs.find(log => log.event === 'recognition.error');
    assert.equal(event.abortReason, 'explicit-cancel');
    assert.equal(event.ignored, true);
  } finally { h.controller.dispose(); }
});

test('a service that never answers the locale query times out as unknown', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness({ getSupportedLocales: () => new Promise(() => {}) });
  try {
    const refresh = h.controller.refresh(35);
    t.mock.timers.tick(10000);
    await refresh;
    assert.equal(h.state().diagnostics.loading, false);
    assert.equal(localePresence(h.state().diagnostics.locales, 'pt-PT'), 'Não foi possível determinar');
    assert.match(h.state().diagnostics.notes[0], /10 segundos/);
    await h.controller.start('pt-PT');
    assert.equal(h.calls.starts.length, 1);
  } finally { h.controller.dispose(); }
});

test('a service that never starts releases the controls and cancels native recognition', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  try {
    await h.controller.start('pt-PT');
    t.mock.timers.tick(15000);
    assert.equal(h.state().status, 'erro');
    assert.equal(h.state().busy, false);
    assert.equal(h.calls.aborts, 1);
  } finally { h.controller.dispose(); }
});
