import escalationDefaults from '../../../escalation-defaults.json';

// O threshold no Backend (Cloud Functions)
export interface EscalationThresholds {
    escalationOverdueHoursWarning: number;
    escalationOverdueHoursCritical: number;
    escalationMainBlockerHoursWarning: number;
    escalationMainBlockerHoursCritical: number;
    // Opcional: Para regras de negócio futuras, quais domains contam para o overdue?
    escalationOverdueDomains?: string[];
}

/**
 * Defaults de escalonamento para o backend (Cloud Functions).
 *
 * Single Source of Truth: ward-board/escalation-defaults.json
 * O frontend (src/domain/missionControl.ts) importa do mesmo arquivo.
 */
export const DEFAULT_ESCALATION_THRESHOLDS: EscalationThresholds = {
    escalationOverdueHoursWarning: escalationDefaults.escalationOverdueHoursWarning,
    escalationOverdueHoursCritical: escalationDefaults.escalationOverdueHoursCritical,
    escalationMainBlockerHoursWarning: escalationDefaults.escalationMainBlockerHoursWarning,
    escalationMainBlockerHoursCritical: escalationDefaults.escalationMainBlockerHoursCritical,
};

export type EscalationType = 'OVERDUE_CRITICAL' | 'MAIN_BLOCKER_CRITICAL';

export interface EscalationResult {
    total: number;
    overdueCriticalBedIds: string[];
    blockerCriticalBedIds: string[];
    bedIdsByType: Record<EscalationType, string[]>;
}

// Helper interno (mesmo da Cloud Function e src/domain/types.ts sem import)
function toMillis(raw: unknown): number | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        const ms = new Date(raw).getTime();
        return isNaN(ms) ? null : ms;
    }
    if (typeof raw === 'object' && raw !== null && 'toMillis' in raw) {
        return (raw as { toMillis: () => number }).toMillis();
    }
    return null;
}

/**
 * Função Canônica Única de Escalonamento (Single Source of Truth).
 * A mesma lógica roda na Cloud Function (Mission Control Snapshot) e na TV (Runtime).
 */
export function computeEscalations(
    beds: any[],
    thresholds: EscalationThresholds,
    now: Date
): EscalationResult {
    const overdueCriticalBedIds = new Set<string>();
    const blockerCriticalBedIds = new Set<string>();
    const nowMs = now.getTime();

    for (const bed of beds) {
        // 1. Considerar apenas beds ativos
        if (!bed.patientAlias || bed.patientAlias.trim() === '') continue;

        const bedId = bed.id;
        if (!bedId) continue;

        // 2. MAIN BLOCKER CRITICAL
        if (typeof bed.mainBlocker === 'string' && bed.mainBlocker.trim() !== '') {
            const startAtMs = toMillis(bed.mainBlockerBlockedAt) ?? toMillis(bed.updatedAt);
            if (startAtMs !== null) {
                const ageHours = (nowMs - startAtMs) / 3600_000;
                if (ageHours >= thresholds.escalationMainBlockerHoursCritical) {
                    blockerCriticalBedIds.add(bedId);
                }
            }
        }

        // 3. OVERDUE CRITICAL
        const pendencies = Array.isArray(bed.pendencies) ? bed.pendencies : [];
        for (const p of pendencies) {
            if (p.status !== 'open') continue;

            // Ignorar pendências sem dueAt programado
            const dueMs = toMillis(p.dueAt);
            if (dueMs === null) continue;

            const overdueAgeHours = (nowMs - dueMs) / 3600_000;

            // Filtro por domain, caso seja especificado nos thresholds
            if (thresholds.escalationOverdueDomains && p.domain) {
                if (!thresholds.escalationOverdueDomains.includes(p.domain)) {
                    continue;
                }
            }

            if (overdueAgeHours >= thresholds.escalationOverdueHoursCritical) {
                overdueCriticalBedIds.add(bedId);
                // Já atingiu um overdue crítico neste leito, não precisa olhar outras pendências dele para conta
                break;
            }
        }
    }

    const overdueArr = Array.from(overdueCriticalBedIds);
    const blockerArr = Array.from(blockerCriticalBedIds);
    const totalSet = new Set([...overdueArr, ...blockerArr]);

    return {
        total: totalSet.size,
        overdueCriticalBedIds: overdueArr,
        blockerCriticalBedIds: blockerArr,
        bedIdsByType: {
            'OVERDUE_CRITICAL': overdueArr,
            'MAIN_BLOCKER_CRITICAL': blockerArr
        }
    };
}
