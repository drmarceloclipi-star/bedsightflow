/**
 * kamishibaiVisualState.test.ts — P0 unit tests
 *
 * Tests the canonical 6-rule state machine of resolveKamishibaiVisualState.
 * Clock is injected via `resolvedCurrentShiftKey` — no real clock used.
 */

import { describe, it, expect } from 'vitest';
import { resolveKamishibaiVisualState, isDomainApplicable } from './kamishibaiVisualState';
import {
    CURRENT_SHIFT_KEY,
    PREV_SHIFT_KEY,
    bedEmpty,
    bedOkReviewedCurrentShift,
    bedOkReviewedPrevShift,
    bedBlockedWithBlockedAt,
    bedNotApplicable,
    kamOk,
    kamBlocked,
    kamNa,
    hoursAgo,
} from './fixtures';
import type { Bed } from './types';

const actor = { id: 'seed', name: 'System Seed' } as const;

// Helper: resolve for a given shift key (no real clock)
function resolve(bed: Bed, domain: string = 'medical', currentShiftKey: string = CURRENT_SHIFT_KEY) {
    return resolveKamishibaiVisualState(bed as Bed, domain as 'medical', {
        resolvedCurrentShiftKey: currentShiftKey,
        kamishibaiEnabled: true,
    });
}

