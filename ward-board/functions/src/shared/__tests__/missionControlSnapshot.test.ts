/**
 * functions/src/shared/__tests__/missionControlSnapshot.test.ts
 *
 * P0/P1 unit tests for buildSnapshot() — pure function, no Firestore.
 * Fixed clock: MOCK_NOW = 2026-03-01T01:00:00.000Z (= 2026-02-28 22:00 BRT → PM shift).
 *
 * Proves:
 * 1. Uses mainBlockerBlockedAt  + generates warning when missing (falls back to updatedAt)
 * 2. Uses computeEscalations (shared SSoT)
 * 3. Respects kamishibaiEnabled=false (zeroes kamishibai metrics)
 */

import {
    buildSnapshot,
    DEFAULT_THRESHOLDS,
    type MissionControlThresholdsDoc,
    type SnapshotOpsSettings,
} from '../../callables/analytics/getAdminMissionControlSnapshot'

const MOCK_NOW_ISO = '2026-03-01T01:00:00.000Z'
const MOCK_NOW = new Date(MOCK_NOW_ISO)
// 2026-03-01T01:00:00Z  ≡  2026-02-28 22:00 BRT → CURRENT_SHIFT_KEY = 2026-02-28-PM
// CURRENT_SHIFT is used to verify reviewedShiftKey checks below
const CURRENT_SHIFT = '2026-02-28-PM'

function hoursAgo(n: number): string {
    return new Date(MOCK_NOW.getTime() - n * 3600_000).toISOString()
}

function hoursFromNow(n: number): string {
    return new Date(MOCK_NOW.getTime() + n * 3600_000).toISOString()
}

const DEFAULT_OPS: SnapshotOpsSettings = { kamishibaiEnabled: true }
const DEFAULT_THR: MissionControlThresholdsDoc = {}

function activeBed(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { id, patientAlias: 'P.S.', ...overrides }
}

function emptyBed(id: string): Record<string, unknown> {
    return { id, patientAlias: '' }
}

// ── Suite 1: Basic structure ─────────────────────────────────────────────────

describe('buildSnapshot — basic structure', () => {
    it('returns v1 shape with zero counts for empty unit', () => {
        const result = buildSnapshot([], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.definitionsVersion).toBe('v1')
        expect(result.source).toBe('snapshot_firestore')
        expect(result.activeBedsCount).toBe(0)
        expect(result.totalBedsCount).toBe(0)
        expect(result.blockedBedsCount).toBe(0)
        expect((result.escalations as { total: number }).total).toBe(0)
    })

    it('counts only active beds (excludes empty)', () => {
        const beds = [activeBed('B1'), emptyBed('B2'), activeBed('B3')]
        const result = buildSnapshot(beds, DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.totalBedsCount).toBe(3)
        expect(result.activeBedsCount).toBe(2)
    })

    it('merges rawThresholds with defaults', () => {
        const thr: MissionControlThresholdsDoc = { blockedPctWarning: 10 }
        const result = buildSnapshot([], DEFAULT_OPS, thr, MOCK_NOW) as Record<string, unknown>
        const used = result.thresholdsUsed as Record<string, number>
        expect(used.blockedPctWarning).toBe(10)               // overridden
        expect(used.blockedPctCritical).toBe(DEFAULT_THRESHOLDS.blockedPctCritical) // default
    })

    it('embeds generatedAt equal to now.toISOString()', () => {
        const result = buildSnapshot([], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.generatedAt).toBe(MOCK_NOW_ISO)
    })
})

// ── Suite 2: mainBlockerBlockedAt usage + warning ────────────────────────────

