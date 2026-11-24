import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../src/utils/taskCountdown.js', import.meta.url),
  'utf8',
);
const { formatTaskCountdown, getContextualTaskCountdowns } = await import(
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

test('selects the closest future pending task and ignores finished states', () => {
  const result = getContextualTaskCountdowns([
    task({ id: 'completed', startTime: '11:00', status: 'completed' }),
    task({ id: 'later', startTime: '13:00' }),
    task({ id: 'next', startTime: '12:15' }),
  ], new Date('2026-11-22T12:00:00'));

  assert.deepEqual(result, [{
    taskId: 'next',
    phase: 'upcoming',
    minutes: 15,
    label: 'daqui a 15 min',
  }]);
});

test('returns current and closest future tasks at the same time', () => {
  const result = getContextualTaskCountdowns([
    task({ id: 'current', startTime: '11:50', durationMinutes: 30 }),
    task({ id: 'next', startTime: '12:30' }),
  ], new Date('2026-11-22T12:00:30'));

  assert.deepEqual(result, [
    { taskId: 'current', phase: 'current', minutes: 20, label: '20 min' },
    { taskId: 'next', phase: 'upcoming', minutes: 30, label: 'daqui a 30 min' },
  ]);
});

test('moves to the following task when the current planned block ends', () => {
  const result = getContextualTaskCountdowns([
    task({ id: 'ended', startTime: '11:30', durationMinutes: 30 }),
    task({ id: 'next', startTime: '12:10' }),
  ], new Date('2026-11-22T12:00:00'));

  assert.equal(result[0].taskId, 'next');
  assert.equal(result[0].label, 'daqui a 10 min');
});

test('formats both phases with the same minute notation', () => {
  assert.equal(formatTaskCountdown(75, 'upcoming'), 'daqui a 1h 15 min');
  assert.equal(formatTaskCountdown(120, 'upcoming'), 'daqui a 2h');
  assert.equal(formatTaskCountdown(75, 'current'), '1h 15 min');
  assert.equal(formatTaskCountdown(1, 'current'), '1 min');
});

test('a newly started task becomes current while the next future task advances', () => {
  const result = getContextualTaskCountdowns([
    task({ id: 'earlier', startTime: '11:45', durationMinutes: 60 }),
    task({ id: 'new-current', startTime: '12:00', durationMinutes: 30 }),
    task({ id: 'next', startTime: '12:20' }),
  ], new Date('2026-11-22T12:00:00'));

  assert.deepEqual(result.map(({ taskId, phase }) => ({ taskId, phase })), [
    { taskId: 'new-current', phase: 'current' },
    { taskId: 'next', phase: 'upcoming' },
  ]);
});

test('returns no countdown when no pending task remains', () => {
  assert.deepEqual(getContextualTaskCountdowns([
    task({ status: 'completed' }),
    task({ id: 'past', startTime: '10:00', durationMinutes: 30 }),
  ], new Date('2026-11-22T12:00:00')), []);
});

test('home assigns the countdown to one matching card and hides it off today', () => {
  const home = fs.readFileSync(new URL('../src/screens/Home/HomeScreen.js', import.meta.url), 'utf8');
  const card = fs.readFileSync(new URL('../src/components/TaskCardClean.js', import.meta.url), 'utf8');

  assert.match(home, /isViewingToday\s*\? getContextualTaskCountdowns\(visibleTasks, now\)/);
  assert.match(home, /contextualCountdowns\.find\(\(item\) => item\.taskId === task\.id\)/);
  assert.match(card, /countdown\.phase === 'current'/);
  assert.match(card, /name="hourglass-outline"/);
  assert.match(card, /countdownAccessibility/);
});
