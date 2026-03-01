/**
 * functions/src/shared/__tests__/escalation.test.ts
 *
 * P0 unit tests for computeEscalations (pure function — no Firestore).
 * Fixed clock: MOCK_NOW = 2026-03-01T01:00:00.000Z (22:00 BRT).
 * Mirrors frontend src/domain/escalation.test.ts cases.
 */

import {
    computeEscalations,
    DEFAULT_ESCALATION_THRESHOLDS,
    type EscalationThresholds,
} from '../escalation'

const MOCK_NOW_ISO = '2026-03-01T01:00:00.000Z'
const MOCK_NOW = new Date(MOCK_NOW_ISO)

/** Returns an ISO string N hours before MOCK_NOW */
function hoursAgo(n: number): string {
    return new Date(MOCK_NOW.getTime() - n * 3600_000).toISOString()
}

/** Returns an ISO string N hours after MOCK_NOW */
function hoursFromNow(n: number): string {
    return new Date(MOCK_NOW.getTime() + n * 3600_000).toISOString()
}

const DEFAULT = DEFAULT_ESCALATION_THRESHOLDS // critical: overdue≥12h, blocker≥24h

// ── Helpers ───────────────────────────────────────────────────────────────────

function activeBed(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { id, patientAlias: 'P.S.', ...overrides }
}

