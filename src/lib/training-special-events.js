const parseDatePart = (value) => {
  if (typeof value !== 'string') return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  return { year, month, day };
};

const parseTimePart = (value) => {
  if (typeof value !== 'string') return null;
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }
  return { hours, minutes };
};

export const normalizeSpecialEvent = (event = {}) => ({
  ...event,
  title: typeof event.title === 'string' ? event.title.trim() : '',
  date: typeof event.date === 'string' ? event.date : '',
  time: typeof event.time === 'string' ? event.time : '',
  duration_minutes: Math.max(0, Number(event.duration_minutes) || 90),
  max_spots: Math.max(0, Number(event.max_spots) || 0),
  booked_uids: Array.isArray(event.booked_uids) ? event.booked_uids : [],
  booked_meta: event.booked_meta && typeof event.booked_meta === 'object' ? event.booked_meta : {},
  status: event.status || 'active'
});

export const hasReservedTrainingSpot = (group, uid) => {
  if (!group || !uid) return false;
  return (group.slots || []).some((slot) =>
    Array.isArray(slot?.roster_uids) && slot.roster_uids.includes(uid)
  );
};

export const getSpecialEventStart = (event) => {
  const normalized = normalizeSpecialEvent(event);
  const datePart = parseDatePart(normalized.date);
  const timePart = parseTimePart(normalized.time);
  if (!datePart || !timePart) return null;
  return new Date(
    datePart.year,
    datePart.month - 1,
    datePart.day,
    timePart.hours,
    timePart.minutes,
    0,
    0
  );
};

export const getSpecialEventEnd = (event) => {
  const start = getSpecialEventStart(event);
  if (!start) return null;
  const normalized = normalizeSpecialEvent(event);
  return new Date(start.getTime() + (normalized.duration_minutes * 60 * 1000));
};

export const isSpecialEventPast = (event, now = new Date()) => {
  if (normalizeSpecialEvent(event).status !== 'active') return true;
  const end = getSpecialEventEnd(event);
  if (!end) return false;
  return now.getTime() >= end.getTime();
};

export const getSpecialEventAvailability = (event, now = new Date()) => {
  const normalized = normalizeSpecialEvent(event);
  const isPast = isSpecialEventPast(normalized, now);
  const booked = isPast ? [] : normalized.booked_uids;
  const maxSpots = normalized.max_spots;
  const available = isPast ? 0 : Math.max(0, maxSpots - booked.length);

  return {
    ...normalized,
    booked,
    bookedMeta: normalized.booked_meta,
    maxSpots,
    available,
    isPast,
    isFull: !isPast && available <= 0
  };
};

export const compareSpecialEvents = (left, right) => {
  const leftStart = getSpecialEventStart(left)?.getTime() || 0;
  const rightStart = getSpecialEventStart(right)?.getTime() || 0;
  return leftStart - rightStart;
};

export const isGroupPoolMember = (group, uid, options = {}) => {
  const { knownMember = false } = options;
  if (!group || !uid) return false;
  const memberIds = Array.isArray(group.member_uids)
    ? group.member_uids
    : Object.keys(group.members || {});
  if (!knownMember && !memberIds.includes(uid)) return false;

  return !hasReservedTrainingSpot(group, uid);
};

export const getActiveSpecialEventBooking = (events, uid, now = new Date()) => {
  if (!uid) return null;
  return (events || [])
    .map((event) => normalizeSpecialEvent(event))
    .filter((event) => !isSpecialEventPast(event, now))
    .find((event) => event.booked_uids.includes(uid)) || null;
};
