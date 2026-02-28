import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

type PeriodKey = 'today' | '7d' | '30d'

function getPeriodDuration(periodKey: PeriodKey): number {
    if (periodKey === 'today') return 1
    if (periodKey === '7d') return 7
    return 30
}

async function countAuditEventsPerDay(
    db: admin.firestore.Firestore,
    unitId: string,
    startDate: Date,
    endDate: Date
): Promise<{ date: string; value: number }[]> {
    const logsSnap = await db.collection(`units/${unitId}/audit_logs`)
        .where('entityType', '==', 'bed')
        .where('createdAt', '>=', Timestamp.fromDate(startDate))
        .where('createdAt', '<=', Timestamp.fromDate(endDate))
        .orderBy('createdAt', 'desc')
        .get()

    const dayCount: Map<string, number> = new Map()
    for (const doc of logsSnap.docs) {
        const log = doc.data()
        const tsRaw = log.createdAt as Timestamp
        const dateStr = new Date(tsRaw.toMillis()).toISOString().slice(0, 10)
        dayCount.set(dateStr, (dayCount.get(dateStr) ?? 0) + 1)
    }

    return Array.from(dayCount.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date))
}

export const getAdminTrendComparisonBQ = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'É preciso estar logado.')
        }

        const { unitId, periodKey = '7d' } = data
        if (!unitId) {
            throw new functions.https.HttpsError('invalid-argument', 'O unitId é obrigatório.')
        }

        const db = admin.firestore()
        const days = getPeriodDuration(periodKey as PeriodKey)

        const currentEnd = new Date()
        const currentStart = new Date()
        currentStart.setDate(currentStart.getDate() - days)
        currentStart.setHours(0, 0, 0, 0)

        const previousEnd = new Date(currentStart.getTime() - 1)
        const previousStart = new Date(previousEnd)
        previousStart.setDate(previousStart.getDate() - days)
        previousStart.setHours(0, 0, 0, 0)

        const [currentPeriod, previousPeriod] = await Promise.all([
            countAuditEventsPerDay(db, unitId, currentStart, currentEnd),
            countAuditEventsPerDay(db, unitId, previousStart, previousEnd),
        ])

        // Fallback to current snapshot when no audit history yet
        if (currentPeriod.length === 0) {
            const bedsSnap = await db.collection(`units/${unitId}/beds`).get()
            const occupied = bedsSnap.docs.filter(d => d.data().expectedDischarge).length
            const today = new Date().toISOString().slice(0, 10)
            return {
                currentPeriod: [{ date: today, value: occupied }],
                previousPeriod: [],
            }
        }

        return { currentPeriod, previousPeriod }
    })
