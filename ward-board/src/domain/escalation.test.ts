import { describe, it, expect } from 'vitest';
import { computeEscalations, DEFAULT_ESCALATION_THRESHOLDS } from './escalation';
import type { Bed } from './types';

describe('computeEscalations', () => {
    const NOW = new Date('2026-03-01T12:00:00Z');

    const baseBed = (id: string, overrides: Partial<Bed> = {}): Partial<Bed> => ({
        id,
        patientAlias: 'John Doe',
        updatedAt: '2026-03-01T10:00:00Z',
        ...overrides,
    });

    it('should ignore beds with no active patientAlias', () => {
        const beds = [
            baseBed('b1', { patientAlias: '' }),
            baseBed('b2', { patientAlias: undefined }),
        ];

        const result = computeEscalations(beds, DEFAULT_ESCALATION_THRESHOLDS, NOW);

        expect(result.total).toBe(0);
        expect(result.overdueCriticalBedIds).toEqual([]);
        expect(result.blockerCriticalBedIds).toEqual([]);
    });

    it('should trigger MAIN_BLOCKER_CRITICAL when mainBlockerBlockedAt exceeds critical threshold', () => {
        const beds = [
            baseBed('b1', {
                mainBlocker: 'Aguardando Exame',
                // Threshold critical is 24 hours. Let's make it 25 hours ago.
                mainBlockerBlockedAt: new Date(NOW.getTime() - 25 * 3600_000).toISOString()
            }),
            baseBed('b2', {
                mainBlocker: 'Aguardando Avaliação',
                // 10 hours ago -> Warning (8h) but not Critical (24h)
                mainBlockerBlockedAt: new Date(NOW.getTime() - 10 * 3600_000).toISOString()
            })
        ];

        const result = computeEscalations(beds, DEFAULT_ESCALATION_THRESHOLDS, NOW);

        expect(result.total).toBe(1);
        expect(result.blockerCriticalBedIds).toEqual(['b1']);
        expect(result.overdueCriticalBedIds).toEqual([]);
    });

    it('should fallback to updatedAt if mainBlockerBlockedAt is missing', () => {
        const beds = [
            baseBed('b1', {
                mainBlocker: 'Aguardando Exame',
                updatedAt: new Date(NOW.getTime() - 25 * 3600_000).toISOString(),
                mainBlockerBlockedAt: undefined
            })
        ];

        const result = computeEscalations(beds, DEFAULT_ESCALATION_THRESHOLDS, NOW);

        expect(result.blockerCriticalBedIds).toEqual(['b1']);
    });

    it('should trigger OVERDUE_CRITICAL when an open pendency exceeds critical threshold', () => {
        const beds = [
            baseBed('b1', {
                pendencies: [
                    {
                        id: 'p1',
                        status: 'open',
                        dueAt: new Date(NOW.getTime() - 13 * 3600_000).toISOString(),
                        createdAt: '',
                        title: 'Exame',
                        createdBy: { id: 'u1', name: 'User 1' }
                    } as any
                ]
            }),
            baseBed('b2', {
                pendencies: [
                    {
                        id: 'p2',
                        status: 'open',
                        dueAt: new Date(NOW.getTime() - 10 * 3600_000).toISOString(),
                        createdAt: '',
                        title: 'Exame',
                        createdBy: { id: 'u1', name: 'User 1' }
                    } as any
                ]
            })
        ];

        const result = computeEscalations(beds, DEFAULT_ESCALATION_THRESHOLDS, NOW);

        expect(result.total).toBe(1);
        expect(result.overdueCriticalBedIds).toEqual(['b1']);
        expect(result.blockerCriticalBedIds).toEqual([]);
    });

    it('should ignore closed or cancelled pendencies for overdue calculations', () => {
        const beds = [
            baseBed('b1', {
                pendencies: [
                    {
                        id: 'p1',
                        status: 'done',
                        dueAt: new Date(NOW.getTime() - 15 * 3600_000).toISOString(),
                        createdAt: '',
                        title: 'Exame',
                        createdBy: { id: 'u1', name: 'User 1' }
                    } as any,
                ]
            })
        ];

        const result = computeEscalations(beds, DEFAULT_ESCALATION_THRESHOLDS, NOW);
        expect(result.overdueCriticalBedIds).toEqual([]);
    });

    it('should respect domain filters in thresholds if specified', () => {
        const thresholds = {
            ...DEFAULT_ESCALATION_THRESHOLDS,
            escalationOverdueDomains: ['medical', 'nursing']
        };

        const beds = [
            baseBed('b1', {
                pendencies: [
                    {
                        id: 'p1',
                        status: 'open',
                        domain: 'physio' as any, // Not in filter
                        dueAt: new Date(NOW.getTime() - 15 * 3600_000).toISOString(),
                        createdAt: '',
                        title: 'Fisio',
                        createdBy: { id: 'u1', name: 'User 1' }
                    } as any
                ]
            }),
            baseBed('b2', {
                pendencies: [
                    {
                        id: 'p2',
                        status: 'open',
                        domain: 'medical' as any, // In filter
                        dueAt: new Date(NOW.getTime() - 15 * 3600_000).toISOString(),
                        createdAt: '',
                        title: 'Alta',
                        createdBy: { id: 'u1', name: 'User 1' }
                    } as any
                ]
            })
        ];

        const result = computeEscalations(beds, thresholds, NOW);

        // b1 is ignored because its domain 'physio' is not in escalationOverdueDomains
        // b2 triggers it because its domain 'medical' is in the array
        expect(result.overdueCriticalBedIds).toEqual(['b2']);
    });

    it('should aggregate total correctly without duplicating bed ids', () => {
        const beds = [
            baseBed('b1', {
                mainBlocker: 'Exame',
                mainBlockerBlockedAt: new Date(NOW.getTime() - 25 * 3600_000).toISOString(),
                pendencies: [
                    {
                        id: 'p1',
                        status: 'open',
                        dueAt: new Date(NOW.getTime() - 13 * 3600_000).toISOString(),
                        createdAt: '',
                        title: 'XYZ',
                        createdBy: { id: 'u1', name: 'User 1' }
                    } as any
                ]
            })
        ];

        const result = computeEscalations(beds, DEFAULT_ESCALATION_THRESHOLDS, NOW);

        // Even though it is BOTH a blocker and has an overdue pendency, total is 1
        expect(result.total).toBe(1);
        expect(result.blockerCriticalBedIds).toEqual(['b1']);
        expect(result.overdueCriticalBedIds).toEqual(['b1']);
    });
});
