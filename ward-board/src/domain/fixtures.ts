/**
 * fixtures.ts — Shared test fixtures for Lean Core unit tests
 *
 * Ref: docs/lean/SEED_LEAN_CONTRACT_2026-02-28.md
 * Clock = MOCK_NOW_ISO — same epoch as seed:lean
 */

import type { Bed, Pendency } from './types';

// ── Fixed Clock ───────────────────────────────────────────────────────────────
// 2026-02-28T22:00:00 BRT = 2026-03-01T01:00:00Z
export const MOCK_NOW_ISO = '2026-03-01T01:00:00.000Z';
export const MOCK_NOW = new Date(MOCK_NOW_ISO);

// ── Shift keys derived from MOCK_NOW ─────────────────────────────────────────
export const CURRENT_SHIFT_KEY = '2026-02-28-PM'; // 22h BRT >= 19h → PM
export const PREV_SHIFT_KEY = '2026-02-28-AM';

// ── Helper ───────────────────────────────────────────────────────────────────
const MOCK_NOW_MS = MOCK_NOW.getTime();

/** Returns an ISO string at MOCK_NOW minus `hours` hours. */
export function hoursAgo(hours: number): string {
    return new Date(MOCK_NOW_MS - hours * 3_600_000).toISOString();
}

/** Returns an ISO string at MOCK_NOW plus `hours` hours. */
export function hoursFromNow(hours: number): string {
    return new Date(MOCK_NOW_MS + hours * 3_600_000).toISOString();
}

// ── Reusable Kamishibai entries ───────────────────────────────────────────────
const actor = { id: 'seed', name: 'System Seed' } as const;

export function kamOk(shiftKey: string = CURRENT_SHIFT_KEY) {
    return { status: 'ok' as const, reviewedShiftKey: shiftKey, reviewedAt: hoursAgo(2), updatedAt: hoursAgo(2), updatedBy: actor, note: '' };
}
export const kamBlocked = { status: 'blocked' as const, blockedAt: hoursAgo(10), updatedAt: hoursAgo(10), updatedBy: actor, note: '' };
export const kamNa = { status: 'na' as const, updatedAt: hoursAgo(24), updatedBy: actor, note: '' };

// ── Base bed builder ─────────────────────────────────────────────────────────
function baseBed(id: string, overrides: Partial<Bed> = {}): Bed {
    return {
        id,
        number: id,
        unitId: 'A',
        patientAlias: 'J.D.',
        mainBlocker: '',
        expectedDischarge: '2-3_days',
        applicableDomains: ['medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social'],
        kamishibai: {
            medical: kamOk(),
            nursing: kamOk(),
            physio: kamOk(),
            nutrition: kamOk(),
            psychology: kamOk(),
            social: kamOk(),
        },
        pendencies: [],
        updatedAt: hoursAgo(1),
        updatedBy: actor,
        ...overrides,
    } as Bed;
}

// ── Pre-built fixture beds ────────────────────────────────────────────────────

/** Empty bed — INACTIVE */
export const bedEmpty: Bed = baseBed('bed_EMPTY', { patientAlias: '' });

/** OK — all domains reviewed this shift */
export const bedOkReviewedCurrentShift: Bed = baseBed('bed_OK');

/** UNREVIEWED — all domains reviewed in prev shift */
export const bedOkReviewedPrevShift: Bed = baseBed('bed_UNREVIEWED', {
    kamishibai: {
        medical: kamOk(PREV_SHIFT_KEY),
        nursing: kamOk(PREV_SHIFT_KEY),
        physio: kamOk(PREV_SHIFT_KEY),
        nutrition: kamOk(PREV_SHIFT_KEY),
        psychology: kamOk(PREV_SHIFT_KEY),
        social: kamOk(PREV_SHIFT_KEY),
    } as Bed['kamishibai'],
});

/** BLOCKED — medical domain blocked 10h ago */
export const bedBlockedWithBlockedAt: Bed = baseBed('bed_BLOCKED', {
    mainBlocker: 'Aguardando exame',
    mainBlockerBlockedAt: hoursAgo(10),
    kamishibai: {
        medical: kamBlocked,
        nursing: kamOk(),
        physio: kamOk(),
        nutrition: kamOk(),
        psychology: kamOk(),
        social: kamOk(),
    } as Bed['kamishibai'],
});

/** NOT_APPLICABLE — psychology and social excluded from applicableDomains */
export const bedNotApplicable: Bed = baseBed('bed_NA', {
    applicableDomains: ['medical', 'nursing', 'physio', 'nutrition'],
    kamishibai: {
        medical: kamOk(),
        nursing: kamOk(),
        physio: kamOk(),
        nutrition: kamOk(),
        psychology: kamNa,
        social: kamNa,
    } as Bed['kamishibai'],
});

const pendKey: Omit<Pendency, 'id' | 'status' | 'createdAt'> = {
    title: 'Exame pendente (fixture)',
    createdBy: actor,
};

/** Pendencies — overdue (dueAt 14h ago → overdue critical) */
export const bedPendenciesOverdue: Bed = baseBed('bed_PEND_OVERDUE', {
    pendencies: [
        { id: 'PEND_OVERDUE_1', status: 'open', createdAt: hoursAgo(20), dueAt: hoursAgo(14), ...pendKey },
        { id: 'PEND_DONE_1', status: 'done', createdAt: hoursAgo(30), doneAt: hoursAgo(4), ...pendKey },
    ] as Pendency[],
});

/** MainBlocker critical — blocked 29h ago ≥ 24h threshold */
export const bedMainBlockerCritical: Bed = baseBed('bed_BLOCKER_CRITICAL', {
    mainBlocker: 'Aguardando CTI',
    mainBlockerBlockedAt: hoursAgo(29),
});
