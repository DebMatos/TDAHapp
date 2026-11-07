export const formatDateForInput = (date) => {
  // A stored YYYY-MM-DD is a civil date, not a UTC instant.
  const parts = typeof date === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const d = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : date instanceof Date ? date : new Date(date);

  if (Number.isNaN(d.getTime())) {
    return '';
  }

  const day = String(d.getDate()).padStart(2, '0');

  const month = String(d.getMonth() + 1).padStart(2, '0');

  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};

export const getTodayDateInput = () => formatDateForInput(new Date());

export const formatDateInput = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const isValidDateInput = (value) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return false;
  }

  const [day, month, year] = value.split('/').map(Number);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const parseDateInput = (value) => {
  if (!isValidDateInput(value)) {
    return null;
  }

  const [day, month, year] = value.split('/').map(Number);

  return new Date(year, month - 1, day);
};

export const dateInputToStorageDate = (value) => {
  if (!isValidDateInput(value)) {
    return null;
  }

  const [day, month, year] = value.split('/');

  return `${year}-${month}-${day}`;
};
export const addDaysToDateInput = (value, days) => {
  const date = parseDateInput(value);

  if (!date) {
    return value;
  }

  date.setDate(date.getDate() + days);

  return formatDateForInput(date);
};

export const getDateDisplayLabel = (value) => {
  if (value === getTodayDateInput()) {
    return 'Hoje';
  }

  const tomorrow = addDaysToDateInput(getTodayDateInput(), 1);

  if (value === tomorrow) {
    return 'Amanhã';
  }

  return value;
};

