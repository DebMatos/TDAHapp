import {
  TIMELINE_START_HOUR,
  TIMELINE_START_MINUTES,
} from '../constants/timeline';

export const getTimelineDate = (dateTime) => {
  const timelineDate = new Date(dateTime);

  if (timelineDate.getHours() < TIMELINE_START_HOUR) {
    timelineDate.setDate(timelineDate.getDate() - 1);
  }

  timelineDate.setHours(0, 0, 0, 0);

  return timelineDate;
};

export const getCivilDateForTimelineSlot = (timelineDate, startMinutes) => {
  const civilDate = new Date(
    timelineDate.getFullYear(),
    timelineDate.getMonth(),
    timelineDate.getDate(),
  );

  if (startMinutes < TIMELINE_START_MINUTES) {
    civilDate.setDate(civilDate.getDate() + 1);
  }

  return civilDate;
};
