import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

type DischargeEstimate = '24h' | '2-3_days' | '>3_days' | 'later' | null | undefined

interface DailyBucketPoint {
    date: string
    lt24h: number
    d2to3: number
    gt3d: number
    undefinedBucket: number
}

/**
 * Returns daily discharge-bucket flow metrics for the selected period.
 *
 * A "discharge" is identified by an audit log entry where:
 *   - action is 'RESET_BED_KANBAN' (explicit clear by operator), OR
 *   - action is 'UPDATE_BED' and before.patientAlias was non-empty while after.patientAlias is empty
 *
 * The LOS bucket is read from before.expectedDischarge:
 *   '24h'      → lt24h
 *   '2-3_days' → d2to3
 *   '>3_days'  → gt3d
 *   'later'/null/undefined → undefinedBucket
 */
export const getAdminFlowMetricsBQ = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'É preciso estar logado.')
        }

        try {
            const { unitId, periodKey = '7d' } = data
            if (!unitId) {
                throw new functions.https.HttpsError('invalid-argument', 'O unitId é obrigatório.')
            }

            const db = admin.firestore()
            const numDays = periodKey === 'today' ? 1 : periodKey === '7d' ? 7 : 30

            const endDate = new Date()
            const startDate = new Date()
            startDate.setDate(startDate.getDate() - numDays)
            startDate.setHours(0, 0, 0, 0)

            // ----- Query 1: RESET_BED_KANBAN (always a discharge) -----
            const resetSnap = await db.collection(`units/${unitId}/audit_logs`)
                .where('entityType', '==', 'bed')
                .where('action', '==', 'RESET_BED_KANBAN')
                .where('createdAt', '>=', Timestamp.fromDate(startDate))
                .where('createdAt', '<=', Timestamp.fromDate(endDate))
                .get()

            // ----- Query 2: UPDATE_BED — pick only those that cleared a patient -----
            const updateSnap = await db.collection(`units/${unitId}/audit_logs`)
                .where('entityType', '==', 'bed')
                .where('action', '==', 'UPDATE_BED')
                .where('createdAt', '>=', Timestamp.fromDate(startDate))
                .where('createdAt', '<=', Timestamp.fromDate(endDate))
                .get()

            // Combine all discharge events
            const allDocs = [
                ...resetSnap.docs,
                ...updateSnap.docs.filter(doc => {
                    const d = doc.data()
                    // An UPDATE_BED is a discharge when patientAlias went from non-empty → empty
                    const hadPatient = d.before?.patientAlias && d.before.patientAlias.trim() !== ''
                    const isNowEmpty = !d.after?.patientAlias || d.after.patientAlias.trim() === ''
                    return hadPatient && isNowEmpty
                })
            ]

            // Build a mapping: date → bucket counts
            type BucketMap = { lt24h: number; d2to3: number; gt3d: number; undefinedBucket: number }
            const dayMap = new Map<string, BucketMap>()

            for (const doc of allDocs) {
                const log = doc.data()
                const tsRaw = log.createdAt as Timestamp
                const dateStr = new Date(tsRaw.toMillis()).toISOString().slice(0, 10)

                if (!dayMap.has(dateStr)) {
                    dayMap.set(dateStr, { lt24h: 0, d2to3: 0, gt3d: 0, undefinedBucket: 0 })
                }
                const bucket = dayMap.get(dateStr)!
                const estimate: DischargeEstimate = log.before?.expectedDischarge ?? null

                if (estimate === '24h') bucket.lt24h++
                else if (estimate === '2-3_days') bucket.d2to3++
                else if (estimate === '>3_days') bucket.gt3d++
                else bucket.undefinedBucket++
            }

            // Build a complete day-by-day array for the period (fill zeros for days with no events)
            const points: DailyBucketPoint[] = []
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            for (let i = numDays - 1; i >= 0; i--) {
                const d = new Date(today)
                d.setDate(today.getDate() - i)
                const dateStr = d.toISOString().slice(0, 10)
                const counts = dayMap.get(dateStr) ?? { lt24h: 0, d2to3: 0, gt3d: 0, undefinedBucket: 0 }
                points.push({ date: dateStr, ...counts })
            }

            return points
        } catch (error: any) {
            if (error instanceof functions.https.HttpsError) {
                throw error
            }
            throw new functions.https.HttpsError('internal', error.message || 'Unknown error', error.stack);
        }
    })