describe('buildSnapshot — KPI1 blocked aging (mainBlockerBlockedAt)', () => {
    it('uses mainBlockerBlockedAt for aging when present', () => {
        const bed = activeBed('B1', {
            mainBlocker: 'Lab',
            mainBlockerBlockedAt: hoursAgo(10),
            updatedAt: hoursAgo(2),
        })
        const result = buildSnapshot([bed], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        const aging = result.blockedAgingHoursByBedId as Record<string, number>
        expect(aging['B1']).toBe(10)
        expect(result.warnings).toBeUndefined()
    })

    it('falls back to updatedAt and emits WARN_BLOCKED_AT_MISSING when mainBlockerBlockedAt absent', () => {
        const bed = activeBed('B1', {
            mainBlocker: 'Transport',
            updatedAt: hoursAgo(5),
            // no mainBlockerBlockedAt
        })
        const result = buildSnapshot([bed], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        const aging = result.blockedAgingHoursByBedId as Record<string, number>
        expect(aging['B1']).toBe(5)
        expect(result.warnings).toBeDefined()
        const warnings = result.warnings as string[]
        expect(warnings.some(w => w.includes('WARN_BLOCKED_AT_MISSING'))).toBe(true)
        const fallbacks = result.blockedAgingFallbackBedIds as string[]
        expect(fallbacks).toContain('B1')
    })

    it('does NOT emit warning when mainBlockerBlockedAt is present', () => {
        const bed = activeBed('B2', {
            mainBlocker: 'Imaging',
            mainBlockerBlockedAt: hoursAgo(8),
        })
        const result = buildSnapshot([bed], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.warnings).toBeUndefined()
        expect(result.blockedAgingFallbackBedIds).toBeUndefined()
    })
})

// ── Suite 3: escalations use computeEscalations (SSoT) ──────────────────────

describe('buildSnapshot — escalations (computeEscalations SSoT)', () => {
    it('escalations.total counts overdue-critical beds (≥12h overdue)', () => {
        const bed = activeBed('BESC1', {
            pendencies: [{ id: 'P1', status: 'open', dueAt: hoursAgo(13) }],
        })
        const result = buildSnapshot([bed], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        const esc = result.escalations as { total: number; overdueCritical: number; overdueCriticalBedIds: string[] }
        expect(esc.total).toBe(1)
        expect(esc.overdueCritical).toBe(1)
        expect(esc.overdueCriticalBedIds).toContain('BESC1')
    })

    it('escalations.total counts blocker-critical beds (≥24h blocked)', () => {
        const bed = activeBed('BESC2', {
            mainBlocker: 'ICU',
            mainBlockerBlockedAt: hoursAgo(25),
        })
        const result = buildSnapshot([bed], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        const esc = result.escalations as { total: number; blockerCritical: number; blockerCriticalBedIds: string[] }
        expect(esc.total).toBe(1)
        expect(esc.blockerCritical).toBe(1)
        expect(esc.blockerCriticalBedIds).toContain('BESC2')
    })

    it('escalations total does NOT double-count a bed that is both overdue and blocked', () => {
        const bed = activeBed('BESC3', {
            mainBlocker: 'Imaging',
            mainBlockerBlockedAt: hoursAgo(30),
            pendencies: [{ id: 'P1', status: 'open', dueAt: hoursAgo(15) }],
        })
        const result = buildSnapshot([bed], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        const esc = result.escalations as { total: number }
        expect(esc.total).toBe(1)
    })

    it('empty beds do not appear in escalations', () => {
        const result = buildSnapshot([emptyBed('BE')], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect((result.escalations as { total: number }).total).toBe(0)
    })

    it('respects custom escalation threshold in thresholds arg', () => {
        // Set critical blocker to 48h — a 25h-blocked bed should NOT count
        const strictThr: MissionControlThresholdsDoc = { escalationMainBlockerHoursCritical: 48 }
        const bed = activeBed('BESC4', {
            mainBlocker: 'Lab',
            mainBlockerBlockedAt: hoursAgo(25),
        })
        const result = buildSnapshot([bed], DEFAULT_OPS, strictThr, MOCK_NOW) as Record<string, unknown>
        expect((result.escalations as { total: number }).total).toBe(0)
    })
})

// ── Suite 4: kamishibaiEnabled=false zeroes all kamishibai metrics ────────────

describe('buildSnapshot — kamishibaiEnabled=false', () => {
    const UNREVIEWED_BED = activeBed('BK2', {
        // reviewedShiftKey is an old shift — i.e. NOT CURRENT_SHIFT
        kamishibai: {
            medical: { status: 'ok', reviewedShiftKey: 'old-shift', reviewedAt: hoursAgo(3) },
        },
    })

    it('unreviewedBedsCount is 0 when kamishibaiEnabled=false', () => {
        const ops: SnapshotOpsSettings = { kamishibaiEnabled: false }
        const result = buildSnapshot([UNREVIEWED_BED], ops, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.unreviewedBedsCount).toBe(0)
        expect(result.unreviewedBedIds).toEqual([])
        expect(result.unreviewedByDomainCount).toEqual({})
    })

    it('unreviewedBedsCount is > 0 when kamishibaiEnabled=true and bed not reviewed this shift', () => {
        const ops: SnapshotOpsSettings = { kamishibaiEnabled: true }
        // CURRENT_SHIFT = '2026-02-28-PM', but UNREVIEWED_BED has reviewedShiftKey='old-shift'
        expect(CURRENT_SHIFT).not.toBe('old-shift') // sanity check
        const result = buildSnapshot([UNREVIEWED_BED], ops, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.unreviewedBedsCount).toBeGreaterThan(0)
    })

    it('kamishibaiEnabled=false does NOT affect blocked KPI (KPI1)', () => {
        const ops: SnapshotOpsSettings = { kamishibaiEnabled: false }
        const bed = activeBed('BK3', { mainBlocker: 'Imaging', mainBlockerBlockedAt: hoursAgo(2) })
        const result = buildSnapshot([bed], ops, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.blockedBedsCount).toBe(1)
    })

    it('kamishibaiEnabled=false does NOT affect escalations', () => {
        const ops: SnapshotOpsSettings = { kamishibaiEnabled: false }
        const bed = activeBed('BK4', {
            pendencies: [{ id: 'P1', status: 'open', dueAt: hoursAgo(14) }],
        })
        const result = buildSnapshot([bed], ops, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect((result.escalations as { total: number }).total).toBe(1)
    })

    it('result explicitly includes kamishibaiEnabled=false flag', () => {
        const ops: SnapshotOpsSettings = { kamishibaiEnabled: false }
        const result = buildSnapshot([], ops, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.kamishibaiEnabled).toBe(false)
    })
})

// ── Suite 5: pendencies ──────────────────────────────────────────────────────

describe('buildSnapshot — pendencies v1', () => {
    it('counts open pendencies and overdue pendencies separately', () => {
        const bed = activeBed('BP1', {
            pendencies: [
                { id: 'P1', status: 'open', dueAt: hoursAgo(3) },   // overdue
                { id: 'P2', status: 'open', dueAt: hoursFromNow(2) }, // not overdue
                { id: 'P3', status: 'done', dueAt: hoursAgo(5) },    // ignored
            ],
        })
        const result = buildSnapshot([bed], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.openPendenciesCount).toBe(2)
        expect(result.overduePendenciesCount).toBe(1)
        expect(result.bedsWithOpenPendenciesCount).toBe(1)
    })

    it('does not count canceled pendencies', () => {
        const bed = activeBed('BP2', {
            pendencies: [{ id: 'P1', status: 'canceled', dueAt: hoursAgo(10) }],
        })
        const result = buildSnapshot([bed], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.openPendenciesCount).toBe(0)
    })

    it('returns zero pendencies for empty beds', () => {
        const result = buildSnapshot([emptyBed('BP3')], DEFAULT_OPS, DEFAULT_THR, MOCK_NOW) as Record<string, unknown>
        expect(result.openPendenciesCount).toBe(0)
        expect(result.overduePendenciesCount).toBe(0)
    })
})
