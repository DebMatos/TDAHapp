import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/utils/time.js', import.meta.url), 'utf8')
  .replace(
    "import { DAY_MINUTES, SNAP_MINUTES, TIMELINE_START_MINUTES } from '../constants/timeline';",
    'const DAY_MINUTES = 1440, SNAP_MINUTES = 5, TIMELINE_START_MINUTES = 420;'
  );
const { getDraggedTimelineStart } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

test('dragging to midnight snaps to 00:00 in the 07:00-based timeline', () => {
  assert.equal(getDraggedTimelineStart(23 * 60, 60 * 1.25, 1.25, 30), 0);
  assert.equal(getDraggedTimelineStart(23 * 60, 65 * 1.25, 1.25, 30), 5);
});

test('midnight and early hours remain inside the visual timeline', () => {
  assert.equal(getDraggedTimelineStart(0, 0, 1.25, 30), 0);
  assert.equal(getDraggedTimelineStart(0, -5 * 1.25, 1.25, 30), 23 * 60 + 55);
  assert.equal(getDraggedTimelineStart(0, 60 * 1.25, 1.25, 30), 60);
});

test('visual boundaries respect task duration rather than civil midnight', () => {
  assert.equal(getDraggedTimelineStart(7 * 60, -1000, 1.25, 30), 7 * 60);
  assert.equal(getDraggedTimelineStart(6 * 60, 1000, 1.25, 30), 6 * 60 + 30);
});

test('dragging and snapping use the current zoom scale', () => {
  assert.equal(getDraggedTimelineStart(9 * 60, 10 * 1.75, 1.75, 30), 9 * 60 + 10);
  assert.equal(getDraggedTimelineStart(9 * 60, 10 * 0.75, 0.75, 30), 9 * 60 + 10);
});
