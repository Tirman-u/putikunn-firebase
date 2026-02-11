import { getDayFullLabel } from '@/lib/training-utils';

const DAY_INDEX = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

export const SCORE_DIRECTIONS = {
  HIGHER: 'higher',
  LOWER: 'lower'
};

export const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

export const formatSlotLabel = (slot) => {
  if (!slot) return '';
  const dayLabel = getDayFullLabel(slot.day);
  const timeLabel = slot.time || '';
  return `${dayLabel} ${timeLabel}`.trim();
};

export const countRemainingForSlot = (slot, endDate, now = new Date()) => {
  if (!slot?.day || !slot?.time || !endDate) return 0;
  const dayIndex = DAY_INDEX[slot.day];
  if (dayIndex === undefined) return 0;

  const [hours, minutes] = slot.time.split(':').map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;

  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return 0;
  end.setHours(23, 59, 59, 999);

  const candidate = new Date(now);
  candidate.setHours(hours, minutes, 0, 0);
  const todayIndex = candidate.getDay();
  let diff = (dayIndex - todayIndex + 7) % 7;
  if (diff === 0 && now.getTime() > candidate.getTime()) {
    diff = 7;
  }
  candidate.setDate(candidate.getDate() + diff);

  if (candidate.getTime() > end.getTime()) return 0;
  const weeks = Math.floor((end.getTime() - candidate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return weeks + 1;
};

export const countRemainingBySlot = (slots, endDate, now = new Date()) => {
  const bySlot = {};
  let total = 0;
  (slots || []).forEach((slot) => {
    const remaining = countRemainingForSlot(slot, endDate, now);
    bySlot[slot.id] = remaining;
    total += remaining;
  });
  return { total, bySlot };
};

export const computeHc = ({ score, seasonBest, direction }) => {
  const safeScore = Number(score) || 0;
  const safeBest = Number(seasonBest) || 0;
  if (!safeBest || !safeScore) return 1;
  if (direction === SCORE_DIRECTIONS.LOWER) {
    return safeBest / safeScore;
  }
  return safeScore / safeBest;
};

export const computeHcPoints = ({ score, seasonBest, direction }) => {
  const hc = computeHc({ score, seasonBest, direction });
  const rawBonus = Math.min(4, Math.max(0, (hc - 0.8) * 10));
  const hcBonus = round1(rawBonus);
  const points = round1(1 + hcBonus);
  return { hc: round1(hc), hcBonus, points };
};

export const getParticipantId = ({ uid, email, name }) => {
  if (uid) return `uid:${uid}`;
  if (email) return `email:${email.toLowerCase()}`;
  return `name:${(name || '').toLowerCase()}`;
};

export const isScoreBetter = ({ score, best, direction }) => {
  if (best === undefined || best === null) return true;
  if (direction === SCORE_DIRECTIONS.LOWER) {
    return score < best;
  }
  return score > best;
};
