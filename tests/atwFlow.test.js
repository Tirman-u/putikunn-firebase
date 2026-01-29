import { describe, it, expect } from 'vitest';
import { getATWMovement, isATWRoundComplete, shouldATWRestart } from '../src/components/putting/gameRules.jsx';

describe('ATW flow integration', () => {
  it('completes a full 5→10→5 round with perfect makes', () => {
    const distances = [5, 6, 7, 8, 9, 10];
    let state = { index: 0, direction: 'UP' };
    let roundComplete = false;

    for (let i = 0; i < 10; i += 1) {
      const madeCount = 3;
      if (shouldATWRestart(3, madeCount)) {
        state = { index: 0, direction: 'UP' };
        continue;
      }

      const { newIndex, newDirection, lapEvent } = getATWMovement({
        currentIndex: state.index,
        direction: state.direction,
        distances,
        threshold: 1,
        discsPerTurn: 3,
        madeCount
      });

      roundComplete = isATWRoundComplete({ lapEvent, newIndex, newDirection });
      state = { index: newIndex, direction: newDirection };
    }

    expect(roundComplete).toBe(true);
    expect(state.index).toBe(0);
    expect(state.direction).toBe('UP');
  });
});
