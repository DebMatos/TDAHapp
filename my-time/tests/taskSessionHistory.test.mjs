import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const modelSource = fs.readFileSync(new URL('../src/domain/taskSessionModel.js', import.meta.url), 'utf8');
const model = await import(`data:text/javascript;base64,${Buffer.from(modelSource).toString('base64')}`);
const historySource = fs.readFileSync(new URL('../src/utils/taskSessionHistory.js', import.meta.url), 'utf8')
  .replace(/import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?/, '')
  .replace(/export const /g, 'const ');
const history = new Function(
  'getSessionDurationMs',
  'getTaskDurationMs',
  `${historySource}; return { buildTaskSessionHistory, formatTrackingMinutes, getTrackingComparisonLabel };`,
)(model.getSessionDurationMs, model.getTaskDurationMs);

test('history deduplicates sessions and includes a running session in the dynamic total', () => {
  const sessions = [
    { id: 'a', taskId: 't1', startedAt: '2026-11-19T20:00:00.000Z', endedAt: '2026-11-19T20:15:00.000Z' },
    { id: 'a', taskId: 't1', startedAt: '2026-11-19T20:00:00.000Z', endedAt: '2026-11-19T20:15:00.000Z' },
    { id: 'b', taskId: 't1', startedAt: '2026-11-19T20:30:00.000Z', endedAt: null },
    { id: 'other', taskId: 't2', startedAt: '2026-11-19T20:00:00.000Z', endedAt: null },
  ];
  const result = history.buildTaskSessionHistory(sessions, 't1', '2026-11-19T20:43:00.000Z');
  assert.equal(result.sessions.length, 2);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].sessions[1].endLabel, 'Em curso');
  assert.equal(result.groups[0].sessions[0].durationMinutes, 15);
  assert.equal(result.groups[0].sessions[1].durationMinutes, 13);
  assert.equal(result.totalMinutes, 28);
});

test('duration and completed comparison use natural Portuguese copy', () => {
  assert.equal(history.formatTrackingMinutes(80), '1 h 20 min');
  assert.equal(history.getTrackingComparisonLabel(28, 80), '52 min abaixo do previsto');
  assert.equal(history.getTrackingComparisonLabel(95, 80), '15 min acima do previsto');
  assert.equal(history.getTrackingComparisonLabel(80, 80), 'Dentro do previsto');
});
