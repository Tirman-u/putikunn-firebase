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

const isCurrentWeekKey = (weekKey, now = new Date()) => weekKey === getWeekKey(now);

const isSlotOccurrencePassed = (slot, now = new Date()) => {
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

export const getSlotAttendance = (group, weekKey, slotId) => {
  return group?.attendance?.[weekKey]?.[slotId] || {};
};

export const getEffectiveSlotAttendance = (group, weekKey, slot, now = new Date()) => {
  const raw = getSlotAttendance(group, weekKey, slot?.id);
  const normalized = normalizeAttendancePayload(raw);

  // Past slots in the active week are treated as reset (1x claims/releases expire).
  if (isCurrentWeekKey(weekKey, now) && isSlotOccurrencePassed(slot, now)) {
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

export const getSlotAvailability = (slot, group, weekKey) => {
  const maxSpots = Number(slot?.max_spots || 0);
  const roster = Array.isArray(slot?.roster_uids) ? slot.roster_uids : [];
  const attendance = getEffectiveSlotAttendance(group, weekKey, slot);
  const released = Array.isArray(attendance?.released_uids) ? attendance.released_uids : [];
  const claimed = Array.isArray(attendance?.claimed_uids) ? attendance.claimed_uids : [];
  const waitlist = Array.isArray(attendance?.waitlist_uids) ? attendance.waitlist_uids : [];
  const requests = Array.isArray(attendance?.request_uids) ? attendance.request_uids : [];
  const requestMeta = attendance?.request_meta || {};
  const baseRoster = Math.min(roster.length, maxSpots);
  const occupied = Math.max(0, baseRoster - released.length + claimed.length);
  const available = Math.max(0, maxSpots - occupied);

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
    available
  };
};

export const createSlotId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `slot-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};
