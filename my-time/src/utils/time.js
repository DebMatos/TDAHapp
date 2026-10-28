import { DAY_MINUTES, SNAP_MINUTES } from '../constants/timeline';

export const formatTimeFromMinutes = (totalMinutes) => {
  const normalized = ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const timeToMinutes = (value, fallback = 7 * 60) => {
  if (!value || !value.includes(':')) {
    return fallback;
  }

  const [hours, minutes] = value.split(':').map(Number);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return fallback;
  }

  return hours * 60 + minutes;
};

export const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h${String(mins).padStart(2, '0')}`;
};

export const snapMinutes = (minutes, step = SNAP_MINUTES) =>
  Math.round(minutes / step) * step;


export const formatTimeInput = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

export const isValidTime = (value) => {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hours, minutes] = value.split(':').map(Number);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};
