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
const diagnostic = (operation, details = {}) => {
  console.info(`[Notificações] ${operation}`, details);
};
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
  if (!permission.granted) return permission.canAskAgain ? 'ask' : 'blocked';
  if (Platform.OS !== 'android') return 'granted';
  const exact = await Notifications.getExactAlarmPermissionsAsync();
  return exact.granted ? 'granted' : 'exact';
};

export const requestReminderPermission = async () => {
  await configureChannel();
  const permission = await Notifications.getPermissionsAsync();
  const notifications = permission.granted
    ? permission
    : await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android' && notifications.granted) {
    const exact = await Notifications.getExactAlarmPermissionsAsync();
    if (!exact.granted) await Notifications.requestExactAlarmPermissionsAsync();
  }
  await refreshTaskReminders();
  return getReminderPermission();
};

const isReminder = request => request.content.data?.kind === category;

async function reconcile() {
  if (owner === undefined) return;
  const userId = owner;
  const preferences = await readReminderPreferences();
  const permission = await getReminderPermission();
  const granted = preferences.enabled && permission === 'granted';
  const tasks = userId && granted ? (await loadTasksSnapshot()).tasks : [];
  const plans = tasks.map(task => reminderPlan(task, preferences.lead, Date.now(), userId, category))
    .filter(Boolean).sort((a, b) => a.fireAt - b.fireAt);
  const eligiblePlans = Platform.OS === 'ios' ? plans.slice(0, 60) : plans;
  const desired = new Map(eligiblePlans.map(plan => [plan.key, plan]));
  if (userId !== owner) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  diagnostic('reconciliação', {
    userId, enabled: preferences.enabled, lead: preferences.lead, permission,
    desired: [...desired.values()].map(plan => ({
      taskId: plan.taskId, plannedAt: plan.plannedAt, fireAt: new Date(plan.fireAt).toISOString(),
    })),
    scheduled: scheduled.filter(isReminder).map(request => ({
      notificationId: request.identifier,
      taskId: request.content.data?.taskId,
      plannedAt: request.content.data?.plannedAt,
      fireAt: request.trigger?.date ?? request.trigger?.value ?? null,
    })),
  });
  let operationError = null;
  for (const request of scheduled.filter(isReminder)) {
    if (desired.delete(request.content.data.key)) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
      diagnostic('cancelada', {
        taskId: request.content.data?.taskId, notificationId: request.identifier,
      });
    } catch (error) {
      operationError = error;
      diagnostic('falha ao cancelar', {
        taskId: request.content.data?.taskId, notificationId: request.identifier,
        message: error?.message,
      });
    }
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
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: plan.content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: plan.fireAt,
          channelId: channel,
        },
      });
      diagnostic('agendada', {
        taskId: plan.taskId, notificationId, plannedAt: plan.plannedAt,
        fireAt: new Date(plan.fireAt).toISOString(),
      });
    } catch (error) {
      operationError = error;
      diagnostic('falha ao agendar', {
        taskId: plan.taskId, plannedAt: plan.plannedAt,
        fireAt: new Date(plan.fireAt).toISOString(), message: error?.message,
      });
    }
  }
  if (operationError) throw operationError;
}

export const refreshTaskReminders = () => serialize(reconcile);
export const saveReminderPreferences = preferences => serialize(async () => {
  await AsyncStorage.setItem(preferenceKey, JSON.stringify(preferences));
  await reconcile();
});

async function ensureIdentity() {
  if (owner !== undefined) return;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (owner !== undefined) return;
  owner = data.session?.user?.id ?? null;
  setTaskRepositoryUser(owner);
  resolveIdentity();
}

async function handleResponse(response) {
  const request = response?.notification?.request;
  const data = request?.content?.data;
  const minutes = actions.find(value => String(value) === response?.actionIdentifier);
  if (data?.kind !== category || !minutes) return;
  await ensureIdentity();
  await identityReady;
  await serialize(async () => {
    const preferences = await readReminderPreferences();
    if (!owner || owner !== data.userId || !preferences.enabled || preferences.lead !== data.lead) {
      diagnostic('ação ignorada', {
        taskId: data.taskId, notificationId: request.identifier, minutes,
        reason: 'contexto-inválido',
      });
      return;
    }
    const applied = await updateTaskFromReminder(owner, data.taskId, task => {
      if (task.status !== 'pending' || reminderVersion(task) !== data.version) return null;
      const schedule = postponeSchedule(formatDateForInput(task.date), task.startTime, minutes);
      return {
        date: dateInputToStorageDate(schedule.date),
        startTime: formatTimeFromMinutes(schedule.startMinutes),
      };
    });
    diagnostic(applied ? 'ação aplicada' : 'ação ignorada', {
      taskId: data.taskId, notificationId: request.identifier, minutes,
      ...(!applied && { reason: 'tarefa-ausente-ou-desatualizada' }),
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
  // Android may dispatch the same action to this listener and TaskManager.
  // The notification version makes the local update idempotent.
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
    diagnostic('executor em segundo plano', { registered });
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
