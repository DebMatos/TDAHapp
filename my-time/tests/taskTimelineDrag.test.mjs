import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/utils/time.js', import.meta.url), 'utf8')
  .replace(
    "import { DAY_MINUTES, SNAP_MINUTES, TIMELINE_START_MINUTES } from '../constants/timeline';",
    'const DAY_MINUTES = 1440, SNAP_MINUTES = 5, TIMELINE_START_MINUTES = 420;'
  );
const { getDraggedTimelinePosition, getDraggedTimelineStart } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

test('dragging to midnight preserves minute precision outside the magnet', () => {
  assert.equal(getDraggedTimelineStart(23 * 60, 60 * 1.25, 1.25, 30), 0);
  assert.equal(getDraggedTimelineStart(23 * 60, 67 * 1.25, 1.25, 30), 7);
  assert.equal(getDraggedTimelineStart(23 * 60, 72 * 1.25, 1.25, 30), 12);
});

test('midnight and early hours remain inside the visual timeline', () => {
  assert.equal(getDraggedTimelineStart(0, 0, 1.25, 30), 0);
  assert.equal(getDraggedTimelineStart(0, -5 * 1.25, 1.25, 30), 0);
  assert.equal(getDraggedTimelineStart(0, 60 * 1.25, 1.25, 30), 60);
});

test('visual boundaries respect task duration rather than civil midnight', () => {
  assert.equal(getDraggedTimelineStart(7 * 60, -1000, 1.25, 30), 7 * 60);
  assert.equal(getDraggedTimelineStart(6 * 60, 1000, 1.25, 30), 6 * 60 + 30);
});

test('dragging and snapping use the current zoom scale', () => {
  assert.equal(getDraggedTimelineStart(9 * 60, 12 * 1.75, 1.75, 30), 9 * 60 + 12);
  assert.equal(getDraggedTimelineStart(9 * 60, 12 * 0.75, 0.75, 30), 9 * 60 + 12);
});

test('magnetic attraction prefers full and half hours without blocking free minutes', () => {
  assert.deepEqual(getDraggedTimelinePosition(18 * 60 + 55, 4 * 1.25, 1.25, 30), {
    minute: 19 * 60,
    isMagnetized: true,
    magnetMinute: 19 * 60,
    suppressedMagnetMinute: null,
  });
  assert.deepEqual(getDraggedTimelinePosition(18 * 60 + 55, 12 * 1.25, 1.25, 30), {
    minute: 19 * 60 + 7,
    isMagnetized: false,
    magnetMinute: null,
    suppressedMagnetMinute: null,
  });
});

test('magnetic tolerance stays visual across zoom levels', () => {
  assert.equal(getDraggedTimelinePosition(9 * 60, 8, 0.75, 30).isMagnetized, true);
  assert.equal(getDraggedTimelinePosition(9 * 60, 8, 1.75, 30).isMagnetized, true);
  assert.equal(getDraggedTimelinePosition(9 * 60, 12, 0.75, 30).isMagnetized, false);
  assert.equal(getDraggedTimelinePosition(9 * 60, 12, 1.75, 30).isMagnetized, false);
});

test('hysteresis keeps the same magnet until the pointer clearly leaves it', () => {
  const entered = getDraggedTimelinePosition(9 * 60, 8, 1, 30);
  const held = getDraggedTimelinePosition(9 * 60, 14, 1, 30, entered.magnetMinute);
  const released = getDraggedTimelinePosition(9 * 60, 15, 1, 30, entered.magnetMinute);

  assert.equal(entered.isMagnetized, true);
  assert.equal(held.minute, 9 * 60);
  assert.equal(held.isMagnetized, true);
  assert.equal(released.minute, 9 * 60 + 15);
  assert.equal(released.isMagnetized, false);
  assert.equal(released.suppressedMagnetMinute, 9 * 60);
});

test('moving through a magnet allows returning to any nearby minute', () => {
  const entered = getDraggedTimelinePosition(18 * 60 + 55, 4 * 1.25, 1.25, 30);
  const released = getDraggedTimelinePosition(
    18 * 60 + 55,
    17 * 1.25,
    1.25,
    30,
    entered.magnetMinute,
  );
  const precise = getDraggedTimelinePosition(
    18 * 60 + 55,
    12 * 1.25,
    1.25,
    30,
    released.magnetMinute,
    released.suppressedMagnetMinute,
  );

  assert.equal(precise.minute, 19 * 60 + 7);
  assert.equal(precise.isMagnetized, false);
});

test('preview and persisted drag paths use the same minute result', () => {
  const position = getDraggedTimelinePosition(18 * 60 + 55, 12 * 1.25, 1.25, 30);
  assert.equal(getDraggedTimelineStart(18 * 60 + 55, 12 * 1.25, 1.25, 30), position.minute);
});

test('task card reports the same preview position that it persists', () => {
  const card = fs.readFileSync(new URL('../src/components/TaskCardClean.js', import.meta.url), 'utf8');
  const home = fs.readFileSync(new URL('../src/screens/Home/HomeScreen.js', import.meta.url), 'utf8');

  assert.match(card, /onDragPreview\?\.\(position\)/);
  assert.match(card, /onChangeStart\(task\.id, position\.minute\)/);
  assert.match(home, /formatTimeFromMinutes\(dragPreview\.minute\)/);
  assert.match(home, /styles\.dragTargetLineMagnetized/);
});
