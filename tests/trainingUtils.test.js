import { describe, expect, it } from 'vitest';
import {
  applyDirectSlotClaim,
  formatSlotOccurrenceDate,
  getSlotAvailability,
  getSlotOccurrenceDate,
  getSlotWeekKey
} from '../src/lib/training-utils.js';

describe('training utils', () => {
  it('adds a direct one-time claim to the selected slot', () => {
    const nextWeekData = applyDirectSlotClaim(
      {
        slotA: {
          claimed_uids: [],
          claimed_meta: {}
        }
      },
      'slotA',
      {
        userId: 'user-1',
        name: 'User One',
        email: 'user@example.com',
        source: 'pin_claim'
      }
    );

    expect(nextWeekData.slotA.claimed_uids).toEqual(['user-1']);
    expect(nextWeekData.slotA.claimed_meta['user-1']).toMatchObject({
      name: 'User One',
      email: 'user@example.com',
      source: 'pin_claim',
      type: 'claim'
    });
  });

  it('clears old claims, requests, and waitlist entries before moving the claim', () => {
    const nextWeekData = applyDirectSlotClaim(
      {
        slotA: {
          claimed_uids: ['user-1'],
          claimed_meta: { 'user-1': { source: 'old' } },
          request_uids: [],
          request_meta: {},
          waitlist_uids: []
        },
        slotB: {
          request_uids: ['user-1'],
          request_meta: { 'user-1': { requested_at: '2026-04-09T10:00:00.000Z' } },
          waitlist_uids: ['user-1'],
          waitlist_meta: { 'user-1': { joined_at: '2026-04-09T11:00:00.000Z' } },
          claimed_uids: [],
          claimed_meta: {}
        }
      },
      'slotB',
      {
        userId: 'user-1',
        name: 'User One'
      }
    );

    expect(nextWeekData.slotA.claimed_uids).toEqual([]);
    expect(nextWeekData.slotA.claimed_meta['user-1']).toBeUndefined();
    expect(nextWeekData.slotB.request_uids).toEqual([]);
    expect(nextWeekData.slotB.request_meta['user-1']).toBeUndefined();
    expect(nextWeekData.slotB.waitlist_uids).toEqual([]);
    expect(nextWeekData.slotB.waitlist_meta['user-1']).toBeUndefined();
    expect(nextWeekData.slotB.claimed_uids).toEqual(['user-1']);
  });

  it('resolves slot day to the concrete date of the selected ISO week', () => {
    const occurrence = getSlotOccurrenceDate({ day: 'thu' }, '2026-W15');

    expect(occurrence?.getFullYear()).toBe(2026);
    expect(occurrence?.getMonth()).toBe(3);
    expect(occurrence?.getDate()).toBe(9);
  });

  it('formats slot occurrence dates for trainee-facing labels', () => {
    expect(
      formatSlotOccurrenceDate({ day: 'thu' }, '2026-W15', 'et-EE', {
        day: '2-digit',
        month: '2-digit'
      })
    ).toBe('09.04');
  });

  it('uses a fixed slot date to resolve the correct week key', () => {
    expect(getSlotWeekKey({ date: '2026-04-23' }, '2026-W15')).toBe('2026-W17');
  });

  it('reads dated slot availability from the slot own week instead of the current week fallback', () => {
    const group = {
      attendance: {
        '2026-W17': {
          slotA: {
            claimed_uids: ['user-1'],
            claimed_meta: { 'user-1': { source: 'pin_claim' } }
          }
        }
      }
    };
    const slot = {
      id: 'slotA',
      date: '2026-04-23',
      day: 'thu',
      time: '18:00',
      max_spots: 4,
      roster_uids: []
    };

    const availability = getSlotAvailability(slot, group, '2026-W15', new Date('2026-04-23T10:00:00'));
    expect(availability.claimed).toEqual(['user-1']);
    expect(availability.available).toBe(3);
  });

  it('formats fixed slot dates without relying on weekday fallback', () => {
    expect(
      formatSlotOccurrenceDate(
        { date: '2026-04-23', day: 'thu' },
        '2026-W15',
        'et-EE',
        { day: '2-digit', month: '2-digit' }
      )
    ).toBe('23.04');
  });
});
