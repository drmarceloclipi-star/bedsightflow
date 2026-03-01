/**
 * shiftKey.test.ts — P0 unit tests for computeShiftKey
 *
 * All times are expressed as UTC instants that correspond to specific BRT (America/Sao_Paulo, UTC-3) times.
 * Format: new Date('YYYY-MM-DDTHH:MM:00Z') where HH = BRT_HH + 3
 *
 * No real clock is used. Timezone is always passed explicitly.
 */

import { describe, it, expect } from 'vitest';
import { computeShiftKey, DEFAULT_SHIFT_SCHEDULE } from './shiftKey';
import type { ShiftSchedule } from './shiftKey';

// BRT = UTC-3 → UTC = BRT+3
// Helper: create a Date for a given BRT time on 2026-02-28
function brt(hh: number, mm: number): Date {
    const utcHH = hh + 3;
    const dateStr = utcHH >= 24
        ? `2026-03-01T${String(utcHH - 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`
        : `2026-02-28T${String(utcHH).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`;
    return new Date(dateStr);
}


const TZ = 'America/Sao_Paulo';

describe('computeShiftKey', () => {
    describe('Default schedule (AM: 07:00, PM: 19:00 BRT)', () => {
        it('06:59 BRT → prev day PM (madrugada < amStart)', () => {
            // 06:59 BRT on 2026-02-28 is still in the "madrugada" window → PM of 2026-02-27
            expect(computeShiftKey(brt(6, 59), DEFAULT_SHIFT_SCHEDULE, TZ)).toBe('2026-02-27-PM');
        });

        it('07:00 BRT → AM (exact amStart boundary, inclusive)', () => {
            expect(computeShiftKey(brt(7, 0), DEFAULT_SHIFT_SCHEDULE, TZ)).toBe('2026-02-28-AM');
        });

        it('12:30 BRT → AM (mid-morning)', () => {
            expect(computeShiftKey(brt(12, 30), DEFAULT_SHIFT_SCHEDULE, TZ)).toBe('2026-02-28-AM');
        });

        it('18:59 BRT → AM (1 minute before pmStart, still AM)', () => {
            expect(computeShiftKey(brt(18, 59), DEFAULT_SHIFT_SCHEDULE, TZ)).toBe('2026-02-28-AM');
        });

        it('19:00 BRT → PM (exact pmStart boundary, inclusive)', () => {
            expect(computeShiftKey(brt(19, 0), DEFAULT_SHIFT_SCHEDULE, TZ)).toBe('2026-02-28-PM');
        });

        it('22:00 BRT → PM (22:00 = MOCK_NOW_BRT → CURRENT_SHIFT_KEY)', () => {
            // This is the exact time used by seed:lean → must yield 2026-02-28-PM
            const mockNow = new Date('2026-03-01T01:00:00.000Z'); // 22:00 BRT
            expect(computeShiftKey(mockNow, DEFAULT_SHIFT_SCHEDULE, TZ)).toBe('2026-02-28-PM');
        });

        it('23:59 BRT → PM (end of day, still PM)', () => {
            expect(computeShiftKey(brt(23, 59), DEFAULT_SHIFT_SCHEDULE, TZ)).toBe('2026-02-28-PM');
        });

        it('03:00 BRT (madrugada) → PM of the previous day', () => {
            // 03:00 BRT on 2026-02-28 → PM of 2026-02-27
            expect(computeShiftKey(brt(3, 0), DEFAULT_SHIFT_SCHEDULE, TZ)).toBe('2026-02-27-PM');
        });
    });

    describe('Custom schedule (AM: 06:00, PM: 18:00)', () => {
        const custom: ShiftSchedule = { amStart: '06:00', pmStart: '18:00' };

        it('05:59 BRT → prev day PM (before custom amStart)', () => {
            expect(computeShiftKey(brt(5, 59), custom, TZ)).toBe('2026-02-27-PM');
        });

        it('06:00 BRT → AM (custom amStart boundary)', () => {
            expect(computeShiftKey(brt(6, 0), custom, TZ)).toBe('2026-02-28-AM');
        });

        it('17:59 BRT → AM (before custom pmStart)', () => {
            expect(computeShiftKey(brt(17, 59), custom, TZ)).toBe('2026-02-28-AM');
        });

        it('18:00 BRT → PM (custom pmStart boundary)', () => {
            expect(computeShiftKey(brt(18, 0), custom, TZ)).toBe('2026-02-28-PM');
        });
    });

    describe('Timezone independence', () => {
        it('Same UTC instant → different shiftKey in different timezones', () => {
            // UTC 10:00 = 07:00 BRT (AM) = 09:00 UTC+1 (also AM but different date shifts)
            const utc10 = new Date('2026-02-28T10:00:00.000Z');
            const keyBRT = computeShiftKey(utc10, DEFAULT_SHIFT_SCHEDULE, 'America/Sao_Paulo');
            const keyUTC = computeShiftKey(utc10, DEFAULT_SHIFT_SCHEDULE, 'UTC');
            // BRT: 07:00 → AM of 2026-02-28
            expect(keyBRT).toBe('2026-02-28-AM');
            // UTC: 10:00 → AM of 2026-02-28 (07:00 UTC <= 10:00 < 19:00 UTC → AM)
            expect(keyUTC).toBe('2026-02-28-AM');

            // At 22:00 BRT, UTC is 01:00 next day — timezone matters for the DATE
            const brt22 = new Date('2026-03-01T01:00:00.000Z'); // 22:00 BRT on 2026-02-28
            const keyBRT22 = computeShiftKey(brt22, DEFAULT_SHIFT_SCHEDULE, 'America/Sao_Paulo');
            const keyUTC22 = computeShiftKey(brt22, DEFAULT_SHIFT_SCHEDULE, 'UTC');
            expect(keyBRT22).toBe('2026-02-28-PM'); // BRT: correct date and shift
            // UTC tz: local date is 2026-03-01, 01:00 < 07:00 amStart → madrugada
            // → subtractOneDay('2026-03-01') = '2026-02-28' → '2026-02-28-PM'
            expect(keyUTC22).toBe('2026-02-28-PM');
        });

        it('Explicit America/Sao_Paulo result is always stable and independent of test runner locale', () => {
            const d = new Date('2026-02-28T13:00:00.000Z'); // 10:00 BRT
            expect(computeShiftKey(d, DEFAULT_SHIFT_SCHEDULE, 'America/Sao_Paulo')).toBe('2026-02-28-AM');
        });
    });
});
