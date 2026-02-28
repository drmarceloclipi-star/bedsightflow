import type { Bed, SummaryMetrics } from './types';
import { computeUnitPendencyCounts } from './pendencies';

export const SummaryCalculator = {
    calculateMetrics(beds: Bed[], now: Date = new Date()): SummaryMetrics {
        const activeBeds = beds.filter(b => b.patientAlias && b.patientAlias.trim() !== '');
        const activePatients = activeBeds.length;
        const withBlockers = activeBeds.filter(b => b.mainBlocker && b.mainBlocker.trim() !== '').length;
        const discharges24h = activeBeds.filter(b => b.expectedDischarge === '24h').length;

        // v1.5: pendências da unidade — somente leitos ativos, mesmo critério do acceptance
        const { open: pendenciesOpen, overdue: pendenciesOverdue } = computeUnitPendencyCounts(beds, now);

        return {
            activePatients,
            discharges24h,
            withBlockers,
            pendenciesOpen,
            pendenciesOverdue,
        };
    }
};
