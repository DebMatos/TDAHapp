export const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');
  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const addDays = (date, amount) => {
  const next = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  next.setDate(next.getDate() + amount);

  return next;
};