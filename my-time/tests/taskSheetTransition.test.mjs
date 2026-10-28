import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(new URL('../package.json', import.meta.url));
const parser = require('@babel/parser');
const read = path => fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const moduleFromSource = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const dates = await moduleFromSource(read('utils/taskDateInput.js'));
const constants = await moduleFromSource(read('constants/timeline.js'));
const time = await moduleFromSource(read('utils/time.js').replace(/import[^;]+;/,
  `const DAY_MINUTES=${constants.DAY_MINUTES};const SNAP_MINUTES=${constants.SNAP_MINUTES};`));
const source = read('components/modals/CreateTaskModal.js');
const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
const walk = (node, fn) => {
  if (!node || typeof node !== 'object') return;
  fn(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, fn));
    else if (value && typeof value === 'object') walk(value, fn);
  }
};
const expression = (name, code = source) => {
  let result;
  walk(code === source ? ast : parser.parse(code, { sourceType: 'module', plugins: ['jsx'] }), node => {
    if (node.type === 'VariableDeclarator' && node.id?.name === name) result = code.slice(node.init.start, node.init.end);
  });
  assert.ok(result, name);
  return result;
};
const handler = (name, context) => new Function('context', `with(context){return ${expression(name)}}`)(context);
function setup() {
  const events = { expanded: [], closed: 0, saved: [], resets: 0, editor: false };
  const context = {
    title: ' Rascunho ', description: ' Notas sem perda ', duration: 45, categoryId: 'shopping', priority: 'high',
    initialMinutes: 90, dateValue: '31/12/2026', isDateValid: true, isBusy: false, isHandleActive: false, windowHeight: 780, TASK_DETAILS_HEIGHT_RATIO: 0.78,
    transitioned: { current: false }, handleDragged: { current: false }, sheetHeight: { current: 280 },
    dragOriginHeight: { current: 280 }, animatedHeight: { setValue() {} }, translateY: { setValue() {} },
    gestureActions: { current: null }, activeAnimation: { current: null },
    setIsHandleActive: value => { events.handleActive = value; }, useCallback: fn => fn,
    ...dates, formatTimeFromMinutes: time.formatTimeFromMinutes, TIMELINE_START_MINUTES: 420,
    Keyboard: { dismiss() {} }, setIsTransitioning: value => { events.transitioning = value; }, setIsSaving() {},
    setDateEditorVisible: value => { events.editor = value; }, resetDrag: () => { events.resets++; },
    onExpand: draft => events.expanded.push(draft), onClose: () => { events.closed++; },
    onSave: async task => events.saved.push(task),
    Animated: {
      timing: () => ({ start: callback => callback({ finished: true }) }),
      parallel: () => ({ start: callback => callback({ finished: true }) }),
    },
  };
  context.stopSheetAnimation = handler('stopSheetAnimation', context);
  context.startSheetAnimation = handler('startSheetAnimation', context);
  return { context, events };
}

test('expanding transfers every draft field without saving or trimming text, only once', () => {
  const { context, events } = setup();
  const expand = handler('handleExpand', context);
  expand(); expand();
  assert.equal(events.saved.length, 0);
  assert.equal(events.expanded.length, 1);
  assert.deepEqual(events.expanded[0], { title: ' Rascunho ', notes: ' Notas sem perda ', date: '2026-12-31', startTime: '01:30', durationMinutes: 45, categoryId: 'shopping', priority: 'high' });
});

test('direct create uses the chosen civil date and slot time', async () => {
  const { context, events } = setup();
  await handler('handleSave', context)();
  assert.equal(events.saved.length, 1);
  assert.equal(events.saved[0].date, '2026-12-31');
  assert.equal(events.saved[0].startTime, '01:30');
});

test('invalid date blocks both save and expand, opens correction field and resets drag', async () => {
  const { context, events } = setup();
  context.dateValue = '31/02/2026'; context.isDateValid = false;
  await handler('handleSave', context)();
  handler('handleExpand', context)();
  assert.equal(events.saved.length, 0); assert.equal(events.expanded.length, 0);
  assert.equal(events.editor, true); assert.equal(events.resets, 1);
  assert.equal(context.transitioned.current, false);
});

