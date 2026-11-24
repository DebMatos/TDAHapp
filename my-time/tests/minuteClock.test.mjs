import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/utils/minuteClock.js', import.meta.url), 'utf8');
const clock = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('aligns updates with the next real minute boundary', () => {
  assert.equal(clock.getDelayUntilNextMinute(Date.parse('2026-11-22T12:00:10.250Z')), 49_750);
  assert.equal(clock.getDelayUntilNextMinute(Date.parse('2026-11-22T12:01:00.000Z')), 60_000);
});

test('recalculates immediately on foreground and reschedules from the current time', () => {
  let timestamp = Date.parse('2026-11-22T12:00:10.000Z');
  let appStateListener;
  const ticks = [];
  const timers = [];
  const cleared = [];

  const stop = clock.startMinuteClock({
    onTick: (value) => ticks.push(value),
    now: () => timestamp,
    setTimer: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimer: (id) => cleared.push(id),
    subscribeAppState: (listener) => {
      appStateListener = listener;
      return { remove: () => {} };
    },
  });

  assert.deepEqual(ticks, [timestamp]);
  assert.equal(timers.at(-1).delay, 50_000);

  timestamp = Date.parse('2026-11-22T13:05:42.000Z');
  appStateListener('active');
  assert.equal(ticks.at(-1), timestamp);
  assert.equal(timers.at(-1).delay, 18_000);
  assert.ok(cleared.includes(1));

  stop();
});
