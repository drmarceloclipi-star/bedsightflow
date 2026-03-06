import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

/**
 * Returns the top blockers ranking for the unit from live Firestore data.
 *
 * Reads the `mainBlocker` field from all occupied beds (those with a patientAlias).
 * Returns the blockers sorted by current count descending.
 *
 * `previousCount` and `delta` are derived by querying the audit_logs for
 * RESET_BED_KANBAN / UPDATE_BED-clear events from the previous 7-day window to
 * see which blockers were present before discharge.
 */
export const getAdminTopBlockers = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'É preciso estar logado.')
        }

        const { unitId } = data
        if (!unitId) {
            throw new functions.https.HttpsError('invalid-argument', 'O unitId é obrigatório.')
        }

        try {
            const db = admin.firestore()

            // ---- Current blockers: from live beds ----
            const bedsSnap = await db.collection(`units/${unitId}/beds`).get()
            const currentCounts = new Map<string, number>()

            for (const doc of bedsSnap.docs) {
                const bed = doc.data()
                const hasPatient = bed.patientAlias && bed.patientAlias.trim() !== ''
                if (!hasPatient) continue
                const blocker = bed.mainBlocker?.trim()
                if (!blocker) continue
                currentCounts.set(blocker, (currentCounts.get(blocker) ?? 0) + 1)
            }

            // ---- Previous window blockers: from RESET_BED_KANBAN audit logs (7–14 days ago) ----
            const now = new Date()
            const prevEnd = new Date(now)
            prevEnd.setDate(prevEnd.getDate() - 7)
            const prevStart = new Date(prevEnd)
            prevStart.setDate(prevStart.getDate() - 7)
            prevStart.setHours(0, 0, 0, 0)

            const prevSnap = await db.collection(`units/${unitId}/audit_logs`)
                .where('entityType', '==', 'bed')
                .where('action', '==', 'RESET_BED_KANBAN')
                .where('createdAt', '>=', Timestamp.fromDate(prevStart))
                .where('createdAt', '<=', Timestamp.fromDate(prevEnd))
                .get()

            const prevCounts = new Map<string, number>()
            for (const doc of prevSnap.docs) {
                const blocker = (doc.data().before?.mainBlocker as string | undefined)?.trim()
                if (!blocker) continue
                prevCounts.set(blocker, (prevCounts.get(blocker) ?? 0) + 1)
            }

            // ---- Merge, sort by current count descending ----
            const allBlockers = new Set([...currentCounts.keys(), ...prevCounts.keys()])
            const result = Array.from(allBlockers)
                .map(blocker => {
                    const count = currentCounts.get(blocker) ?? 0
                    const previousCount = prevCounts.get(blocker) ?? 0
                    return { blocker, count, previousCount, delta: count - previousCount }
                })
                .filter(b => b.count > 0)   // only show currently active blockers
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)

            return result

        } catch (error: unknown) {
            if (error instanceof functions.https.HttpsError) throw error
            const msg = error instanceof Error ? error.message : 'Erro interno'
            throw new functions.https.HttpsError('internal', msg)
        }
    })