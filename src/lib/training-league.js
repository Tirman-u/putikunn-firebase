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

const DAY_FULL_EN = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday'
};

const getLang = () => {
  if (typeof window === 'undefined') return 'et';
  return window.localStorage.getItem('putikunn:lang') || 'et';
};

const getDayLabel = (value) => {
  if (getLang() !== 'en') return getDayFullLabel(value);
  return DAY_FULL_EN[value] || getDayFullLabel(value);
};

export const SCORE_DIRECTIONS = {
  HIGHER: 'higher',
  LOWER: 'lower'
};

export const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

export const formatSlotLabel = (slot) => {
  if (!slot) return '';
  const dayLabel = getDayLabel(slot.day);
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

export const getCutCount = ({ participantsCount, cutPercent }) => {
  const safeParticipants = Math.max(0, Number(participantsCount) || 0);
  const safeCutPercent = Math.min(100, Math.max(0, Number(cutPercent) || 0));
  if (safeParticipants === 0 || safeCutPercent === 0) return 0;
  return Math.ceil((safeParticipants * safeCutPercent) / 100);
};

export const computeRankCutPoints = ({
  rank,
  participantsCount,
  cutPercent,
  bonusStep,
  basePoints = 1
}) => {
  const safeRank = Number(rank);
  const safeBonusStep = Math.max(0, Number(bonusStep) || 0);
  const cutCount = getCutCount({ participantsCount, cutPercent });
  const hasRank = Number.isFinite(safeRank) && safeRank > 0;
  const qualifies = hasRank && cutCount > 0 && safeRank <= cutCount;
  const stepCount = qualifies ? (cutCount - safeRank + 1) : 0;
  const cutBonus = qualifies ? round1(stepCount * safeBonusStep) : 0;
  const points = hasRank ? round1(basePoints + cutBonus) : null;
  return {
    cutCount,
    qualifies,
    stepCount,
    cutBonus,
    points
  };
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
