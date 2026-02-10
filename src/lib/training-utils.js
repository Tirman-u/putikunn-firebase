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

export const getSlotAvailability = (slot, group, weekKey) => {
  const maxSpots = Number(slot?.max_spots || 0);
  const roster = Array.isArray(slot?.roster_uids) ? slot.roster_uids : [];
  const attendance = getSlotAttendance(group, weekKey, slot?.id);
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
