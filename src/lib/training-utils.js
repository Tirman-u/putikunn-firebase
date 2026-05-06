const DAY_LABELS = [
  { value: 'mon', label: 'E', full: 'Esmaspäev' },
  { value: 'tue', label: 'T', full: 'Teisipäev' },
  { value: 'wed', label: 'K', full: 'Kolmapäev' },
  { value: 'thu', label: 'N', full: 'Neljapäev' },
  { value: 'fri', label: 'R', full: 'Reede' },
  { value: 'sat', label: 'L', full: 'Laupäev' },
  { value: 'sun', label: 'P', full: 'Pühapäev' }
];

export const TRAINING_DAYS = DAY_LABELS;
const DAY_INDEX_MAP = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7
};

const DAY_VALUE_BY_JS_INDEX = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat'
};

const toWeekDayIndex = (date = new Date()) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

const parseTimeToMinutes = (raw) => {
  if (typeof raw !== 'string') return 0;
  const [h, m] = raw.split(':').map((value) => Number(value));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return (h * 60) + m;
};

const parseDateOnly = (raw) => {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day, 12, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeAttendancePayload = (slotData = {}) => ({
  ...slotData,
  released_uids: Array.isArray(slotData.released_uids) ? slotData.released_uids : [],
  claimed_uids: Array.isArray(slotData.claimed_uids) ? slotData.claimed_uids : [],
  claimed_meta: slotData.claimed_meta || {},
  waitlist_uids: Array.isArray(slotData.waitlist_uids) ? slotData.waitlist_uids : [],
  waitlist_meta: slotData.waitlist_meta || {},
  request_uids: Array.isArray(slotData.request_uids) ? slotData.request_uids : [],
  request_meta: slotData.request_meta || {}
});

export const createEmptyAttendanceSlot = () => ({
  released_uids: [],
  claimed_uids: [],
  claimed_meta: {},
  waitlist_uids: [],
  waitlist_meta: {},
  request_uids: [],
  request_meta: {}
});

const isCurrentWeekKey = (weekKey, now = new Date()) => weekKey === getWeekKey(now);

const isSlotOccurrencePassed = (slot, now = new Date()) => {
  if (slot?.date) {
    const occurrenceDate = parseDateOnly(slot.date);
    if (!occurrenceDate) return false;
    const slotStart = parseTimeToMinutes(slot?.time);
    const slotDuration = Math.max(0, Number(slot?.duration_minutes) || 90);
    const slotEnd = new Date(occurrenceDate);
    slotEnd.setHours(0, 0, 0, 0);
    slotEnd.setMinutes(slotStart + slotDuration);
    return now.getTime() >= slotEnd.getTime();
  }

  const slotDayIndex = DAY_INDEX_MAP[slot?.day];
  if (!slotDayIndex) return false;
  const currentDayIndex = toWeekDayIndex(now);
  if (currentDayIndex > slotDayIndex) return true;
  if (currentDayIndex < slotDayIndex) return false;

  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  const slotStart = parseTimeToMinutes(slot?.time);
  const slotDuration = Math.max(0, Number(slot?.duration_minutes) || 90);
  return currentMinutes >= (slotStart + slotDuration);
};

export const getWeekKey = (date = new Date()) => {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

export const getDayLabel = (value) => {
  const found = DAY_LABELS.find((day) => day.value === value);
  return found?.label || value || '';
};

export const getDayFullLabel = (value) => {
  const found = DAY_LABELS.find((day) => day.value === value);
  return found?.full || value || '';
};

export const getDayValueFromDate = (rawDate) => {
  const parsed = rawDate instanceof Date ? rawDate : parseDateOnly(rawDate);
  if (!parsed || Number.isNaN(parsed.getTime())) return '';
  return DAY_VALUE_BY_JS_INDEX[parsed.getDay()] || '';
};

const parseWeekKey = (weekKey) => {
  if (typeof weekKey !== 'string') return null;
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
    return null;
  }
  return { year, week };
};

const getWeekStartDate = (year, week) => {
  const jan4 = new Date(year, 0, 4, 12, 0, 0, 0);
  const jan4Weekday = toWeekDayIndex(jan4);
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - (jan4Weekday - 1) + ((week - 1) * 7));
  weekStart.setHours(12, 0, 0, 0);
  return weekStart;
};

export const getSlotOccurrenceDate = (slot, weekKey) => {
  if (slot?.date) {
    return parseDateOnly(slot.date);
  }
  const parsed = parseWeekKey(weekKey);
  const dayIndex = DAY_INDEX_MAP[slot?.day];
  if (!parsed || !dayIndex) return null;

  const weekStart = getWeekStartDate(parsed.year, parsed.week);
  const occurrence = new Date(weekStart);
  occurrence.setDate(weekStart.getDate() + dayIndex - 1);
  return occurrence;
};

export const formatSlotOccurrenceDate = (
  slot,
  weekKey,
  locale = 'et-EE',
  options = { day: '2-digit', month: '2-digit' }
) => {
  const occurrence = getSlotOccurrenceDate(slot, weekKey);
  if (!occurrence) return '';
  return occurrence.toLocaleDateString(locale, options);
};

export const getSlotWeekKey = (slot, fallbackWeekKey = getWeekKey()) => {
  if (slot?.date) {
    const occurrence = parseDateOnly(slot.date);
    if (occurrence) {
      return getWeekKey(occurrence);
    }
  }
  return fallbackWeekKey;
};

