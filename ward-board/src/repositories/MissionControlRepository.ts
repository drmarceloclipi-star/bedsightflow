import { httpsCallable } from 'firebase/functions';
import { functions } from '../infra/firebase/config';
import { CLOUD_FUNCTIONS } from '../constants/functionNames';
import type { MissionControlSnapshot } from '../domain/analytics';
import type { HuddleSnapshotSummary } from '../domain/huddle';

export class MissionControlRepository {
    /**
     * Busca o snapshot atual do Mission Control via Cloud Function.
     */
    static async getSnapshot(unitId: string): Promise<MissionControlSnapshot> {
        const getSnapshotFn = httpsCallable<{ unitId: string }, MissionControlSnapshot>(
            functions,
            CLOUD_FUNCTIONS.GET_ADMIN_MISSION_CONTROL_SNAPSHOT
        );
        const result = await getSnapshotFn({ unitId });
        return result.data;
    }

    /**
     * Fetches the current Mission Control snapshot and maps it to a HuddleSnapshotSummary.
     */
    static async getHuddleSnapshotSummary(unitId: string, shiftKey: string): Promise<HuddleSnapshotSummary | undefined> {
        try {
            const snapshot = await this.getSnapshot(unitId);

            return {
                // fields mapped exactly from snapshot to HuddleSnapshotSummary
                generatedAt: (snapshot.generatedAt as string) || new Date().toISOString(),
                source: snapshot.source || 'mission_control_snapshot',
                thresholdsUsed: (snapshot.thresholdsUsed as unknown) as Record<string, unknown>,
                shiftKey,

                // Mapped KPIs
                unreviewedBedsCount: snapshot.unreviewedBedsCount,
                openPendenciesCount: snapshot.openPendenciesCount,
                overduePendenciesCount: snapshot.overduePendenciesCount,
                escalationsTotal: snapshot.escalations?.total,
                escalationsOverdueCritical: snapshot.escalations?.overdueCritical,
                escalationsBlockerCritical: snapshot.escalations?.blockerCritical,
                dischargeNext24hCount: snapshot.dischargeNext24hCount,
                blockedBedsCount: snapshot.blockedBedsCount,
                maxBlockedAgingHours: snapshot.maxBlockedAgingHours,
            };
        } catch (error) {
            console.warn('[MissionControlRepository] Failed to fetch huddle snapshot summary:', error);
            // Falha silenciosamente e retorna undefined caso o backend falle (requisito de robustez HS6)
            return undefined;
        }
    }
}
