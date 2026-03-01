/**
 * pendencies.test.ts — P1 unit tests
 *
 * Tests computePendencyCounts, computeUnitPendencyCounts, hasOverdue, formatPendencyBadge.
 * Clock is injected via the `now` parameter — no real Date.now() used.
 */

import { describe, it, expect } from 'vitest';
import {
    computePendencyCounts,
    computeUnitPendencyCounts,
    hasOverdue,
    formatPendencyBadge,
} from './pendencies';
import {
    MOCK_NOW,
    hoursAgo,
    hoursFromNow,
    bedEmpty,
    bedOkReviewedCurrentShift,
    bedPendenciesOverdue,
} from './fixtures';
import type { Bed, Pendency } from './types';

const actor = { id: 'seed', name: 'System Seed' } as const;

function makePendency(id: string, status: Pendency['status'], dueAt?: string): Pendency {
    return {
        id,
        title: `Test pendency ${id}`,
        status,
        createdAt: hoursAgo(10),
        createdBy: actor,
        ...(dueAt ? { dueAt } : {}),
    } as Pendency;
}

describe('computePendencyCounts', () => {
    // ── Empty bed ──────────────────────────────────────────────────────────────
    describe('Empty bed', () => {
        it('patientAlias="" → open=0, overdue=0', () => {
            expect(computePendencyCounts(bedEmpty, MOCK_NOW)).toEqual({ open: 0, overdue: 0 });
        });

        it('patientAlias=undefined → open=0, overdue=0', () => {
            const bed: Bed = { ...bedEmpty, patientAlias: undefined as unknown as string };
            expect(computePendencyCounts(bed, MOCK_NOW)).toEqual({ open: 0, overdue: 0 });
        });
    });

    // ── Counting open pendencies ───────────────────────────────────────────────
    describe('Open pendency counting', () => {
        it('no pendencies → open=0, overdue=0', () => {
            expect(computePendencyCounts(bedOkReviewedCurrentShift, MOCK_NOW)).toEqual({ open: 0, overdue: 0 });
        });

        it('counts only open status (ignores done and canceled)', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                pendencies: [
                    makePendency('p1', 'open'),
                    makePendency('p2', 'done'),
                    makePendency('p3', 'canceled'),
                    makePendency('p4', 'open'),
                ],
            };
            expect(computePendencyCounts(bed, MOCK_NOW)).toEqual({ open: 2, overdue: 0 });
        });

        it('open without dueAt → open++, overdue stays 0 (D4)', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                pendencies: [makePendency('p1', 'open')], // no dueAt
            };
            expect(computePendencyCounts(bed, MOCK_NOW)).toEqual({ open: 1, overdue: 0 });
        });
    });

    // ── Overdue logic ─────────────────────────────────────────────────────────
    describe('Overdue counting (D3: dueAt < now && status=open)', () => {
        it('dueAt 14h ago → overdue (D3)', () => {
            expect(computePendencyCounts(bedPendenciesOverdue, MOCK_NOW)).toMatchObject({
                open: 1,
                overdue: 1,
            });
        });

        it('dueAt == now → NOT overdue (strict <, not <=)', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                pendencies: [makePendency('p1', 'open', MOCK_NOW.toISOString())],
            };
            // dueAt exactly equals now → not yet overdue (D3 uses strict <)
            expect(computePendencyCounts(bed, MOCK_NOW)).toEqual({ open: 1, overdue: 0 });
        });

        it('dueAt 1ms in the future → NOT overdue', () => {
            const futureMs = new Date(MOCK_NOW.getTime() + 1).toISOString();
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                pendencies: [makePendency('p1', 'open', futureMs)],
            };
            expect(computePendencyCounts(bed, MOCK_NOW)).toEqual({ open: 1, overdue: 0 });
        });

        it('dueAt in future → NOT overdue', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                pendencies: [makePendency('p1', 'open', hoursFromNow(2))],
            };
            expect(computePendencyCounts(bed, MOCK_NOW)).toEqual({ open: 1, overdue: 0 });
        });

        it('done pendency with old dueAt → NOT counted (status not open)', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                pendencies: [makePendency('p1', 'done', hoursAgo(20))],
            };
            expect(computePendencyCounts(bed, MOCK_NOW)).toEqual({ open: 0, overdue: 0 });
        });

        it('multiple open pendencies: 2 open, 1 overdue', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                pendencies: [
                    makePendency('p1', 'open', hoursAgo(5)),  // overdue
                    makePendency('p2', 'open'),                // no dueAt → not overdue
                    makePendency('p3', 'open', hoursFromNow(2)), // future → not overdue
                ],
            };
            expect(computePendencyCounts(bed, MOCK_NOW)).toEqual({ open: 3, overdue: 1 });
        });

        it('pendencies=undefined (not array) → treated as empty', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                pendencies: undefined as unknown as Pendency[],
            };
            expect(computePendencyCounts(bed, MOCK_NOW)).toEqual({ open: 0, overdue: 0 });
        });
    });
});

describe('computeUnitPendencyCounts', () => {
    it('sums counts across active beds correctly', () => {
        const bed1: Bed = {
            ...bedOkReviewedCurrentShift,
            id: 'b1',
            pendencies: [makePendency('p1', 'open', hoursAgo(5))], // 1 open, 1 overdue
        };
        const bed2: Bed = {
            ...bedOkReviewedCurrentShift,
            id: 'b2',
            pendencies: [makePendency('p2', 'open'), makePendency('p3', 'open')], // 2 open, 0 overdue
        };
        const bed3: Bed = { ...bedEmpty }; // empty → zeros

        const result = computeUnitPendencyCounts([bed1, bed2, bed3], MOCK_NOW);
        expect(result).toEqual({ open: 3, overdue: 1 });
    });

    it('empty array → open=0, overdue=0', () => {
        expect(computeUnitPendencyCounts([], MOCK_NOW)).toEqual({ open: 0, overdue: 0 });
    });

    it('all empty beds → open=0, overdue=0', () => {
        expect(computeUnitPendencyCounts([bedEmpty, bedEmpty], MOCK_NOW)).toEqual({ open: 0, overdue: 0 });
    });
});

describe('hasOverdue', () => {
    it('bed with overdue pendency → true', () => {
        expect(hasOverdue(bedPendenciesOverdue, MOCK_NOW)).toBe(true);
    });

    it('bed with no pendencies → false', () => {
        expect(hasOverdue(bedOkReviewedCurrentShift, MOCK_NOW)).toBe(false);
    });

    it('empty bed → false', () => {
        expect(hasOverdue(bedEmpty, MOCK_NOW)).toBe(false);
    });

    it('open pendency with future dueAt → false', () => {
        const bed: Bed = {
            ...bedOkReviewedCurrentShift,
            pendencies: [makePendency('p1', 'open', hoursFromNow(4))],
        };
        expect(hasOverdue(bed, MOCK_NOW)).toBe(false);
    });
});

describe('formatPendencyBadge', () => {
    it('0 open → empty string (no badge)', () => {
        expect(formatPendencyBadge({ open: 0, overdue: 0 })).toBe('');
    });

    it('open only → shows count', () => {
        expect(formatPendencyBadge({ open: 3, overdue: 0 })).toBe('3');
    });

    it('open + overdue → shows "N ⚠M" format', () => {
        expect(formatPendencyBadge({ open: 3, overdue: 1 })).toBe('3 ⚠1');
    });

    it('all overdue → "N ⚠N" (all open are overdue)', () => {
        expect(formatPendencyBadge({ open: 2, overdue: 2 })).toBe('2 ⚠2');
    });
});
