const TIMELINE_START_HOUR = 7;

export const getTimelineDate = (dateTime) => {
  const timelineDate = new Date(dateTime);

  if (timelineDate.getHours() < TIMELINE_START_HOUR) {
    timelineDate.setDate(timelineDate.getDate() - 1);
  }

  timelineDate.setHours(0, 0, 0, 0);

  return timelineDate;
};