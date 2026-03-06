import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

/**
 * Returns data freshness metrics from live Firestore data.
 *
 * - stale12h / stale24h / stale48h: beds whose most recent kamishibai[domain].reviewedAt
 *   (or bed.updatedAt as fallback) is older than that threshold
 * - updatesByHour: audit log event counts grouped by hour-of-day (last 24h)
 * - updatesByDay: audit log event counts grouped by calendar day (last 7 days)
 */
export const getAdminFreshnessBQ = functions
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
            const now = new Date()
            const ms12h = 12 * 60 * 60 * 1000
            const ms24h = 24 * 60 * 60 * 1000
            const ms48h = 48 * 60 * 60 * 1000

            // ---- Stale bed counts (from beds collection) ----
            // Uses the most recent kamishibai[domain].reviewedAt across all domains.
            // Falls back to bed.updatedAt only when no domain has been reviewed yet.
            const bedsSnap = await db.collection(`units/${unitId}/beds`).get()

            let stale12h = 0
            let stale24h = 0
            let stale48h = 0

            for (const doc of bedsSnap.docs) {
                const bed = doc.data()

                // Resolve the most recent reviewedAt across all kamishibai domains
                let lastReviewedMs: number | null = null
                if (bed.kamishibai && typeof bed.kamishibai === 'object') {
                    for (const entry of Object.values(bed.kamishibai)) {
                        const raw = (entry as Record<string, unknown>)?.reviewedAt
                        if (!raw) continue
                        let ms: number
                        if (typeof raw === 'string') {
                            ms = new Date(raw).getTime()
                        } else {
                            ms = (raw as Timestamp).toMillis()
                        }
                        if (!isNaN(ms) && (lastReviewedMs === null || ms > lastReviewedMs)) {
                            lastReviewedMs = ms
                        }
                    }
                }

                // Fall back to bed.updatedAt when no reviewedAt is available
                if (lastReviewedMs === null) {
                    const rawTs = bed.updatedAt
                    if (!rawTs) continue
                    if (typeof rawTs === 'string') {
                        lastReviewedMs = new Date(rawTs).getTime()
                    } else {
                        lastReviewedMs = (rawTs as Timestamp).toMillis()
                    }
                    if (isNaN(lastReviewedMs)) continue
                }

                const age = now.getTime() - lastReviewedMs
                if (age > ms12h) stale12h++
                if (age > ms24h) stale24h++
                if (age > ms48h) stale48h++
            }

            // ---- Audit log activity patterns (last 7 days) ----
            const sevenDaysAgo = new Date(now)
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
            sevenDaysAgo.setHours(0, 0, 0, 0)

            const logsSnap = await db.collection(`units/${unitId}/audit_logs`)
                .where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo))
                .get()

            // updatesByHour: counts per hour of day (0-23), based on local hour of log
            const hourCounts = new Array<number>(24).fill(0)
            // updatesByDay: counts per date string (last 7 days)
            const dayCounts = new Map<string, number>()

            for (const doc of logsSnap.docs) {
                const log = doc.data()
                const tsRaw = log.createdAt as Timestamp
                if (!tsRaw?.toMillis) continue
                const d = new Date(tsRaw.toMillis())
                hourCounts[d.getHours()]++
                const dateStr = d.toISOString().slice(0, 10)
                dayCounts.set(dateStr, (dayCounts.get(dateStr) ?? 0) + 1)
            }

            const updatesByHour = hourCounts.map((count, hour) => ({ hour, count }))

            // Build a full 7-day array (fill 0 for days with no events)
            const today = new Date(now)
            today.setHours(0, 0, 0, 0)
            const updatesByDay = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(today)
                d.setDate(today.getDate() - (6 - i))
                const dateStr = d.toISOString().slice(0, 10)
                return { date: dateStr, count: dayCounts.get(dateStr) ?? 0 }
            })

            return { stale12h, stale24h, stale48h, updatesByHour, updatesByDay }

        } catch (error: unknown) {
            if (error instanceof functions.https.HttpsError) throw error
            const msg = error instanceof Error ? error.message : 'Erro interno'
            throw new functions.https.HttpsError('internal', msg)
        }
    })