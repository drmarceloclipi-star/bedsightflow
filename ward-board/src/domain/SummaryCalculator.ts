import type { Bed, SummaryMetrics } from './types';

export const SummaryCalculator = {
    calculateMetrics(beds: Bed[]): SummaryMetrics {
        const activePatients = beds.filter(b => b.patientAlias && b.patientAlias.trim() !== '').length;
        const withBlockers = beds.filter(b => b.mainBlocker && b.mainBlocker.trim() !== '').length;
        const discharges24h = beds.filter(b => b.expectedDischarge === '24h').length;



        return {
            activePatients,
            discharges24h,
            withBlockers
        };
    }
};