test('handle captures immediately, routes up/down and restores short/cancelled drags', () => {
  const { context, events } = setup();
  context.PanResponder = { create: callbacks => callbacks };
  context.useMemo = factory => factory();
  context.handleExpand = handler('handleExpand', context);
  context.closeFromDrag = handler('closeFromDrag', context);
  context.gestureActions.current = {
    isBusy: false, expand: context.handleExpand, close: context.closeFromDrag,
    reset: context.resetDrag, windowHeight: 780,
  };
  const pan = handler('handlePanResponder', context);
  assert.equal(pan.onStartShouldSetPanResponder(), true);
  assert.equal(pan.onStartShouldSetPanResponderCapture(), true);
  assert.equal(pan.onMoveShouldSetPanResponder(null, { dx: 2, dy: -20 }), true);
  pan.onPanResponderGrant();
  assert.equal(context.handleDragged.current, true);
  pan.onPanResponderRelease(null, { dy: -20, vy: -2 });
  pan.onPanResponderTerminate();
  assert.equal(events.resets, 2);
  pan.onPanResponderRelease(null, { dy: -60, vy: 0 });
  assert.equal(events.expanded.length, 1);
  const closing = setup();
  handler('closeFromDrag', closing.context)();
  assert.equal(closing.events.closed, 1); assert.equal(closing.events.saved.length, 0);
});

test('Home expansion opens create details using the draft without a repository call', () => {
  const home = read('screens/Home/HomeScreen.js');
  let code;
  walk(parser.parse(home, { sourceType: 'module', plugins: ['jsx'] }), node => {
    if (node.type === 'JSXAttribute' && node.name.name === 'onExpand') code = home.slice(node.value.expression.start, node.value.expression.end);
  });
  const events = {};
  const expand = new Function('setTaskError', 'setDetailsMode', 'setDetailsTask', 'setModalVisible', 'setDetailsFromQuick', `return ${code}`)(
    value => { events.error = value; }, value => { events.mode = value; }, value => { events.task = value; }, value => { events.visible = value; }, value => { events.embedded = value; });
  const draft = { title: 'Raw draft', date: '2026-12-31', startTime: '01:30' };
  expand(draft);
  assert.equal(events.embedded, true); assert.equal(events.mode, 'create'); assert.equal(events.task, draft); assert.equal(events.visible, false);
});

test('date validation, shortcuts and conversion handle leap days and civil dates in different timezones', () => {
  assert.equal(dates.isValidDateInput('29/02/2028'), true);
  assert.equal(dates.isValidDateInput('29/02/2026'), false);
  assert.equal(dates.formatDateInput('31122026'), '31/12/2026');
  assert.equal(dates.addDaysToDateInput('31/12/2026', 1), '01/01/2027');
  for (const TZ of ['Europe/Lisbon', 'America/Sao_Paulo']) {
    const helperSource = read('utils/taskDateInput.js');
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', `${helperSource}\nconsole.log(formatDateForInput('2026-12-31'));`], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.equal(result.trim(), '31/12/2026');
  }
});

test('gesture handlers are attached only to Quick Create handle and old adornments are gone', () => {
  const hosts = [];
  walk(ast, node => {
    if (node.type === 'JSXOpeningElement' && node.attributes.some(attr => attr.type === 'JSXSpreadAttribute' && source.slice(attr.argument.start, attr.argument.end) === 'handlePanResponder.panHandlers')) hosts.push(node);
  });
  assert.equal(hosts.length, 1); assert.equal(hosts[0].name.name, 'View');
  assert.equal(source.includes('dots-horizontal'), false);
  assert.equal(source.includes('saveBee'), false);
  assert.equal(source.includes('abelha.png'), false);
});

test('Home initial civil date follows the timeline slot across midnight and year boundary', async () => {
  const dateUtils = await moduleFromSource(read('utils/date.js'));
  const timeline = await moduleFromSource(read('utils/timelineDate.js').replace(/import[\s\S]*?;/,
    `const TIMELINE_START_HOUR=${constants.TIMELINE_START_HOUR};const TIMELINE_START_MINUTES=${constants.TIMELINE_START_MINUTES};`));
  const home = read('screens/Home/HomeScreen.js');
  let code;
  walk(parser.parse(home, { sourceType: 'module', plugins: ['jsx'] }), node => {
    if (node.type === 'JSXAttribute' && node.name.name === 'initialDate') code = home.slice(node.value.expression.start, node.value.expression.end);
  });
  const initial = new Function('getDateKey', 'getCivilDateForTimelineSlot', 'selectedTimelineDate', 'targetSlotMinutes', 'TIMELINE_START_MINUTES', `return ${code}`);
  assert.equal(initial(dateUtils.getDateKey, timeline.getCivilDateForTimelineSlot, new Date(2026, 11, 31), 90, 420), '2027-01-01');
  assert.equal(initial(dateUtils.getDateKey, timeline.getCivilDateForTimelineSlot, new Date(2026, 11, 31), 540, 420), '2026-12-31');
});

