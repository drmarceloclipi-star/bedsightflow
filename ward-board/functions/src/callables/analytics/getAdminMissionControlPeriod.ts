import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

type RangeKey = 'today' | '7d' | '30d'

/**
 * Returns Mission Control period metrics from audit_logs.
 *
 * Computes:
 *  - dischargesByDay[]: throughput (altas/dia) for the period
 *  - totalDischarges: sum of dischargesByDay
 *  - avgDischargesPerDay
 *  - prevPeriodTotalDischarges: for comparison (prior equal window)
 *  - throughputDelta: current vs previous (%)
 *  - topBlockersPeriod[]: top 5 blocker reasons in period
 *  - generatedAt, source, definitionsVersion, range
 */
export const getAdminMissionControlPeriod = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'É preciso estar logado.')
        }

        const { unitId, range = '7d' } = data as { unitId: string; range?: RangeKey }
        if (!unitId) {
            throw new functions.https.HttpsError('invalid-argument', 'O unitId é obrigatório.')
        }

        try {
            const rangeDays: Record<RangeKey, number> = { today: 1, '7d': 7, '30d': 30 }
            const days = rangeDays[range] ?? 7

            const db = admin.firestore()
            const now = new Date()

            // --- Current window ---
            const windowStart = new Date(now)
            windowStart.setDate(windowStart.getDate() - days)
            windowStart.setHours(0, 0, 0, 0)

            // --- Previous window (same length, immediately preceding) ---
            const prevWindowEnd = new Date(windowStart)
            const prevWindowStart = new Date(prevWindowEnd)
            prevWindowStart.setDate(prevWindowStart.getDate() - days)
            prevWindowStart.setHours(0, 0, 0, 0)

            // Query current period audit_logs for discharges.
            // Two separate queries instead of 'action in [...]' + range filter to avoid
            // Firestore limitation: combining 'in' with inequality on a different field
            // requires Firestore to fan-out sub-queries, which can silently fail without
            // the exact composite index for each value combination.
            const [currentResetSnap, currentResetAllSnap] = await Promise.all([
                db.collection(`units/${unitId}/audit_logs`)
                    .where('entityType', '==', 'bed')
                    .where('action', '==', 'RESET_BED_KANBAN')
                    .where('createdAt', '>=', Timestamp.fromDate(windowStart))
                    .get(),
                db.collection(`units/${unitId}/audit_logs`)
                    .where('entityType', '==', 'bed')
                    .where('action', '==', 'RESET_BED_ALL')
                    .where('createdAt', '>=', Timestamp.fromDate(windowStart))
                    .get(),
            ])
            const currentDocs = [...currentResetSnap.docs, ...currentResetAllSnap.docs]

            // Query previous period (same split approach)
            const [prevResetSnap, prevResetAllSnap] = await Promise.all([
                db.collection(`units/${unitId}/audit_logs`)
                    .where('entityType', '==', 'bed')
                    .where('action', '==', 'RESET_BED_KANBAN')
                    .where('createdAt', '>=', Timestamp.fromDate(prevWindowStart))
                    .where('createdAt', '<', Timestamp.fromDate(windowStart))
                    .get(),
                db.collection(`units/${unitId}/audit_logs`)
                    .where('entityType', '==', 'bed')
                    .where('action', '==', 'RESET_BED_ALL')
                    .where('createdAt', '>=', Timestamp.fromDate(prevWindowStart))
                    .where('createdAt', '<', Timestamp.fromDate(windowStart))
                    .get(),
            ])
            const prevDocsCount = prevResetSnap.size + prevResetAllSnap.size

            // Build discharges by day for current period
            const dayCounts = new Map<string, number>()
            const blockerCountsPeriod = new Map<string, number>()

            for (const doc of currentDocs) {
                const log = doc.data()
                const tsRaw = log.createdAt as Timestamp
                if (!tsRaw?.toMillis) continue
                const d = new Date(tsRaw.toMillis())
                const dateStr = d.toISOString().slice(0, 10)
                dayCounts.set(dateStr, (dayCounts.get(dateStr) ?? 0) + 1)

                // top blocker in period: use before.mainBlocker at time of reset
                const blocker = (log.before?.mainBlocker as string | undefined)?.trim()
                if (blocker) {
                    blockerCountsPeriod.set(blocker, (blockerCountsPeriod.get(blocker) ?? 0) + 1)
                }
            }

            // Build full day array for the current window
            const dischargesByDay = Array.from({ length: days }, (_, i) => {
                const d = new Date(windowStart)
                d.setDate(d.getDate() + i)
                const dateStr = d.toISOString().slice(0, 10)
                return { date: dateStr, count: dayCounts.get(dateStr) ?? 0 }
            })

            const totalDischarges = dischargesByDay.reduce((sum, d) => sum + d.count, 0)
            const avgDischargesPerDay = days > 0 ? Math.round((totalDischarges / days) * 10) / 10 : 0

            const prevPeriodTotalDischarges = prevDocsCount
            const throughputDelta = prevPeriodTotalDischarges > 0
                ? Math.round(((totalDischarges - prevPeriodTotalDischarges) / prevPeriodTotalDischarges) * 100)
                : null

            // Top blockers in period
            const topBlockersPeriod = Array.from(blockerCountsPeriod.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([blocker, count]) => ({ blocker, count }))

            return {
                generatedAt: new Date().toISOString(),
                source: 'audit_logs_firestore',
                definitionsVersion: 'v1',
                range,
                dischargesByDay,
                totalDischarges,
                avgDischargesPerDay,
                prevPeriodTotalDischarges,
                throughputDelta,
                topBlockersPeriod,
            }
        } catch (error: unknown) {
            if (error instanceof functions.https.HttpsError) throw error
            const msg = error instanceof Error ? error.message : 'Erro interno'
            throw new functions.https.HttpsError('internal', msg)
        }
    })
