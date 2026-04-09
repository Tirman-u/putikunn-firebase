import { describe, it, expect } from 'vitest';
import {
  calculateATWBestMetrics,
  isATWStateAhead,
  resolveATWDisplayAttemptCount,
  resolveATWDisplayBestScore
} from '../src/lib/atw-metrics.js';

describe('ATW metrics', () => {
  it('promotes current score and running stats into best metrics', () => {
    const metrics = calculateATWBestMetrics(
      {
        best_score: 18,
        best_laps: 1,
        best_accuracy: 55,
        total_makes: 7,
        total_putts: 12,
        laps_completed: 1
      },
      24,
      {
        totalMakes: 10,
        totalPutts: 15,
        lapsCompleted: 2
      }
    );

    expect(metrics).toEqual({
      bestScore: 24,
      bestLaps: 2,
      bestAccuracy: expect.closeTo(66.6666666667, 5)
    });
  });

  it('uses current score as display fallback when persisted best score lags behind', () => {
    expect(resolveATWDisplayBestScore({ best_score: 12 }, 18)).toBe(18);
    expect(resolveATWDisplayBestScore({ best_score: 22 }, 18)).toBe(22);
  });

  it('counts the active ATW run in display attempts', () => {
    expect(resolveATWDisplayAttemptCount({}, 0)).toBe(0);
    expect(resolveATWDisplayAttemptCount({ turns_played: 2, attempts_count: 0 }, 33)).toBe(1);
    expect(resolveATWDisplayAttemptCount({ attempts_count: 3 }, 0)).toBe(4);
  });

  it('treats locally richer ATW state as ahead of stale remote state', () => {
    expect(isATWStateAhead(
      { best_score: 78, turns_played: 6, total_putts: 18, history: [{}, {}, {}] },
      78,
      { best_score: 33, turns_played: 2, total_putts: 6, history: [{}, {}] },
      33
    )).toBe(true);

    expect(isATWStateAhead(
      { best_score: 0, turns_played: 1, total_putts: 3, client_seq: 99 },
      15,
      { best_score: 33, turns_played: 2, total_putts: 6, client_seq: 2, history: [{}, {}] },
      33
    )).toBe(false);
  });
});
