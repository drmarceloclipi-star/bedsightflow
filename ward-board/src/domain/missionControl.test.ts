import { describe, it, expect } from 'vitest';
import {
    parseMissionControlThresholds,
    DEFAULT_MISSION_CONTROL_THRESHOLDS,
    blockedStatus,
    kamishibaiImpedimentStatus,
    freshnessStatus,
    unreviewedShiftStatus
} from './missionControl';

describe('missionControl domain logic', () => {
    describe('parseMissionControlThresholds', () => {
        it('should return defaults if raw is null or undefined', () => {
            expect(parseMissionControlThresholds(null)).toEqual(DEFAULT_MISSION_CONTROL_THRESHOLDS);
            expect(parseMissionControlThresholds(undefined)).toEqual(DEFAULT_MISSION_CONTROL_THRESHOLDS);
        });

        it('should return defaults if raw is not an object', () => {
            expect(parseMissionControlThresholds('string')).toEqual(DEFAULT_MISSION_CONTROL_THRESHOLDS);
            expect(parseMissionControlThresholds(123)).toEqual(DEFAULT_MISSION_CONTROL_THRESHOLDS);
        });

        it('should merge safe numeric values and fallback to default when invalid', () => {
            const raw = {
                blockedPctWarning: 10, // Valid override
                blockedPctCritical: 'not-a-number', // Should fallback
            };
            const result = parseMissionControlThresholds(raw);

            expect(result.blockedPctWarning).toBe(10);
            expect(result.blockedPctCritical).toBe(DEFAULT_MISSION_CONTROL_THRESHOLDS.blockedPctCritical);
            expect(result.escalationMainBlockerHoursCritical).toBe(DEFAULT_MISSION_CONTROL_THRESHOLDS.escalationMainBlockerHoursCritical);
        });
    });

    describe('KPI Status Helpers', () => {
        const T = DEFAULT_MISSION_CONTROL_THRESHOLDS; // Warnings: 20, 15... Critical: 35, 30...

        describe('blockedStatus', () => {
            it('should return ok when below warning', () => {
                expect(blockedStatus(19, T)).toBe('ok');
            });
            it('should return warning when above warning but below critical', () => {
                expect(blockedStatus(21, T)).toBe('warning');
            });
            it('should return critical when above critical', () => {
                expect(blockedStatus(36, T)).toBe('critical');
            });
            it('should handle boundaries properly', () => {
                // > 20 is warning, not >=
                expect(blockedStatus(20, T)).toBe('ok');
                expect(blockedStatus(35, T)).toBe('warning');
            });
        });

        describe('kamishibaiImpedimentStatus', () => {
            it('should return ok when below warning', () => {
                expect(kamishibaiImpedimentStatus(14, T)).toBe('ok');
            });
            it('should return warning when above warning but below critical', () => {
                expect(kamishibaiImpedimentStatus(16, T)).toBe('warning');
            });
            it('should return critical when above critical', () => {
                expect(kamishibaiImpedimentStatus(31, T)).toBe('critical');
            });
        });

        describe('freshnessStatus', () => {
            it('should always return ok if count is 0', () => {
                expect(freshnessStatus(0, '12h', T)).toBe('ok');
                expect(freshnessStatus(0, '48h', T)).toBe('ok');
            });

            it('should evaluate 12h accurately (warning >= 5)', () => {
                expect(freshnessStatus(4, '12h', T)).toBe('ok');
                expect(freshnessStatus(5, '12h', T)).toBe('warning');
            });

            it('should evaluate 24h accurately (warning >= 1, critical >= 3)', () => {
                expect(freshnessStatus(1, '24h', T)).toBe('warning');
                expect(freshnessStatus(2, '24h', T)).toBe('warning');
                expect(freshnessStatus(3, '24h', T)).toBe('critical');
            });

            it('should evaluate 48h accurately (critical >= 1)', () => {
                expect(freshnessStatus(1, '48h', T)).toBe('critical');
            });
        });

        describe('unreviewedShiftStatus', () => {
            it('should return ok if count is 0', () => {
                expect(unreviewedShiftStatus(0, T)).toBe('ok');
            });
            it('should evaluate warning (>= 3)', () => {
                expect(unreviewedShiftStatus(2, T)).toBe('ok');
                expect(unreviewedShiftStatus(3, T)).toBe('warning');
                expect(unreviewedShiftStatus(5, T)).toBe('warning');
            });
            it('should evaluate critical (>= 6)', () => {
                expect(unreviewedShiftStatus(6, T)).toBe('critical');
                expect(unreviewedShiftStatus(10, T)).toBe('critical');
            });
        });
    });
});
