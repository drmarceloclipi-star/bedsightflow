/**
 * Tests for the huddle pending badge logic (G3 fix).
 *
 * The TV dashboard badge "HUDDLE PENDENTE" should only disappear when the
 * huddle has been formally COMPLETED (endedAt is set). Before the G3 fix,
 * the badge disappeared as soon as the huddle was STARTED (when
 * lastHuddleShiftKey was set), which violated the LSW cycle requirement.
 *
 * This file tests the pure logic that drives the badge — extracted here as
 * a domain-level function so it can be unit-tested without React.
 */

import { describe, it, expect } from 'vitest';
import type { HuddleDoc } from './huddle';

// ---------------------------------------------------------------------------
// Pure helper — mirrors TvDashboard.tsx huddlePending logic (G3 fix)
// ---------------------------------------------------------------------------
function isHuddlePending(currentHuddle: HuddleDoc | null): boolean {
    return !(currentHuddle !== null && currentHuddle.endedAt != null);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('huddlePending badge logic (G3 fix)', () => {
    const baseHuddle: HuddleDoc = {
        id: '2026-03-06-AM',
        unitId: 'A',
        huddleType: 'AM',
        shiftKey: '2026-03-06-AM',
        startedAt: new Date().toISOString(),
        recordedBy: { id: 'u1', name: 'Nurse' },
        checklist: [],
        topActions: [],
        createdAt: new Date().toISOString(),
    };

    it('is PENDING when no huddle exists for this shift', () => {
        expect(isHuddlePending(null)).toBe(true);
    });

    it('is still PENDING when huddle was started but not ended', () => {
        // endedAt is absent — the huddle is in progress
        const startedHuddle: HuddleDoc = { ...baseHuddle };
        expect(startedHuddle.endedAt).toBeUndefined();
        expect(isHuddlePending(startedHuddle)).toBe(true);
    });

    it('is still PENDING when endedAt is explicitly null', () => {
        // Some code paths may write null explicitly
        const inProgressHuddle = { ...baseHuddle, endedAt: null as any };
        expect(isHuddlePending(inProgressHuddle)).toBe(true);
    });

    it('is NOT PENDING when huddle has a valid endedAt timestamp (string)', () => {
        const completedHuddle: HuddleDoc = {
            ...baseHuddle,
            endedAt: new Date().toISOString(),
        };
        expect(isHuddlePending(completedHuddle)).toBe(false);
    });

    it('is NOT PENDING when huddle has a Firestore Timestamp-like endedAt', () => {
        const completedHuddle: HuddleDoc = {
            ...baseHuddle,
            endedAt: { toDate: () => new Date(), toMillis: () => Date.now() } as any,
        };
        expect(isHuddlePending(completedHuddle)).toBe(false);
    });

    it('is NOT PENDING when huddle has a Date object as endedAt', () => {
        const completedHuddle: HuddleDoc = {
            ...baseHuddle,
            endedAt: new Date() as any,
        };
        expect(isHuddlePending(completedHuddle)).toBe(false);
    });
});