function emptyBed(id: string): Record<string, unknown> {
    return { id, patientAlias: '' }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeEscalations', () => {

    describe('empty beds are ignored', () => {
        it('returns zero for an empty unit', () => {
            const result = computeEscalations([], DEFAULT, MOCK_NOW)
            expect(result.total).toBe(0)
            expect(result.overdueCriticalBedIds).toHaveLength(0)
            expect(result.blockerCriticalBedIds).toHaveLength(0)
        })

        it('ignores beds with empty patientAlias', () => {
            const result = computeEscalations([emptyBed('B01'), emptyBed('B02')], DEFAULT, MOCK_NOW)
            expect(result.total).toBe(0)
        })

        it('ignores beds with whitespace-only patientAlias', () => {
            const result = computeEscalations([{ id: 'B01', patientAlias: '   ' }], DEFAULT, MOCK_NOW)
            expect(result.total).toBe(0)
        })
    })

    describe('OVERDUE_CRITICAL — pendency past dueAt ≥ critical hours', () => {
        it('counts bed as OVERDUE_CRITICAL when dueAt is exactly critical hours ago', () => {
            const bed = activeBed('BED_OD', {
                pendencies: [{ id: 'P1', status: 'open', dueAt: hoursAgo(12) }],
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.overdueCriticalBedIds).toContain('BED_OD')
            expect(result.total).toBe(1)
        })

        it('does NOT count bed when dueAt is 11h59m ago (below critical)', () => {
            const bed = activeBed('BED_OK', {
                pendencies: [{ id: 'P1', status: 'open', dueAt: hoursAgo(11.99) }],
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.overdueCriticalBedIds).not.toContain('BED_OK')
        })

        it('ignores done/canceled pendencies even if overdue', () => {
            const bed = activeBed('BED_DONE', {
                pendencies: [
                    { id: 'P1', status: 'done', dueAt: hoursAgo(24) },
                    { id: 'P2', status: 'canceled', dueAt: hoursAgo(24) },
                ],
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.overdueCriticalBedIds).not.toContain('BED_DONE')
        })

        it('counts bed only once even with multiple overdue pendencies', () => {
            const bed = activeBed('BED_MULTI', {
                pendencies: [
                    { id: 'P1', status: 'open', dueAt: hoursAgo(14) },
                    { id: 'P2', status: 'open', dueAt: hoursAgo(18) },
                ],
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.overdueCriticalBedIds.filter((id: string) => id === 'BED_MULTI')).toHaveLength(1)
        })

        it('ignores pendencies without dueAt', () => {
            const bed = activeBed('BED_NO_DUE', {
                pendencies: [{ id: 'P1', status: 'open' }],
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.overdueCriticalBedIds).not.toContain('BED_NO_DUE')
        })

        it('filters by escalationOverdueDomains when specified', () => {
            const customThresholds: EscalationThresholds = {
                ...DEFAULT,
                escalationOverdueDomains: ['medical'],
            }
            const bedWithNursing = activeBed('BED_NURSING', {
                pendencies: [{ id: 'P1', status: 'open', dueAt: hoursAgo(24), domain: 'nursing' }],
            })
            const bedWithMedical = activeBed('BED_MEDICAL', {
                pendencies: [{ id: 'P2', status: 'open', dueAt: hoursAgo(24), domain: 'medical' }],
            })
            const result = computeEscalations([bedWithNursing, bedWithMedical], customThresholds, MOCK_NOW)
            expect(result.overdueCriticalBedIds).not.toContain('BED_NURSING')
            expect(result.overdueCriticalBedIds).toContain('BED_MEDICAL')
        })
    })

    describe('MAIN_BLOCKER_CRITICAL — blocker aging ≥ critical hours', () => {
        it('counts bed when mainBlockerBlockedAt is ≥ 24h ago', () => {
            const bed = activeBed('BED_BLOCK', {
                mainBlocker: 'Imaging',
                mainBlockerBlockedAt: hoursAgo(24),
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.blockerCriticalBedIds).toContain('BED_BLOCK')
            expect(result.total).toBe(1)
        })

        it('does NOT count when mainBlockerBlockedAt is 23h59m ago', () => {
            const bed = activeBed('BED_OK', {
                mainBlocker: 'Imaging',
                mainBlockerBlockedAt: hoursAgo(23.99),
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.blockerCriticalBedIds).not.toContain('BED_OK')
        })

        it('falls back to updatedAt when mainBlockerBlockedAt is absent', () => {
            const bed = activeBed('BED_FALLBACK', {
                mainBlocker: 'Transport',
                updatedAt: hoursAgo(25),
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.blockerCriticalBedIds).toContain('BED_FALLBACK')
        })

        it('does not count a bed without a mainBlocker string even with mainBlockerBlockedAt', () => {
            const bed = activeBed('BED_NO_BLOCKER', {
                mainBlocker: '',
                mainBlockerBlockedAt: hoursAgo(30),
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.blockerCriticalBedIds).not.toContain('BED_NO_BLOCKER')
        })
    })

    describe('aggregation — total deduplication', () => {
        it('total counts each bed only once when both overdue and blocked', () => {
            const bed = activeBed('BED_BOTH', {
                mainBlocker: 'Lab',
                mainBlockerBlockedAt: hoursAgo(30),
                pendencies: [{ id: 'P1', status: 'open', dueAt: hoursAgo(20) }],
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.total).toBe(1)
            expect(result.overdueCriticalBedIds).toContain('BED_BOTH')
            expect(result.blockerCriticalBedIds).toContain('BED_BOTH')
        })

        it('aggregates multiple beds correctly', () => {
            const beds = [
                activeBed('B1', { mainBlocker: 'Lab', mainBlockerBlockedAt: hoursAgo(30) }),
                activeBed('B2', { pendencies: [{ id: 'P1', status: 'open', dueAt: hoursAgo(14) }] }),
                activeBed('B3', { patientAlias: 'Safe' }), // no escalation triggers
                emptyBed('B4'),
            ]
            const result = computeEscalations(beds, DEFAULT, MOCK_NOW)
            expect(result.total).toBe(2)
            expect(result.blockerCriticalBedIds).toContain('B1')
            expect(result.overdueCriticalBedIds).toContain('B2')
            expect(result.total).not.toBeGreaterThan(3)
        })
    })

    describe('DEFAULT_ESCALATION_THRESHOLDS values', () => {
        it('has correct default critical thresholds', () => {
            expect(DEFAULT_ESCALATION_THRESHOLDS.escalationOverdueHoursCritical).toBe(12)
            expect(DEFAULT_ESCALATION_THRESHOLDS.escalationMainBlockerHoursCritical).toBe(24)
            expect(DEFAULT_ESCALATION_THRESHOLDS.escalationOverdueHoursWarning).toBe(6)
            expect(DEFAULT_ESCALATION_THRESHOLDS.escalationMainBlockerHoursWarning).toBe(8)
        })
    })

    describe('future dueAt is not overdue', () => {
        it('does NOT count a bed with dueAt in the future', () => {
            const bed = activeBed('BED_FUTURE', {
                pendencies: [{ id: 'P1', status: 'open', dueAt: hoursFromNow(2) }],
            })
            const result = computeEscalations([bed], DEFAULT, MOCK_NOW)
            expect(result.overdueCriticalBedIds).not.toContain('BED_FUTURE')
        })
    })
})