export const compareTrainingSlots = (left, right, fallbackWeekKey = getWeekKey()) => {
  const leftOccurrence = getSlotOccurrenceDate(left, getSlotWeekKey(left, fallbackWeekKey));
  const rightOccurrence = getSlotOccurrenceDate(right, getSlotWeekKey(right, fallbackWeekKey));
  const leftHasDate = Boolean(leftOccurrence);
  const rightHasDate = Boolean(rightOccurrence);

  if (leftHasDate && rightHasDate) {
    const leftTime = parseTimeToMinutes(left?.time);
    const rightTime = parseTimeToMinutes(right?.time);
    const leftStart = new Date(leftOccurrence);
    const rightStart = new Date(rightOccurrence);
    leftStart.setHours(0, 0, 0, 0);
    rightStart.setHours(0, 0, 0, 0);
    leftStart.setMinutes(leftTime);
    rightStart.setMinutes(rightTime);
    return leftStart.getTime() - rightStart.getTime();
  }

  const leftDay = DAY_INDEX_MAP[left?.day] || 99;
  const rightDay = DAY_INDEX_MAP[right?.day] || 99;
  if (leftDay !== rightDay) return leftDay - rightDay;
  return parseTimeToMinutes(left?.time) - parseTimeToMinutes(right?.time);
};

export const getSlotAttendance = (group, weekKey, slotId) => {
  return group?.attendance?.[weekKey]?.[slotId] || {};
};

export const getEffectiveSlotAttendance = (group, weekKey, slot, now = new Date()) => {
  const resolvedWeekKey = getSlotWeekKey(slot, weekKey);
  const raw = getSlotAttendance(group, resolvedWeekKey, slot?.id);
  const normalized = normalizeAttendancePayload(raw);

  if (slot?.date && isSlotOccurrencePassed(slot, now)) {
    return {
      ...normalized,
      released_uids: [],
      claimed_uids: [],
      claimed_meta: {},
      waitlist_uids: [],
      waitlist_meta: {},
      request_uids: [],
      request_meta: {}
    };
  }

  // Past slots in the active week are treated as reset (1x claims/releases expire).
  if (isCurrentWeekKey(resolvedWeekKey, now) && isSlotOccurrencePassed(slot, now)) {
    return {
      ...normalized,
      released_uids: [],
      claimed_uids: [],
      claimed_meta: {},
      waitlist_uids: [],
      waitlist_meta: {},
      request_uids: [],
      request_meta: {}
    };
  }

  return normalized;
};

export const applyDirectSlotClaim = (weekData = {}, slotId, {
  userId,
  name = '',
  email = '',
  source = 'pool',
  type = 'claim',
  claimedAt = new Date().toISOString()
} = {}) => {
  if (!userId || !slotId) return { ...(weekData || {}) };

  const nextWeekData = { ...(weekData || {}) };

  Object.keys(nextWeekData).forEach((currentSlotId) => {
    const slotData = normalizeAttendancePayload(nextWeekData[currentSlotId]);
    const nextClaimedMeta = { ...(slotData.claimed_meta || {}) };
    const nextWaitlistMeta = { ...(slotData.waitlist_meta || {}) };
    const nextRequestMeta = { ...(slotData.request_meta || {}) };
    delete nextClaimedMeta[userId];
    delete nextWaitlistMeta[userId];
    delete nextRequestMeta[userId];

    nextWeekData[currentSlotId] = {
      ...slotData,
      claimed_uids: slotData.claimed_uids.filter((uid) => uid !== userId),
      claimed_meta: nextClaimedMeta,
      waitlist_uids: slotData.waitlist_uids.filter((uid) => uid !== userId),
      waitlist_meta: nextWaitlistMeta,
      request_uids: slotData.request_uids.filter((uid) => uid !== userId),
      request_meta: nextRequestMeta
    };
  });

  const targetData = normalizeAttendancePayload(nextWeekData[slotId] || createEmptyAttendanceSlot());
  const claimed = new Set(targetData.claimed_uids || []);
  claimed.add(userId);

  nextWeekData[slotId] = {
    ...targetData,
    claimed_uids: Array.from(claimed),
    claimed_meta: {
      ...(targetData.claimed_meta || {}),
      [userId]: {
        name,
        email,
        type,
        source,
        claimed_at: claimedAt
      }
    }
  };

  return nextWeekData;
};

export const getSlotAvailability = (slot, group, weekKey, now = new Date()) => {
  const maxSpots = Number(slot?.max_spots || 0);
  const roster = Array.isArray(slot?.roster_uids) ? slot.roster_uids : [];
  const attendance = getEffectiveSlotAttendance(group, weekKey, slot, now);
  const released = Array.isArray(attendance?.released_uids) ? attendance.released_uids : [];
  const claimed = Array.isArray(attendance?.claimed_uids) ? attendance.claimed_uids : [];
  const waitlist = Array.isArray(attendance?.waitlist_uids) ? attendance.waitlist_uids : [];
  const requests = Array.isArray(attendance?.request_uids) ? attendance.request_uids : [];
  const requestMeta = attendance?.request_meta || {};
  const baseRoster = Math.min(roster.length, maxSpots);
  const occupied = Math.max(0, baseRoster - released.length + claimed.length);
  const isPast = Boolean(slot?.date) && isSlotOccurrencePassed(slot, now);
  const available = isPast ? 0 : Math.max(0, maxSpots - occupied);

  return {
    maxSpots,
    roster,
    attendance,
    released,
    claimed,
    waitlist,
    requests,
    requestMeta,
    occupied,
    available,
    isPast
  };
};

export const createSlotId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `slot-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};
