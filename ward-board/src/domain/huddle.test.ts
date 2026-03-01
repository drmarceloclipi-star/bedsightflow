import { describe, it, expect } from 'vitest';
import { buildDefaultChecklist, getReviewOfShiftKey } from './huddle';

describe('huddle domain logic', () => {
    describe('buildDefaultChecklist', () => {
        it('should return exactly 8 items with status skipped', () => {
            const checklist = buildDefaultChecklist();
            expect(checklist).toHaveLength(8);
            checklist.forEach(item => {
                expect(item.status).toBe('skipped');
                expect(item.key).toBeDefined();
                expect(item.label).toBeDefined();
            });
        });
    });

    describe('getReviewOfShiftKey', () => {
        it('should return AM of the same day when passed PM', () => {
            expect(getReviewOfShiftKey('2026-03-01-PM')).toBe('2026-03-01-AM');
            expect(getReviewOfShiftKey('2026-12-31-PM')).toBe('2026-12-31-AM');
        });

        it('should return PM of the previous day when passed AM', () => {
            expect(getReviewOfShiftKey('2026-03-02-AM')).toBe('2026-03-01-PM');
            expect(getReviewOfShiftKey('2026-12-15-AM')).toBe('2026-12-14-PM');
        });

        it('should handle month crossovers correctly when passed AM', () => {
            expect(getReviewOfShiftKey('2026-03-01-AM')).toBe('2026-02-28-PM');
            expect(getReviewOfShiftKey('2026-05-01-AM')).toBe('2026-04-30-PM');
            // Leap year test (2024 is a leap year)
            expect(getReviewOfShiftKey('2024-03-01-AM')).toBe('2024-02-29-PM');
        });

        it('should handle year crossovers correctly when passed AM', () => {
            expect(getReviewOfShiftKey('2027-01-01-AM')).toBe('2026-12-31-PM');
        });

        it('should return the original string if format is not -AM or -PM', () => {
            expect(getReviewOfShiftKey('2026-03-01-NIGHT')).toBe('2026-03-01-NIGHT');
            expect(getReviewOfShiftKey('INVALID')).toBe('INVALID');
        });
    });
});
