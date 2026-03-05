/**
 * SummaryCalculator.test.ts — Unit tests for SummaryCalculator.calculateMetrics
 */

import { describe, it, expect } from 'vitest';
import { SummaryCalculator } from './SummaryCalculator';
import {
    MOCK_NOW,
    hoursAgo,
    hoursFromNow,
    bedEmpty,
    bedOkReviewedCurrentShift,
} from './fixtures';
import type { Bed } from './types';

const actor = { id: 'seed', name: 'System Seed' } as const;

function activeBed(id: string, overrides: Partial<Bed> = {}): Bed {
    return {
        ...bedOkReviewedCurrentShift,
        id,
        number: id,
        ...overrides,
    };
}

// ── calculateMetrics ──────────────────────────────────────────────────────────

describe('SummaryCalculator.calculateMetrics', () => {
    it('returns zeros for empty beds array', () => {
        const result = SummaryCalculator.calculateMetrics([], MOCK_NOW);
        expect(result.activePatients).toBe(0);
        expect(result.discharges24h).toBe(0);
        expect(result.withBlockers).toBe(0);
        expect(result.pendenciesOpen).toBe(0);
        expect(result.pendenciesOverdue).toBe(0);
    });

    it('counts only beds with non-empty patientAlias as activePatients', () => {
        const beds = [
            activeBed('b1'),
            activeBed('b2'),
            bedEmpty,
        ];
        const result = SummaryCalculator.calculateMetrics(beds, MOCK_NOW);
        expect(result.activePatients).toBe(2);
    });

    it('ignores beds with whitespace-only patientAlias', () => {
        const beds = [
            activeBed('b1'),
            activeBed('b2', { patientAlias: '   ' }),
        ];
        const result = SummaryCalculator.calculateMetrics(beds, MOCK_NOW);
        expect(result.activePatients).toBe(1);
    });

    it('counts withBlockers only for active beds with non-empty mainBlocker', () => {
        const beds = [
            activeBed('b1', { mainBlocker: 'Aguardando exame' }),
            activeBed('b2', { mainBlocker: '' }),
            bedEmpty,
        ];
        const result = SummaryCalculator.calculateMetrics(beds, MOCK_NOW);
        expect(result.withBlockers).toBe(1);
    });

    it('does not count inactive bed blocker toward withBlockers', () => {
        const beds = [
            { ...bedEmpty, mainBlocker: 'ShouldBeIgnored' } as Bed,
        ];
        const result = SummaryCalculator.calculateMetrics(beds, MOCK_NOW);
        expect(result.withBlockers).toBe(0);
    });

    it('counts discharges24h for active beds with expectedDischarge=24h', () => {
        const beds = [
            activeBed('b1', { expectedDischarge: '24h' }),
            activeBed('b2', { expectedDischarge: '2-3_days' }),
            activeBed('b3', { expectedDischarge: '24h' }),
        ];
        const result = SummaryCalculator.calculateMetrics(beds, MOCK_NOW);
        expect(result.discharges24h).toBe(2);
    });

    it('counts open pendencies from active beds', () => {
        const dueAt = hoursFromNow(4); // not overdue
        const beds = [
            activeBed('b1', {
                pendencies: [
                    { id: 'p1', title: 'Pendência A', domain: 'medical', dueAt, status: 'open', createdAt: hoursAgo(1), updatedAt: hoursAgo(1), updatedBy: actor, createdBy: actor },
                ],
            }),
            activeBed('b2', { pendencies: [] }),
        ];
        const result = SummaryCalculator.calculateMetrics(beds, MOCK_NOW);
        expect(result.pendenciesOpen).toBe(1);
        expect(result.pendenciesOverdue).toBe(0);
    });

    it('counts overdue pendencies when dueAt is in the past', () => {
        const overdueAt = hoursAgo(2); // overdue
        const beds = [
            activeBed('b1', {
                pendencies: [
                    { id: 'p1', title: 'Overdue', domain: 'nursing', dueAt: overdueAt, status: 'open', createdAt: hoursAgo(5), updatedAt: hoursAgo(5), updatedBy: actor, createdBy: actor },
                ],
            }),
        ];
        const result = SummaryCalculator.calculateMetrics(beds, MOCK_NOW);
        expect(result.pendenciesOpen).toBe(1);
        expect(result.pendenciesOverdue).toBe(1);
    });

    it('counts discharges24h for mixed expectedDischarge values', () => {
        const beds = [
            activeBed('b1', { expectedDischarge: '24h' }),
            activeBed('b2', { expectedDischarge: '24h' }),
            activeBed('b3', { expectedDischarge: '2-3_days' }),
            activeBed('b4', { expectedDischarge: '2-3_days' }),
        ];
        const result = SummaryCalculator.calculateMetrics(beds, MOCK_NOW);
        expect(result.discharges24h).toBe(2);
    });

    it('returns all zero metrics for beds with only inactive patients', () => {
        const beds = [bedEmpty, bedEmpty, bedEmpty];
        const result = SummaryCalculator.calculateMetrics(beds, MOCK_NOW);
        expect(result).toEqual({
            activePatients: 0,
            discharges24h: 0,
            withBlockers: 0,
            pendenciesOpen: 0,
            pendenciesOverdue: 0,
        });
    });

    it('computes correct summary for a mixed ward', () => {
        const overdueAt = hoursAgo(2);
        const beds = [
            activeBed('b1', {
                mainBlocker: 'Lab',
                expectedDischarge: '24h',
                pendencies: [
                    { id: 'p1', title: 'Overdue', domain: 'medical', dueAt: overdueAt, status: 'open', createdAt: hoursAgo(5), updatedAt: hoursAgo(5), updatedBy: actor, createdBy: actor },
                ],
            }),
            activeBed('b2', { expectedDischarge: '24h' }),
            bedEmpty,
        ];
        const result = SummaryCalculator.calculateMetrics(beds, MOCK_NOW);
        expect(result.activePatients).toBe(2);
        expect(result.withBlockers).toBe(1);
        expect(result.discharges24h).toBe(2);
        expect(result.pendenciesOpen).toBe(1);
        expect(result.pendenciesOverdue).toBe(1);
    });
});
