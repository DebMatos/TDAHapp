import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
const load = code => import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const plan = await load(source('services/taskReminderPlan.js'));
const dates = await load(source('utils/taskDateInput.js'));
const code = source('services/taskReminders.native.js').replace(/^import [\s\S]*?;\n/gm, '').replace(/export /g, '');

test('holds one reminder per task, reconciles settings and applies one offline action', async () => {
  let task = { id: 'a', date: '2090-03-10', startTime: '15:00', durationMinutes: 30, status: 'pending', title: 'Estudar Go' };
  let auth;
  let listener;
  let background;
  const scheduled = new Map();
  const settings = new Map();
  let writes = 0;
  const context = {
    ...plan, ...dates,
    AsyncStorage: { getItem: async key => settings.get(key), setItem: async (key, value) => settings.set(key, value) },
    AppState: { currentState: 'active', addEventListener() {} }, Platform: { OS: 'android' },
    Notifications: {
      AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
      setNotificationHandler() {}, addNotificationReceivedListener() {},
      addNotificationResponseReceivedListener: fn => { listener = fn; },
      registerTaskAsync: async () => {},
      getPermissionsAsync: async () => ({ granted: true }),
      getExactAlarmPermissionsAsync: async () => ({ granted: true }),
      requestExactAlarmPermissionsAsync: async () => ({ granted: true }),
      getAllScheduledNotificationsAsync: async () => [...scheduled.values()],
      cancelScheduledNotificationAsync: async id => scheduled.delete(id),
      getPresentedNotificationsAsync: async () => [], dismissNotificationAsync: async () => {},
      setNotificationChannelAsync: async () => {},
      setNotificationCategoryAsync: async (_, actions) => {
        assert.deepEqual(actions.map(action => [action.buttonTitle, action.options.opensAppToForeground]),
          [['+5 min', false], ['+15 min', false], ['+30 min', false]]);
      },
      scheduleNotificationAsync: async request => {
        const identifier = request.content.data.key;
        scheduled.set(identifier, { ...request, identifier });
      },
    },
    TaskManager: { defineTask: (_, fn) => { background = fn; }, isTaskRegisteredAsync: async () => false },
    supabase: { auth: { onAuthStateChange: fn => { auth = fn; } } },
    setTaskRepositoryUser() {}, subscribeTasks() {},
    loadTasksSnapshot: async () => ({ tasks: task ? [task] : [] }),
    updateTaskFromReminder: async (user, id, build) => {
      assert.equal(user, 'user');
      assert.equal(id, task.id);
      const changes = build(task);
      if (changes) { writes++; task = { ...task, ...changes, updatedAt: String(writes) }; }
    },
    formatTimeFromMinutes: minutes => [Math.floor(minutes / 60), minutes % 60].map(value => String(value).padStart(2, '0')).join(':'),
  };
  const api = new Function(...Object.keys(context), code + '\nreturn { refreshTaskReminders, saveReminderPreferences, readReminderPreferences };')(...Object.values(context));
  const at = time => new Date('2090-03-10T' + time + ':00').getTime();
  const only = () => { assert.equal(scheduled.size, 1); return [...scheduled.values()][0]; };
  auth('INITIAL_SESSION', { user: { id: 'user' } });
  await api.refreshTaskReminders();
  assert.equal(only().trigger.date, at('14:45'));
  await api.saveReminderPreferences({ enabled: true, lead: 5 });
  assert.equal(only().trigger.date, at('14:55'));
  await api.saveReminderPreferences({ enabled: false, lead: 5 });
  assert.equal(scheduled.size, 0);
  assert.deepEqual(await api.readReminderPreferences(), { enabled: false, lead: 5, unit: 'minutes' });
  await api.saveReminderPreferences({ enabled: true, lead: 5 });
  for (const [actionIdentifier, startTime, fireAt] of [
    ['5', '15:05', '15:00'], ['15', '15:20', '15:15'], ['30', '15:50', '15:45'],
  ]) {
    const response = { actionIdentifier, notification: { request: only() } };
    listener(response);
    await background({ data: response });
    assert.equal(task.startTime, startTime);
    assert.equal(task.durationMinutes, 30);
    assert.equal(only().trigger.date, at(fireAt));
  }
  assert.equal(writes, 3);
  const stale = only();
  task = { ...task, startTime: '16:00' };
  await background({ data: { actionIdentifier: '15', notification: { request: stale } } });
  assert.equal(writes, 3);
  assert.equal(only().trigger.date, at('15:55'));
  await api.saveReminderPreferences({ enabled: true, lead: 2880, unit: 'days' });
  assert.deepEqual(await api.readReminderPreferences(), { enabled: true, lead: 2880, unit: 'days' });
  assert.equal(only().trigger.date, at('16:00') - 2880 * 60_000);
  assert.match(only().content.body, /2 dias/);
  task = { ...task, status: 'completed' };
  await api.refreshTaskReminders();
  assert.equal(scheduled.size, 0);
});

