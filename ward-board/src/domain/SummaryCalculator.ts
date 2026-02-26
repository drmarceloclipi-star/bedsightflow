import type { Bed, SummaryMetrics } from './types';

export const SummaryCalculator = {
    calculateMetrics(beds: Bed[]): SummaryMetrics {
        const activePatients = beds.length;
        const withBlockers = beds.filter(b => b.mainBlocker && b.mainBlocker.trim() !== '').length;
        const discharges24h = beds.filter(b => b.expectedDischarge === '24h').length;

        // Pendências no Kamishibai: se algum status for 'pending' ou 'blocked'
        const pendingKamishibai = beds.filter(b => {
            return Object.values(b.kamishibai).some(h => h.status === 'pending' || h.status === 'blocked');
        }).length;

        return {
            activePatients,
            discharges24h,
            withBlockers,
            pendingKamishibai
        };
    }
};
