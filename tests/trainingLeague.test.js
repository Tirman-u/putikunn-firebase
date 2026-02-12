import { describe, expect, it } from 'vitest';
import { computeRankCutPoints, getCutCount } from '../src/lib/training-league.js';

describe('training league rank cut scoring', () => {
  it('calculates cut count with ceil(percent of participants)', () => {
    expect(getCutCount({ participantsCount: 8, cutPercent: 70 })).toBe(6);
    expect(getCutCount({ participantsCount: 0, cutPercent: 70 })).toBe(0);
  });

  it('awards progressive bonus inside cut threshold', () => {
    const sixth = computeRankCutPoints({
      rank: 6,
      participantsCount: 8,
      cutPercent: 70,
      bonusStep: 0.3
    });
    expect(sixth.cutBonus).toBe(0.3);
    expect(sixth.points).toBe(1.3);

    const fifth = computeRankCutPoints({
      rank: 5,
      participantsCount: 8,
      cutPercent: 70,
      bonusStep: 0.3
    });
    expect(fifth.cutBonus).toBe(0.6);
    expect(fifth.points).toBe(1.6);
  });

  it('keeps base points outside cut or without rank', () => {
    const outside = computeRankCutPoints({
      rank: 7,
      participantsCount: 8,
      cutPercent: 70,
      bonusStep: 0.3
    });
    expect(outside.qualifies).toBe(false);
    expect(outside.points).toBe(1);

    const missingRank = computeRankCutPoints({
      rank: null,
      participantsCount: 8,
      cutPercent: 70,
      bonusStep: 0.3
    });
    expect(missingRank.points).toBe(null);
  });
});
