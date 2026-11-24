import { defaultReminderPreferences } from './taskReminderPlan';

export const remindersSupported = false;
export const readReminderPreferences = async () => defaultReminderPreferences;
export const getReminderPermission = async () => 'blocked';
export const requestReminderPermission = getReminderPermission;
export const saveReminderPreferences = async () => {};
