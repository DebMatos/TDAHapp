export const reminderUnits = { minutes: 1, hours: 60, days: 1440 };
export const defaultReminderPreferences = { enabled: true, lead: 15, unit: 'minutes' };

export function reminderLeadFromInput(input, unit) {
  if (!/^\d+$/.test(input) || !Object.hasOwn(reminderUnits, unit)) return null;
  const lead = Number(input) * reminderUnits[unit];
  return Number.isSafeInteger(lead) && lead > 0 ? lead : null;
}

export function normalizeReminderPreferences(stored) {
  const lead = Number.isSafeInteger(stored?.lead) && stored.lead >= 0
    ? stored.lead : defaultReminderPreferences.lead;
  const unit = Object.hasOwn(reminderUnits, stored?.unit) && lead % reminderUnits[stored.unit] === 0
    ? stored.unit : lead === 60 ? 'hours' : 'minutes';
  return { enabled: typeof stored?.enabled === 'boolean' ? stored.enabled : true, lead, unit };
}

const describeLead = lead => {
  if (lead % 1440 === 0) return lead === 1440 ? '1 dia' : `${lead / 1440} dias`;
  if (lead % 60 === 0) return lead === 60 ? '1 hora' : `${lead / 60} horas`;
  return lead === 1 ? '1 minuto' : `${lead} minutos`;
};

export const reminderVersion = task =>
  JSON.stringify([task.id, task.date, task.startTime, task.durationMinutes, task.updatedAt]);

export function reminderPlan(task, lead, now, userId, kind) {
  if (task.status !== 'pending' || !task.date || !task.startTime || !task.durationMinutes) return null;
  const fireAt = new Date(`${task.date}T${task.startTime}:00`).getTime() - lead * 60_000;
  if (!Number.isFinite(fireAt) || fireAt <= now) return null;
  const version = reminderVersion(task);
  const key = JSON.stringify([kind, userId, version, fireAt, lead, task.title]);
  const plannedAt = `${task.date}T${task.startTime}:00`;
  return {
    key, fireAt, taskId: task.id, plannedAt,
    content: {
      title: task.title,
      body: lead ? `A tua tarefa começa dentro de ${describeLead(lead)}.` : 'A tua tarefa começa agora.',
      categoryIdentifier: kind,
      data: { kind, key, userId, taskId: task.id, version, lead, plannedAt, fireAt },
    },
  };
}
