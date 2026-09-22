import { TIMELINE_START_HOUR } from '../constants/timeline';

export const getTimelineDate = (dateTime) => {
  const timelineDate = new Date(dateTime);

  if (timelineDate.getHours() < TIMELINE_START_HOUR) {
    timelineDate.setDate(timelineDate.getDate() - 1);
  }

  timelineDate.setHours(0, 0, 0, 0);

  return timelineDate;
};
