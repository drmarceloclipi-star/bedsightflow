/**
 * lswCadence.test.ts — Unit tests for computeHuddleCadence and huddleCadenceLabel
 *
 * Fixed clock: MOCK_NOW = 2026-03-01T01:00:00Z = 2026-02-28T22:00:00 BRT (turno PM)
 * Shift start times: amStart=07:00, pmStart=19:00 (America/Sao_Paulo)
 * PM shift started at 19:00 BRT → 3 hours ago relative to MOCK_NOW
 */

import { describe, it, expect } from 'vitest';
import { computeHuddleCadence, huddleCadenceLabel } from './lswCadence';
import type { HuddleCadenceState } from './lswCadence';
import { MOCK_NOW, CURRENT_SHIFT_KEY, PREV_SHIFT_KEY } from './fixtures';

// ── computeHuddleCadence ──────────────────────────────────────────────────────

describe('computeHuddleCadence', () => {
    it('returns OK when lastHuddleShiftKey matches the current shift', () => {
        const result = computeHuddleCadence(MOCK_NOW, { lastHuddleShiftKey: CURRENT_SHIFT_KEY });
        expect(result.status).toBe('OK');
        expect(result.currentShiftKey).toBe(CURRENT_SHIFT_KEY);
        expect(result.lastCompletedShiftKey).toBe(CURRENT_SHIFT_KEY);
        expect(result.overdueBucket).toBeNull();
    });

    it('returns OVERDUE when no huddle done and shift started > graceMinutes ago', () => {
        // MOCK_NOW is 22:00 BRT; PM shift started at 19:00 = 180min ago — well past 30min grace
        const result = computeHuddleCadence(MOCK_NOW, { lastHuddleShiftKey: PREV_SHIFT_KEY });
        expect(result.status).toBe('OVERDUE');
        expect(result.currentShiftKey).toBe(CURRENT_SHIFT_KEY);
        expect(result.overdueBucket).not.toBeNull();
    });

    it('returns DUE within grace period (15 min after shift start)', () => {
        // Build a time 15min after PM shift start in BRT (19:15 BRT = 22:15 UTC)
        const pmStart = new Date('2026-02-28T22:15:00.000Z'); // 19:15 BRT
        const result = computeHuddleCadence(pmStart, {
            lastHuddleShiftKey: PREV_SHIFT_KEY,
            lswGraceMinutes: 30,
        });
        expect(result.status).toBe('DUE');
        expect(result.minutesSinceShiftStart).toBeCloseTo(15, 0);
        expect(result.overdueBucket).not.toBeNull();
    });

    it('returns OVERDUE just after grace period expires (31 min after shift start)', () => {
        // 19:31 BRT = 22:31 UTC
        const justAfterGrace = new Date('2026-02-28T22:31:00.000Z');
        const result = computeHuddleCadence(justAfterGrace, {
            lastHuddleShiftKey: PREV_SHIFT_KEY,
            lswGraceMinutes: 30,
        });
        expect(result.status).toBe('OVERDUE');
    });

    it('respects custom lswGraceMinutes', () => {
        // 5 min after PM shift start; custom grace = 10min → still DUE
        const fiveMinAfterPm = new Date('2026-02-28T22:05:00.000Z'); // 19:05 BRT
        const resultDue = computeHuddleCadence(fiveMinAfterPm, {
            lastHuddleShiftKey: PREV_SHIFT_KEY,
            lswGraceMinutes: 10,
        });
        expect(resultDue.status).toBe('DUE');

        // 11 min after PM shift start; custom grace = 10min → OVERDUE
        const elevenMinAfterPm = new Date('2026-02-28T22:11:00.000Z'); // 19:11 BRT
        const resultOverdue = computeHuddleCadence(elevenMinAfterPm, {
            lastHuddleShiftKey: PREV_SHIFT_KEY,
            lswGraceMinutes: 10,
        });
        expect(resultOverdue.status).toBe('OVERDUE');
    });

    it('returns DUE at the very start of AM shift (07:00)', () => {
        // 07:00 BRT = 10:00 UTC
        const amStart = new Date('2026-03-01T10:00:00.000Z');
        const result = computeHuddleCadence(amStart, {
            lastHuddleShiftKey: CURRENT_SHIFT_KEY, // PM shift key (yesterday night)
        });
        // AM shift key for 2026-03-01 07:00 BRT should be '2026-03-01-AM'
        expect(result.currentShiftKey).toBe('2026-03-01-AM');
        // lastHuddleShiftKey ('2026-02-28-PM') !== '2026-03-01-AM' → not OK
        // minutesSinceShiftStart = 0 → 0 < 30 grace → DUE
        expect(result.status).toBe('DUE');
    });

    it('lastCompletedShiftKey is undefined when no huddle was ever done', () => {
        const result = computeHuddleCadence(MOCK_NOW, { lastHuddleShiftKey: undefined });
        expect(result.lastCompletedShiftKey).toBeUndefined();
        expect(result.status).toBe('OVERDUE');
    });

    it('minutesSinceShiftStart is 0 when status is OK', () => {
        const result = computeHuddleCadence(MOCK_NOW, { lastHuddleShiftKey: CURRENT_SHIFT_KEY });
        expect(result.minutesSinceShiftStart).toBe(0);
    });

    it('overdueBucket reflects ">1h" range for 90min delay', () => {
        // 20:30 BRT = 23:30 UTC — 90min after PM start at 19:00
        const ninetyMin = new Date('2026-02-28T23:30:00.000Z');
        const result = computeHuddleCadence(ninetyMin, { lastHuddleShiftKey: PREV_SHIFT_KEY });
        expect(result.status).toBe('OVERDUE');
        expect(result.overdueBucket).toBe('>1h');
    });

    it('overdueBucket reflects ">2h" range for 150min delay', () => {
        // 21:30 BRT = 2026-03-01T00:30 UTC — 150min after PM start at 19:00
        const twoHalfHours = new Date('2026-03-01T00:30:00.000Z');
        const result = computeHuddleCadence(twoHalfHours, { lastHuddleShiftKey: PREV_SHIFT_KEY });
        expect(result.overdueBucket).toBe('>2h');
    });
});

// ── huddleCadenceLabel ────────────────────────────────────────────────────────

describe('huddleCadenceLabel', () => {
    it('returns "Huddle concluído ✓" for OK status', () => {
        const state: HuddleCadenceState = {
            status: 'OK',
            currentShiftKey: CURRENT_SHIFT_KEY,
            lastCompletedShiftKey: CURRENT_SHIFT_KEY,
            minutesSinceShiftStart: 0,
            overdueBucket: null,
        };
        expect(huddleCadenceLabel(state)).toBe('Huddle concluído ✓');
    });

    it('returns pending label with bucket for DUE status', () => {
        const state: HuddleCadenceState = {
            status: 'DUE',
            currentShiftKey: CURRENT_SHIFT_KEY,
            lastCompletedShiftKey: undefined,
            minutesSinceShiftStart: 15,
            overdueBucket: '0-30min',
        };
        expect(huddleCadenceLabel(state)).toBe('Huddle pendente (0-30min)');
    });

    it('returns warning label with bucket for OVERDUE status', () => {
        const state: HuddleCadenceState = {
            status: 'OVERDUE',
            currentShiftKey: CURRENT_SHIFT_KEY,
            lastCompletedShiftKey: undefined,
            minutesSinceShiftStart: 90,
            overdueBucket: '>1h',
        };
        expect(huddleCadenceLabel(state)).toBe('⚠ Huddle em atraso (>1h)');
    });
});
