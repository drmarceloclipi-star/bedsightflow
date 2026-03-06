/**
 * functions/src/shared/__tests__/shiftKey.test.ts
 *
 * Unit tests for computeShiftKey() in shared/shiftKey.ts (R1 — unified shiftKey).
 *
 * Verifies that the canonical Cloud Function implementation produces the same
 * results as the logic it replaced (computeShiftKeySnapshot was an inline copy).
 *
 * Fixed timezone: America/Sao_Paulo (UTC-3 standard, UTC-2 summer — but BRT is UTC-3)
 * 2026-03-01T01:00:00Z  = 2026-02-28 22:00 BRT  →  PM shift
 * 2026-03-01T10:00:00Z  = 2026-03-01 07:00 BRT  →  AM shift start
 * 2026-03-01T22:05:00Z  = 2026-03-01 19:05 BRT  →  PM shift
 * 2026-03-01T09:59:00Z  = 2026-03-01 06:59 BRT  →  madrugada → prev-day PM
 */

import { computeShiftKey } from '../shiftKey'

describe('computeShiftKey (shared/shiftKey)', () => {
    it('returns PM for times in the PM window (19:00–23:59 BRT)', () => {
        // 2026-02-28 22:00 BRT = UTC+0 + 3h offset → 2026-03-01T01:00:00Z
        const now = new Date('2026-03-01T01:00:00.000Z')
        expect(computeShiftKey(now)).toBe('2026-02-28-PM')
    })

    it('returns AM for times in the AM window (07:00–18:59 BRT)', () => {
        // 2026-03-01 07:00 BRT = 2026-03-01T10:00:00Z
        const now = new Date('2026-03-01T10:00:00.000Z')
        expect(computeShiftKey(now)).toBe('2026-03-01-AM')
    })

    it('returns previous-day PM for madrugada (00:00–06:59 BRT)', () => {
        // 2026-03-01 06:59 BRT = 2026-03-01T09:59:00Z → belongs to 2026-02-28-PM
        const now = new Date('2026-03-01T09:59:00.000Z')
        expect(computeShiftKey(now)).toBe('2026-02-28-PM')
    })

    it('returns PM at exact PM start time', () => {
        // 2026-03-01 19:00 BRT = 2026-03-01T22:00:00Z
        const now = new Date('2026-03-01T22:00:00.000Z')
        expect(computeShiftKey(now)).toBe('2026-03-01-PM')
    })

    it('returns AM one minute before PM start', () => {
        // 2026-03-01 18:59 BRT = 2026-03-01T21:59:00Z
        const now = new Date('2026-03-01T21:59:00.000Z')
        expect(computeShiftKey(now)).toBe('2026-03-01-AM')
    })

    it('respects custom amStart and pmStart', () => {
        // Custom: AM=06:00, PM=18:00
        // 2026-03-01 06:00 BRT = 2026-03-01T09:00:00Z → AM
        const now = new Date('2026-03-01T09:00:00.000Z')
        expect(computeShiftKey(now, '06:00', '18:00')).toBe('2026-03-01-AM')
    })

    it('handles month crossover (PM of last day of month)', () => {
        // 2026-03-01 05:00 BRT = 2026-03-01T08:00:00Z → madrugada → 2026-02-28-PM
        const now = new Date('2026-03-01T08:00:00.000Z')
        expect(computeShiftKey(now)).toBe('2026-02-28-PM')
    })

    it('handles year crossover (madrugada on Jan 1 → Dec 31 PM)', () => {
        // 2027-01-01 05:00 BRT = 2027-01-01T08:00:00Z → 2026-12-31-PM
        const now = new Date('2027-01-01T08:00:00.000Z')
        expect(computeShiftKey(now)).toBe('2026-12-31-PM')
    })
})