test('validates manual amounts and preserves the chosen representation on reload', () => {
  for (const [amount, unit, lead] of [
    ['25', 'minutes', 25], ['3', 'hours', 180], ['2', 'days', 2880],
  ]) {
    assert.equal(plan.reminderLeadFromInput(amount, unit), lead);
    assert.deepEqual(plan.normalizeReminderPreferences({ enabled: false, lead, unit }), { enabled: false, lead, unit });
  }
  for (const amount of ['', '0', '-1', '1.5', '1e3', '9999999999999999999']) {
    assert.equal(plan.reminderLeadFromInput(amount, 'minutes'), null);
  }
  assert.deepEqual(plan.normalizeReminderPreferences(null), { enabled: true, lead: 15, unit: 'minutes' });
  assert.deepEqual(plan.normalizeReminderPreferences({ lead: 60 }), { enabled: true, lead: 60, unit: 'hours' });
  assert.equal(plan.normalizeReminderPreferences({ lead: 0 }).lead, 0);
});

test('past alerts are skipped and postponement crosses midnight as a civil schedule', () => {
  const task = { date: '2090-12-31', startTime: '23:55', durationMinutes: 30, status: 'pending' };
  assert.equal(plan.reminderPlan(task, 15, new Date('2090-12-31T23:50:00').getTime(), 'user', 'kind'), null);
  assert.deepEqual(dates.postponeSchedule('31/12/2090', '23:55', 15), { date: '01/01/2091', startMinutes: 10 });
});

test('planned notification diagnostics keep task and planned timestamps', () => {
  const task = {
    id: 'diagnostic', title: 'Teste', date: '2090-03-10', startTime: '15:00',
    durationMinutes: 30, status: 'pending', updatedAt: '1',
  };
  const result = plan.reminderPlan(task, 15, 0, 'user', 'kind');
  assert.equal(result.taskId, 'diagnostic');
  assert.equal(result.plannedAt, '2090-03-10T15:00:00');
  assert.equal(result.content.data.plannedAt, result.plannedAt);
  assert.equal(result.content.data.fireAt, result.fireAt);
});

test('Android does not apply the iOS pending-notification safety limit', () => {
  assert.match(code, /Platform\.OS === 'ios' \? plans\.slice\(0, 60\) : plans/);
});

test('service checks and requests exact alarms after notification permission', async () => {
  let exactGranted = false;
  let exactRequests = 0;
  const context = {
    ...plan, ...dates,
    AsyncStorage: { getItem: async () => null, setItem: async () => {} },
    AppState: { currentState: 'active', addEventListener() {} }, Platform: { OS: 'android' },
    Notifications: {
      AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
      setNotificationHandler() {}, addNotificationReceivedListener() {},
      addNotificationResponseReceivedListener() {}, setNotificationChannelAsync: async () => {},
      getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
      requestPermissionsAsync: async () => ({ granted: true }),
      getExactAlarmPermissionsAsync: async () => ({ granted: exactGranted }),
      requestExactAlarmPermissionsAsync: async () => { exactRequests++; exactGranted = true; },
      getAllScheduledNotificationsAsync: async () => [], getPresentedNotificationsAsync: async () => [],
      setNotificationCategoryAsync: async () => {}, scheduleNotificationAsync: async () => 'id',
    },
    TaskManager: { defineTask() {}, isTaskRegisteredAsync: async () => true },
    supabase: { auth: { onAuthStateChange() {} } }, setTaskRepositoryUser() {}, subscribeTasks() {},
    loadTasksSnapshot: async () => ({ tasks: [] }), updateTaskFromReminder: async () => {},
  };
  const api = new Function(...Object.keys(context), code +
    '\nreturn { getReminderPermission, requestReminderPermission };')(...Object.values(context));
  assert.equal(await api.getReminderPermission(), 'exact');
  await api.requestReminderPermission();
  assert.equal(exactRequests, 1);
  assert.equal(await api.getReminderPermission(), 'granted');
});
