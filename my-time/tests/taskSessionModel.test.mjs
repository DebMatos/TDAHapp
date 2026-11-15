import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/domain/taskSessionModel.js', import.meta.url), 'utf8');
const names = ['normalizeTaskSession', 'createTaskSession', 'stopTaskSession', 'getSessionDurationMs', 'getTaskDurationMs'];
const transformed = source.replaceAll('export const ', 'const ') + '\n' + names.map(name => `globalThis.${name} = ${name};`).join('\n');
const context = vm.createContext({ Date, TypeError, RangeError, Error });
vm.runInContext(transformed, context);
const { createTaskSession, stopTaskSession, getSessionDurationMs, getTaskDurationMs, normalizeTaskSession } = context;

test('cria uma sessão aberta e termina-a sem alterar o início', () => {
  const started = createTaskSession({ id: 's1', taskId: 't1', startedAt: '2026-11-15T14:12:00Z' });
  assert.equal(started.endedAt, null);
  const finished = stopTaskSession(started, '2026-11-15T14:32:00Z');
  assert.equal(finished.startedAt, started.startedAt);
  assert.equal(finished.endedAt, '2026-11-15T14:32:00.000Z');
  assert.equal(started.endedAt, null);
  assert.equal(getSessionDurationMs(finished), 20 * 60 * 1000);
});

test('soma várias sessões e exclui outras tarefas', () => {
  const sessions = [
    { id: 's1', taskId: 't1', startedAt: '2026-11-15T14:12:00Z', endedAt: '2026-11-15T14:32:00Z' },
    { id: 's2', taskId: 't1', startedAt: '2026-11-15T14:40:00Z', endedAt: null },
    { id: 's3', taskId: 't2', startedAt: '2026-11-15T14:00:00Z', endedAt: null },
  ];
  assert.equal(getTaskDurationMs(sessions, 't1', '2026-11-15T14:55:00Z'), 35 * 60 * 1000);
});

test('rejeita datas inválidas e fim anterior ao início', () => {
  assert.throws(() => normalizeTaskSession({ id: 's1', taskId: 't1', startedAt: 'invalid' }), /startedAt/);
  const session = createTaskSession({ id: 's1', taskId: 't1', startedAt: '2026-11-15T14:12:00Z' });
  assert.throws(() => stopTaskSession(session, '2026-11-15T14:00:00Z'), /anterior/);
  assert.throws(() => stopTaskSession(stopTaskSession(session, '2026-11-15T14:20:00Z')), /já terminou/);
});

test('sessões ativas não produzem duração negativa', () => {
  const session = createTaskSession({ id: 's1', taskId: 't1', startedAt: '2026-11-15T14:12:00Z' });
  assert.equal(getSessionDurationMs(session, '2026-11-15T14:10:00Z'), 0);
});
