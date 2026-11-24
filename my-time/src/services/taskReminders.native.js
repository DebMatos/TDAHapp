import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../lib/supabase';
import {
  loadTasksSnapshot, setTaskRepositoryUser, subscribeTasks, updateTaskFromReminder,
} from '../data/taskRepository';
import { formatTimeFromMinutes } from '../utils/time';
import { dateInputToStorageDate, formatDateForInput, postponeSchedule } from '../utils/taskDateInput';
import { normalizeReminderPreferences, reminderPlan, reminderVersion } from './taskReminderPlan';

const category = 'mytime-task-reminder';
const channel = 'task-reminders';
const backgroundTask = 'mytime-reminder-action';
const preferenceKey = 'mytime:task-reminder-preferences';
const actions = [5, 15, 30];
let owner;
let resolveIdentity;
const identityReady = new Promise(resolve => { resolveIdentity = resolve; });
let queue = Promise.resolve();
const report = () => console.warn('[Notificações] Não foi possível processar os avisos.');
const serialize = operation => {
  const result = queue.then(operation);
  queue = result.catch(report);
  return result;
};

export const remindersSupported = true;
export async function readReminderPreferences() {
  const stored = JSON.parse(await AsyncStorage.getItem(preferenceKey) ?? 'null');
  return normalizeReminderPreferences(stored);
}

const configureChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channel, {
      name: 'Avisos de tarefas',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
};

export const getReminderPermission = async () => {
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted ? 'granted' : permission.canAskAgain ? 'ask' : 'blocked';
};

export const requestReminderPermission = async () => {
  await configureChannel();
  await Notifications.requestPermissionsAsync();
  await refreshTaskReminders();
  return getReminderPermission();
};

const isReminder = request => request.content.data?.kind === category;

async function reconcile() {
  if (owner === undefined) return;
  const userId = owner;
  const preferences = await readReminderPreferences();
  const granted = preferences.enabled && await getReminderPermission() === 'granted';
  const tasks = userId && granted ? (await loadTasksSnapshot()).tasks : [];
  const desired = new Map(tasks.map(task => reminderPlan(task, preferences.lead, Date.now(), userId, category))
    .filter(Boolean).sort((a, b) => a.fireAt - b.fireAt).slice(0, 60).map(plan => [plan.key, plan]));
  if (userId !== owner) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of scheduled.filter(isReminder)) {
    if (desired.delete(request.content.data.key)) continue;
    await Notifications.cancelScheduledNotificationAsync(request.identifier);
  }
  const presented = await Notifications.getPresentedNotificationsAsync();
  const valid = new Set(tasks.filter(task => task.status === 'pending')
    .map(task => reminderVersion(task)));
  for (const { request } of presented) {
    if (isReminder(request) && (request.content.data.userId !== userId ||
        !valid.has(request.content.data.version) || request.content.data.lead !== preferences.lead)) {
      await Notifications.dismissNotificationAsync(request.identifier);
    }
  }
  if (desired.size === 0 || userId !== owner) return;
  await configureChannel();
  await Notifications.setNotificationCategoryAsync(category, actions.map(minutes => ({
    identifier: String(minutes), buttonTitle: `+${minutes} min`,
    options: { opensAppToForeground: false },
  })));
  for (const plan of desired.values()) {
    if (owner !== userId) return;
    if (plan.fireAt <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      content: plan.content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.fireAt, channelId: channel },
    });
  }
}

export const refreshTaskReminders = () => serialize(reconcile);
export const saveReminderPreferences = preferences => serialize(async () => {
  await AsyncStorage.setItem(preferenceKey, JSON.stringify(preferences));
  await reconcile();
});

async function handleResponse(response) {
  const request = response?.notification?.request;
  const data = request?.content?.data;
  const minutes = actions.find(value => String(value) === response?.actionIdentifier);
  if (data?.kind !== category || !minutes) return;
  await identityReady;
  await serialize(async () => {
    const preferences = await readReminderPreferences();
    if (!owner || owner !== data.userId || !preferences.enabled || preferences.lead !== data.lead) return;
    await updateTaskFromReminder(owner, data.taskId, task => {
      if (task.status !== 'pending' || reminderVersion(task) !== data.version) return null;
      const schedule = postponeSchedule(formatDateForInput(task.date), task.startTime, minutes);
      return {
        date: dateInputToStorageDate(schedule.date),
        startTime: formatTimeFromMinutes(schedule.startMinutes),
      };
    });
    await Notifications.dismissNotificationAsync(request.identifier);
    await reconcile();
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
  }),
});
Notifications.addNotificationResponseReceivedListener(response => {
  // Android also dispatches background responses to TaskManager. Give that
  // executor ownership so two runtimes do not write the local snapshot.
  if (Platform.OS === 'android' && AppState.currentState !== 'active') return;
  void handleResponse(response).catch(report);
});
Notifications.addNotificationReceivedListener(notification => {
  if (isReminder(notification.request)) void refreshTaskReminders().catch(report);
});
if (Platform.OS === 'android') {
  TaskManager.defineTask(backgroundTask, async ({ data, error }) => {
    if (error) return report();
    await handleResponse(data);
  });
  TaskManager.isTaskRegisteredAsync(backgroundTask).then(registered => {
    if (!registered) return Notifications.registerTaskAsync(backgroundTask);
  }).catch(report);
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'INITIAL_SESSION' && owner !== undefined) return;
  const next = session?.user?.id ?? null;
  if (next === owner) return;
  owner = next;
  setTaskRepositoryUser(owner);
  resolveIdentity();
  void refreshTaskReminders().catch(report);
});
subscribeTasks(() => void refreshTaskReminders().catch(report));
AppState.addEventListener('change', state => {
  if (state === 'active') void refreshTaskReminders().catch(report);
});
