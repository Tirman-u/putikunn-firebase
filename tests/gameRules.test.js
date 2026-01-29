import { describe, it, expect } from 'vitest';
import {
  calculateRoundScore,
  getNextDistanceFromMade,
  shouldATWRestart,
  getATWMovement,
  isATWRoundComplete
} from '../src/components/putting/gameRules.jsx';

describe('gameRules helpers', () => {
  it('calculates round score for classic formats', () => {
    expect(calculateRoundScore(8, 3)).toBe(24);
  });

  it('gets next distance for classic based on made count', () => {
    expect(getNextDistanceFromMade('classic', 2)).toBe(7);
    expect(getNextDistanceFromMade('classic', 5)).toBe(10);
  });

  it('determines ATW restart rule', () => {
    expect(shouldATWRestart(3, 1)).toBe(true); // 2 misses
    expect(shouldATWRestart(3, 2)).toBe(false);
    expect(shouldATWRestart(1, 0)).toBe(true);
  });

  it('moves ATW correctly and detects round completion', () => {
    const distances = [5, 6, 7, 8, 9, 10];
    const { newIndex, newDirection, lapEvent } = getATWMovement({
      currentIndex: 4,
      direction: 'UP',
      distances,
      threshold: 1,
      discsPerTurn: 3,
      madeCount: 3
    });

    expect(newIndex).toBe(5);
    expect(newDirection).toBe('DOWN');
    expect(lapEvent).toBe(true);
    expect(isATWRoundComplete({ lapEvent: true, newIndex: 0, newDirection: 'UP' })).toBe(true);
  });
});
