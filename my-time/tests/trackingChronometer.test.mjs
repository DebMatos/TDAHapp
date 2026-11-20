import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/utils/trackingChronometer.js', import.meta.url), 'utf8');
const chronometer = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('formats elapsed time as total minutes and seconds beyond one hour', () => {
  assert.equal(chronometer.formatChronometerDuration(5_000), '00:05');
  assert.equal(chronometer.formatChronometerDuration((75 * 60 + 32) * 1000), '75:32');
});

test('active session is recalculated from timestamps on every observation', () => {
  const sessions = [{
    id: 'active',
    taskId: 't1',
    startedAt: '2026-11-20T10:00:00.000Z',
    endedAt: null,
  }];
  assert.equal(chronometer.getChronometerDurationMs(sessions, 't1', '2026-11-20T10:00:10.000Z'), 10_000);
  assert.equal(chronometer.getChronometerDurationMs(sessions, 't1', '2026-11-20T10:00:20.000Z'), 20_000);
});

test('paused session freezes and resumed session continues the accumulated total', () => {
  const paused = [{
    id: 'first',
    taskId: 't1',
    startedAt: '2026-11-20T10:00:00.000Z',
    endedAt: '2026-11-20T10:00:10.000Z',
  }];
  assert.equal(chronometer.getChronometerDurationMs(paused, 't1', '2026-11-20T10:05:00.000Z'), 10_000);

  const resumed = [...paused, {
    id: 'second',
    taskId: 't1',
    startedAt: '2026-11-20T10:05:00.000Z',
    endedAt: null,
  }];
  assert.equal(chronometer.getChronometerDurationMs(resumed, 't1', '2026-11-20T10:05:07.000Z'), 17_000);
});