test('expansion animates to Details height before transferring the draft', () => {
  const { context, events } = setup();
  let finish;
  const targets = [];
  context.Animated.timing = (value, config) => { targets.push(config.toValue); return {}; };
  context.Animated.parallel = () => ({ start: callback => { finish = callback; } });
  handler('handleExpand', context)();
  assert.equal(events.expanded.length, 0);
  assert.equal(context.transitioned.current, true);
  assert.ok(targets.includes(Math.round(780 * 0.78)));
  finish({ finished: true });
  assert.equal(events.expanded.length, 1);
});

test('stable handle responder reads latest actions and immediately grows the sheet with the finger', () => {
  const { context } = setup();
  let active, expanded = false, height;
  context.setIsHandleActive = value => { active = value; };
  context.animatedHeight.setValue = value => { height = value; };
  context.PanResponder = { create: callbacks => callbacks };
  context.useMemo = factory => factory();
  context.gestureActions.current = { isBusy: false, windowHeight: 780, expand() {}, close() {}, reset() {} };
  const pan = handler('handlePanResponder', context);
  assert.equal(pan.onStartShouldSetPanResponderCapture(), true);
  pan.onPanResponderGrant();
  assert.equal(active, true);
  pan.onPanResponderMove(null, { dy: -100 });
  assert.equal(height, 380);
  context.gestureActions.current = { ...context.gestureActions.current, expand: () => { expanded = true; } };
  pan.onPanResponderRelease(null, { dy: -100, dx: 0 });
  assert.equal(expanded, true);
});

test('Quick Create keeps the arrow submit button in the options row, without a text submit label', () => {
  assert.ok(source.includes("'arrow-up'"));
  assert.equal(source.includes('saveRow'), false);
  assert.equal(source.includes('saveButtonText'), false);
  assert.ok(source.includes('expandedContent ||'));
  const details = read('components/modals/TaskDetailsModal.js');
  assert.ok(details.includes('if (embedded) return visible ? content : null'));
  assert.ok(details.includes('autoFocus={!embedded}'));
});

// Completion is manually controlled so cancellation and delayed callbacks are observable.
function deferredAnimations(context) {
  const animations = [];
  const make = () => {
    const animation = {
      stops: 0,
      start(callback) { this.callback = callback; },
      stop() { this.stops++; this.callback?.({ finished: false }); },
      finish(finished = true) { this.callback?.({ finished }); },
    };
    animations.push(animation);
    return animation;
  };
  context.Animated = { timing: make, spring: make, parallel: make };
  return animations;
}
const evaluate = (code, context) => new Function('context', `with(context){return ${code}}`)(context);
function layoutEffect(code) {
  let callback;
  walk(parser.parse(code, { sourceType: 'module', plugins: ['jsx'] }), node => {
    if (node.type === 'CallExpression' && node.callee?.name === 'useLayoutEffect') {
      const body = code.slice(node.arguments[0].start, node.arguments[0].end);
      if (body.includes('stopSheetAnimation')) callback = body;
    }
  });
  assert.ok(callback, 'animation lifecycle effect'); return callback;
}

test('Quick Create layout and transform animations never promote their shared style graph to native', () => {
  let count = 0;
  walk(ast, node => {
    if (node.type !== 'CallExpression' || node.callee?.object?.name !== 'Animated' || !['timing', 'spring'].includes(node.callee.property?.name)) return;
    const driver = node.arguments[1].properties.find(p => p.key?.name === 'useNativeDriver');
    assert.equal(driver?.value.value, false, source.slice(node.start, node.end)); count++;
  });
  assert.equal(count, 5);
});

test('interrupted expansion unlocks Quick Create and permits a new attempt without saving', () => {
  const { context, events } = setup(); const animations = deferredAnimations(context);
  const expand = handler('handleExpand', context);
  expand(); animations.at(-1).finish(false);
  assert.equal(context.transitioned.current, false);
  assert.equal(events.transitioning, false); assert.equal(events.handleActive, false);
  assert.equal(events.expanded.length, 0);
  expand(); animations.at(-1).finish();
  assert.equal(events.expanded.length, 1); assert.equal(events.saved.length, 0);
});

test('dismissing Quick Create cancels expansion and ignores even a delayed successful callback', () => {
  const { context, events } = setup(); const animations = deferredAnimations(context);
  handler('handleExpand', context)(); const expansion = animations.at(-1);
  handler('dismissQuickCreate', context)();
  assert.equal(expansion.stops, 1); assert.equal(events.closed, 1);
  expansion.finish(); assert.equal(events.expanded.length, 0);
});