describe('resolveKamishibaiVisualState', () => {
    // ── Regra 1: Leito vazio → INACTIVE ──────────────────────────────────────
    describe('Rule 1 — Empty bed → INACTIVE', () => {
        it('patientAlias="" → INACTIVE', () => {
            expect(resolve(bedEmpty)).toBe('INACTIVE');
        });

        it('patientAlias=" " (whitespace only) → INACTIVE', () => {
            const bed: Bed = { ...bedEmpty, patientAlias: '   ' };
            expect(resolve(bed)).toBe('INACTIVE');
        });

        it('patientAlias=undefined → INACTIVE', () => {
            const bed: Bed = { ...bedEmpty, patientAlias: undefined as unknown as string };
            expect(resolve(bed)).toBe('INACTIVE');
        });

        it('Empty bed ignores everything else (kamishibaiEnabled, domains, etc.)', () => {
            const bed: Bed = { ...bedEmpty, kamishibai: { medical: kamOk() } as Bed['kamishibai'] };
            expect(resolve(bed)).toBe('INACTIVE');
        });
    });

    // ── Regra 2: kamishibaiEnabled=false → INACTIVE ────────────────────────────
    describe('Rule 2 — kamishibaiEnabled=false → INACTIVE', () => {
        it('active bed with kamishibaiEnabled=false → INACTIVE', () => {
            const result = resolveKamishibaiVisualState(bedOkReviewedCurrentShift, 'medical', {
                resolvedCurrentShiftKey: CURRENT_SHIFT_KEY,
                kamishibaiEnabled: false,
            });
            expect(result).toBe('INACTIVE');
        });

        it('kamishibaiEnabled=false overrides even a blocked domain', () => {
            const result = resolveKamishibaiVisualState(bedBlockedWithBlockedAt, 'medical', {
                resolvedCurrentShiftKey: CURRENT_SHIFT_KEY,
                kamishibaiEnabled: false,
            });
            expect(result).toBe('INACTIVE');
        });
    });

    // ── Regra 3: Domínio não aplicável → NOT_APPLICABLE ─────────────────────
    describe('Rule 3 — Domain not applicable → NOT_APPLICABLE', () => {
        it('psychology not in applicableDomains → NOT_APPLICABLE', () => {
            expect(resolve(bedNotApplicable, 'psychology')).toBe('NOT_APPLICABLE');
        });

        it('social not in applicableDomains → NOT_APPLICABLE', () => {
            expect(resolve(bedNotApplicable, 'social')).toBe('NOT_APPLICABLE');
        });

        it('medical in applicableDomains → not NOT_APPLICABLE', () => {
            const result = resolve(bedNotApplicable, 'medical');
            expect(result).not.toBe('NOT_APPLICABLE');
        });

        it('applicableDomains absent → all domains applicable (compat v0)', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                applicableDomains: undefined,
            };
            // Medical should still be OK (not NOT_APPLICABLE)
            expect(resolve(bed, 'medical')).toBe('OK');
        });

        it('applicableDomains empty array → all domains applicable (compat v0)', () => {
            const bed: Bed = { ...bedOkReviewedCurrentShift, applicableDomains: [] };
            expect(resolve(bed, 'social')).toBe('OK');
        });
    });

    // ── Regra 4: status=blocked → BLOCKED ────────────────────────────────────
    describe('Rule 4 — status=blocked → BLOCKED (TTL immune)', () => {
        it('blocked domain → BLOCKED regardless of shiftKey', () => {
            expect(resolve(bedBlockedWithBlockedAt, 'medical')).toBe('BLOCKED');
        });

        it('BLOCKED ignores reviewedShiftKey (persists across shifts)', () => {
            const bed: Bed = {
                ...bedBlockedWithBlockedAt,
                kamishibai: { medical: kamBlocked } as Bed['kamishibai'],
            };
            // Even passing an old shift key, blocked stays blocked
            expect(resolve(bed, 'medical', PREV_SHIFT_KEY)).toBe('BLOCKED');
        });
    });

    // ── Regra 5: reviewedShiftKey != currentShiftKey → UNREVIEWED ────────────
    describe('Rule 5 — reviewedShiftKey mismatch → UNREVIEWED_THIS_SHIFT', () => {
        it('reviewedShiftKey = prev shift → UNREVIEWED_THIS_SHIFT', () => {
            expect(resolve(bedOkReviewedPrevShift, 'medical')).toBe('UNREVIEWED_THIS_SHIFT');
        });

        it('reviewedShiftKey absent → UNREVIEWED_THIS_SHIFT (legacy v0)', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                kamishibai: {
                    medical: { status: 'ok', updatedAt: hoursAgo(8), updatedBy: actor, note: '' },
                } as Bed['kamishibai'],
            };
            expect(resolve(bed, 'medical')).toBe('UNREVIEWED_THIS_SHIFT');
        });

        it('kamishibai entry absent for applicable domain → UNREVIEWED_THIS_SHIFT', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                kamishibai: {} as Bed['kamishibai'],
            };
            expect(resolve(bed, 'medical')).toBe('UNREVIEWED_THIS_SHIFT');
        });
    });

    // ── Legado: status='na' em leito ativo → UNREVIEWED ──────────────────────
    describe('Legacy — status=na in active bed → UNREVIEWED_THIS_SHIFT', () => {
        it('status=na in applicable domain → UNREVIEWED_THIS_SHIFT', () => {
            const bed: Bed = {
                ...bedOkReviewedCurrentShift,
                kamishibai: { medical: kamNa } as Bed['kamishibai'],
            };
            expect(resolve(bed, 'medical')).toBe('UNREVIEWED_THIS_SHIFT');
        });
    });

    // ── Regra 6: OK ──────────────────────────────────────────────────────────
    describe('Rule 6 — OK (reviewed this shift)', () => {
        it('ok + reviewedShiftKey == currentShiftKey → OK', () => {
            expect(resolve(bedOkReviewedCurrentShift, 'medical')).toBe('OK');
        });

        it('all domains OK when all reviewed this shift', () => {
            for (const domain of ['medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social']) {
                expect(resolve(bedOkReviewedCurrentShift, domain)).toBe('OK');
            }
        });
    });

    // ── Precedência canônica (regression) ────────────────────────────────────
    describe('Precedence — rules evaluated in strict order', () => {
        it('empty bed always wins over kamishibaiEnabled check', () => {
            const result = resolveKamishibaiVisualState(bedEmpty, 'medical', {
                resolvedCurrentShiftKey: CURRENT_SHIFT_KEY,
                kamishibaiEnabled: false, // rule 2 would also give INACTIVE, but rule 1 wins
            });
            expect(result).toBe('INACTIVE');
        });

        it('not-applicable domain wins over blocked', () => {
            // A bed where psychology is not applicable but has a blocked entry — Rule 3 wins
            const bed: Bed = {
                ...bedNotApplicable,
                kamishibai: {
                    ...bedNotApplicable.kamishibai,
                    psychology: kamBlocked,
                } as Bed['kamishibai'],
            };
            expect(resolve(bed, 'psychology')).toBe('NOT_APPLICABLE');
        });
    });
});

describe('isDomainApplicable', () => {
    it('domain in applicableDomains → true', () => {
        expect(isDomainApplicable(bedOkReviewedCurrentShift, 'medical')).toBe(true);
    });

    it('domain NOT in applicableDomains → false', () => {
        expect(isDomainApplicable(bedNotApplicable, 'psychology')).toBe(false);
    });

    it('applicableDomains absent → all applicable (compat v0)', () => {
        const bed: Bed = { ...bedOkReviewedCurrentShift, applicableDomains: undefined };
        expect(isDomainApplicable(bed, 'social')).toBe(true);
    });

    it('applicableDomains empty array → all applicable (compat v0)', () => {
        const bed: Bed = { ...bedOkReviewedCurrentShift, applicableDomains: [] };
        expect(isDomainApplicable(bed, 'medical')).toBe(true);
    });
});
