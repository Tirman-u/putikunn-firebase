import { describe, expect, it } from 'vitest';
import {
  compareSpecialEvents,
  getActiveSpecialEventBooking,
  getSpecialEventAvailability,
  getSpecialEventEnd,
  getSpecialEventStart,
  hasReservedTrainingSpot,
  isGroupPoolMember,
  isSpecialEventPast
} from '../src/lib/training-special-events.js';

describe('training special events', () => {
  it('parses local start and end time from date and time fields', () => {
    const event = {
      date: '2026-04-10',
      time: '18:30',
      duration_minutes: 75
    };

    const start = getSpecialEventStart(event);
    const end = getSpecialEventEnd(event);

    expect(start?.getFullYear()).toBe(2026);
    expect(start?.getMonth()).toBe(3);
    expect(start?.getDate()).toBe(10);
    expect(start?.getHours()).toBe(18);
    expect(start?.getMinutes()).toBe(30);
    expect(end?.getHours()).toBe(19);
    expect(end?.getMinutes()).toBe(45);
  });

  it('marks event past only after its duration has ended', () => {
    const event = {
      date: '2026-04-10',
      time: '18:30',
      duration_minutes: 60,
      status: 'active'
    };

    expect(isSpecialEventPast(event, new Date(2026, 3, 10, 19, 29))).toBe(false);
    expect(isSpecialEventPast(event, new Date(2026, 3, 10, 19, 30))).toBe(true);
  });

  it('treats past events as unavailable even if booking data still exists', () => {
    const event = {
      date: '2026-04-10',
      time: '18:30',
      duration_minutes: 60,
      max_spots: 4,
      booked_uids: ['u1', 'u2']
    };

    const upcoming = getSpecialEventAvailability(event, new Date(2026, 3, 10, 18, 0));
    const past = getSpecialEventAvailability(event, new Date(2026, 3, 10, 19, 45));

    expect(upcoming.available).toBe(2);
    expect(upcoming.booked).toEqual(['u1', 'u2']);
    expect(past.available).toBe(0);
    expect(past.booked).toEqual([]);
    expect(past.isPast).toBe(true);
  });

  it('detects pool members as group members without reserved spots', () => {
    const group = {
      member_uids: ['pool-user', 'reserved-user'],
      slots: [
        { id: 'slot-1', roster_uids: ['reserved-user'] }
      ]
    };

    expect(isGroupPoolMember(group, 'pool-user')).toBe(true);
    expect(isGroupPoolMember(group, 'reserved-user')).toBe(false);
    expect(isGroupPoolMember(group, 'missing-user')).toBe(false);
  });

  it('allows fallback group membership when the user doc knows the membership', () => {
    const group = {
      member_uids: [],
      slots: []
    };

    expect(isGroupPoolMember(group, 'pool-user', { knownMember: true })).toBe(true);
  });

  it('detects reserved training spots separately from pool membership', () => {
    const group = {
      slots: [
        { id: 'slot-1', roster_uids: ['reserved-user'] }
      ]
    };

    expect(hasReservedTrainingSpot(group, 'reserved-user')).toBe(true);
    expect(hasReservedTrainingSpot(group, 'pool-user')).toBe(false);
  });

  it('finds the active booking for a user and sorts events chronologically', () => {
    const events = [
      {
        id: 'late',
        date: '2026-04-12',
        time: '18:00',
        duration_minutes: 60,
        booked_uids: ['user-1']
      },
      {
        id: 'early',
        date: '2026-04-05',
        time: '18:00',
        duration_minutes: 60,
        booked_uids: []
      }
    ];

    const sorted = [...events].sort(compareSpecialEvents);
    const activeBooking = getActiveSpecialEventBooking(events, 'user-1', new Date(2026, 3, 1, 12, 0));

    expect(sorted.map((event) => event.id)).toEqual(['early', 'late']);
    expect(activeBooking?.id).toBe('late');
  });
});