test('hiding, switching content or unmounting Quick Create invalidates the active callback', () => {
  for (const state of [{ visible: false, expandedContent: null }, { visible: true, expandedContent: {} }, null]) {
    const { context, events } = setup(); const animations = deferredAnimations(context);
    handler('handleExpand', context)(); const expansion = animations.at(-1);
    if (state) evaluate(layoutEffect(source), { ...context, ...state })();
    else evaluate(layoutEffect(source), { ...context, visible: true, expandedContent: null })()();
    expansion.finish();
    assert.equal(expansion.stops, 1); assert.equal(events.expanded.length, 0);
  }
});

test('a new gesture cancels rebound without allowing its callback to deactivate the new handle', () => {
  const { context, events } = setup(); const animations = deferredAnimations(context);
  handler('resetDrag', context)(); const rebound = animations.at(-1);
  context.PanResponder = { create: callbacks => callbacks }; context.useMemo = factory => factory();
  const pan = handler('handlePanResponder', context);
  pan.onPanResponderGrant(); rebound.finish();
  assert.equal(rebound.stops, 1); assert.equal(events.handleActive, true);
});

const detailsSource = read('components/modals/TaskDetailsModal.js');
const detailsHandler = (name, context) => evaluate(expression(name, detailsSource), context);
function detailsAnimationSetup() {
  const events = { closed: 0, expanded: false };
  const value = initial => ({ current: initial, setValue(next) { this.current = next; }, stopAnimation(callback) { callback(this.current); } });
  const context = {
    activeAnimation: { current: null }, useCallback: fn => fn, useMemo: fn => fn(),
    sheetHeight: value(500), sheetBottom: value(0), dragStartHeightRef: { current: 0 },
    MIN_SHEET_HEIGHT: 260, NORMAL_SHEET_HEIGHT: 608, EXPANDED_SHEET_HEIGHT: 733,
    keyboardHeight: 0, isExpanded: false, PanResponder: { create: x => x },
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    setIsExpanded: v => { events.expanded = v; }, setKeyboardHeight() {},
    setActiveField() {}, setPostponeSelection() {}, setSavedSnapshot() {},
    onClose: () => { events.closed++; },
  };
  const animations = deferredAnimations(context);
  context.stopSheetAnimation = detailsHandler('stopSheetAnimation', context);
  context.animateGeometry = detailsHandler('animateGeometry', context);
  context.animateSheetTo = detailsHandler('animateSheetTo', context);
  context.closeFromDrag = detailsHandler('closeFromDrag', context);
  return { context, animations, events };
}

test('Details interrupted close never dismisses; a completed close dismisses exactly once', () => {
  const { context, animations, events } = detailsAnimationSetup();
  context.closeFromDrag(); animations.at(-1).finish(false);
  assert.equal(events.closed, 0);
  context.closeFromDrag(); const close = animations.at(-1); close.finish(); close.finish();
  assert.equal(events.closed, 1); assert.equal(context.sheetHeight.current, 608);
});

test('Details new gesture cancels closing, ignores the old completion and starts at the current height', () => {
  const { context, animations, events } = detailsAnimationSetup();
  context.closeFromDrag(); const close = animations.at(-1);
  const pan = detailsHandler('sheetPanResponder', context); pan.onPanResponderGrant();
  close.finish();
  assert.equal(close.stops, 1); assert.equal(events.closed, 0);
  assert.equal(context.dragStartHeightRef.current, 500);
  pan.onPanResponderMove(null, { dy: -20 }); assert.equal(context.sheetHeight.current, 520);
});

test('Details keyboard adjustment cancels previous closing without executing its callback', () => {
  const { context, animations, events } = detailsAnimationSetup();
  context.closeFromDrag(); const close = animations.at(-1);
  context.animateGeometry(608, 250); close.finish();
  assert.equal(close.stops, 1); assert.equal(events.closed, 0);
  assert.notEqual(context.activeAnimation.current, close);
});

test('Details cleanup prevents a closing callback from affecting a hidden or reopened sheet', () => {
  const { context, animations, events } = detailsAnimationSetup();
  context.closeFromDrag(); const close = animations.at(-1);
  evaluate(layoutEffect(detailsSource), { ...context, visible: false })();
  close.finish(); assert.equal(events.closed, 0); assert.equal(close.stops, 1);
  evaluate(layoutEffect(detailsSource), { ...context, visible: true })();
  close.finish(); assert.equal(events.closed, 0); assert.equal(context.sheetHeight.current, 608);
});
