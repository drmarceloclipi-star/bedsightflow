import { collection, query, where, orderBy, getDocs, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../infra/firebase/config'
import type { AuditLog, AuditEntityType } from '../domain/audit'

export interface AuditLogFilters {
    startDate?: Date
    endDate?: Date
    entityType?: AuditEntityType
    actorUid?: string
    action?: string
}

export const AuditRepository = {
    getCollectionRef(unitId: string) {
        return collection(db, 'units', unitId, 'audit_logs')
    },

    buildQuery(unitId: string, filters?: AuditLogFilters) {
        let q = query(this.getCollectionRef(unitId), orderBy('createdAt', 'desc'))

        if (filters) {
            if (filters.entityType) {
                q = query(q, where('entityType', '==', filters.entityType))
            }
            if (filters.actorUid) {
                q = query(q, where('actor.uid', '==', filters.actorUid))
            }
            if (filters.action) {
                q = query(q, where('action', '==', filters.action))
            }
            if (filters.startDate) {
                q = query(q, where('createdAt', '>=', Timestamp.fromDate(filters.startDate)))
            }
            if (filters.endDate) {
                q = query(q, where('createdAt', '<=', Timestamp.fromDate(filters.endDate)))
            }
        }

        return q
    },

    async getAuditLogs(unitId: string, filters?: AuditLogFilters): Promise<AuditLog[]> {
        const q = this.buildQuery(unitId, filters)
        const snapshot = await getDocs(q)
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AuditLog))
    },

    listenToAuditLogs(
        unitId: string,
        filters: AuditLogFilters | undefined,
        callback: (logs: AuditLog[]) => void,
        onError?: (error: Error) => void
    ) {
        const q = this.buildQuery(unitId, filters)
        return onSnapshot(q, (snapshot) => {
            const logs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AuditLog))
            callback(logs)
        }, (error) => {
            console.error('[AuditRepository] Error listening to logs:', error)
            if (onError) onError(error)
        })
    }
}
