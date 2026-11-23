import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../src/utils/taskCountdown.js', import.meta.url),
  'utf8',
);
const { formatTaskCountdown, getContextualTaskCountdown } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

const task = (overrides) => ({
  id: 'task',
  date: '2026-11-22',
  startTime: '12:00',
  durationMinutes: 30,
  status: 'pending',
  ...overrides,
});

test('selects only the next pending task and ignores finished states', () => {
  const result = getContextualTaskCountdown([
    task({ id: 'completed', startTime: '11:00', status: 'completed' }),
    task({ id: 'later', startTime: '13:00' }),
    task({ id: 'next', startTime: '12:15' }),
  ], new Date('2026-11-22T12:00:00'));

  assert.deepEqual(result, {
    taskId: 'next',
    phase: 'upcoming',
    minutes: 15,
    label: 'em 15 min',
  });
});

test('keeps the same task while now is inside its planned block', () => {
  const result = getContextualTaskCountdown([
    task({ id: 'current', startTime: '11:50', durationMinutes: 30 }),
    task({ id: 'next', startTime: '12:30' }),
  ], new Date('2026-11-22T12:00:30'));

  assert.deepEqual(result, {
    taskId: 'current',
    phase: 'current',
    minutes: 20,
    label: 'faltam 20 min',
  });
});

test('moves to the following task when the current planned block ends', () => {
  const result = getContextualTaskCountdown([
    task({ id: 'ended', startTime: '11:30', durationMinutes: 30 }),
    task({ id: 'next', startTime: '12:10' }),
  ], new Date('2026-11-22T12:00:00'));

  assert.equal(result.taskId, 'next');
  assert.equal(result.label, 'em 10 min');
});

test('formats longer waits and singular remaining time naturally', () => {
  assert.equal(formatTaskCountdown(75, 'upcoming'), 'daqui a 1h 15m');
  assert.equal(formatTaskCountdown(120, 'upcoming'), 'daqui a 2h');
  assert.equal(formatTaskCountdown(1, 'current'), 'falta 1 min');
});

test('returns no countdown when no pending task remains', () => {
  assert.equal(getContextualTaskCountdown([
    task({ status: 'completed' }),
    task({ id: 'past', startTime: '10:00', durationMinutes: 30 }),
  ], new Date('2026-11-22T12:00:00')), null);
});

test('home assigns the countdown to one matching card and hides it off today', () => {
  const home = fs.readFileSync(new URL('../src/screens/Home/HomeScreen.js', import.meta.url), 'utf8');
  const card = fs.readFileSync(new URL('../src/components/TaskCardClean.js', import.meta.url), 'utf8');

  assert.match(home, /isViewingToday\s*\? getContextualTaskCountdown\(visibleTasks, now\)/);
  assert.match(home, /contextualCountdown\?\.taskId === task\.id \? contextualCountdown : null/);
  assert.match(card, /countdown\.phase === 'current'/);
  assert.match(card, /countdownAccessibility/);
});
