import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import type { Timestamp } from 'firebase-admin/firestore'

type KamishibaiStatus = 'ok' | 'blocked' | 'pending' | 'na'

/**
 * Returns Mission Control snapshot metrics from live Firestore data.
 *
 * Computes:
 *  - activeBedsCount, totalBedsCount
 *  - blockedBedsCount + blockedBedIds + blockedAgingHoursByBedId
 *  - stale24hBedsCount + staleBedIdsByBucket (12h, 24h, 48h)
 *  - kamishibaiPendingBedsCount + kamishibaiPendingBedIds     (Modo A)
 *  - kamishibaiImpedimentBedsCount + kamishibaiImpedimentBedIds
 *  - dischargeNext24hCount + dischargeNext24hBedIds
 *  - maxBlockedAgingHours (worst case right now)
 *  - topBlockerNow: blocker name + bedCount + share%
 *  - generatedAt, source, definitionsVersion
 */
export const getAdminMissionControlSnapshot = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'É preciso estar logado.')
        }

        const { unitId } = data
        if (!unitId) {
            throw new functions.https.HttpsError('invalid-argument', 'O unitId é obrigatório.')
        }

        const db = admin.firestore()
        const bedsSnap = await db.collection(`units/${unitId}/beds`).get()

        const now = Date.now()
        const ms12h = 12 * 60 * 60 * 1000
        const ms24h = 24 * 60 * 60 * 1000
        const ms48h = 48 * 60 * 60 * 1000

        let activeBedsCount = 0
        const totalBedsCount = bedsSnap.size

        // KPI 1 — Bloqueados agora
        const blockedBedIds: string[] = []
        const blockedAgingHoursByBedId: Record<string, number> = {}

        // KPI 2 — Sem atualização >24h
        const staleBedIdsByBucket: { h12: string[]; h24: string[]; h48: string[] } = {
            h12: [], h24: [], h48: [],
        }

        // KPI 3 — Pendências Kamishibai (Modo A: leito tem pelo menos 1 pending)
        const kamishibaiPendingBedIds: string[] = []
        // Também compute impedimentos (blocked)
        const kamishibaiImpedimentBedIds: string[] = []

        // KPI 4 — Altas próximas 24h
        const dischargeNext24hBedIds: string[] = []

        // For top blocker computation
        const blockerCounts = new Map<string, number>()

        let maxBlockedAgingHours = 0

        for (const doc of bedsSnap.docs) {
            const bed = doc.data()
            const bedId = doc.id
            const hasPatient = bed.patientAlias && bed.patientAlias.trim() !== ''

            if (hasPatient) activeBedsCount++

            // Freshness
            const rawTs = bed.updatedAt
            if (rawTs) {
                let updatedMs: number
                if (typeof rawTs === 'string') {
                    updatedMs = new Date(rawTs).getTime()
                } else {
                    updatedMs = (rawTs as Timestamp).toMillis()
                }
                if (!isNaN(updatedMs)) {
                    const age = now - updatedMs
                    if (age > ms12h) staleBedIdsByBucket.h12.push(bedId)
                    if (age > ms24h) staleBedIdsByBucket.h24.push(bedId)
                    if (age > ms48h) staleBedIdsByBucket.h48.push(bedId)
                }
            }

            if (!hasPatient) continue

            // KPI 1 — Bloqueados
            const blocker = bed.mainBlocker?.trim()
            if (blocker) {
                blockedBedIds.push(bedId)
                blockerCounts.set(blocker, (blockerCounts.get(blocker) ?? 0) + 1)

                // Compute aging from updatedAt as a proxy (best we have without a dedicated blockedAt)
                const rawTs2 = bed.updatedAt
                if (rawTs2) {
                    let updatedMs2: number
                    if (typeof rawTs2 === 'string') {
                        updatedMs2 = new Date(rawTs2).getTime()
                    } else {
                        updatedMs2 = (rawTs2 as Timestamp).toMillis()
                    }
                    if (!isNaN(updatedMs2)) {
                        const agingHours = Math.round((now - updatedMs2) / (60 * 60 * 1000))
                        blockedAgingHoursByBedId[bedId] = agingHours
                        if (agingHours > maxBlockedAgingHours) maxBlockedAgingHours = agingHours
                    }
                }
            }

            // KPI 3 — Kamishibai
            if (bed.kamishibai && typeof bed.kamishibai === 'object') {
                let hasPending = false
                let hasBlocked = false
                for (const entry of Object.values(bed.kamishibai)) {
                    const status = (entry as { status: KamishibaiStatus }).status
                    if (status === 'pending') hasPending = true
                    if (status === 'blocked') hasBlocked = true
                }
                if (hasPending) kamishibaiPendingBedIds.push(bedId)
                if (hasBlocked) kamishibaiImpedimentBedIds.push(bedId)
            }

            // KPI 4 — Alta próximas 24h
            if (bed.expectedDischarge === '24h') {
                dischargeNext24hBedIds.push(bedId)
            }
        }

        // Top blocker computation (for KPI 7)
        let topBlockerName: string | null = null
        let topBlockerBedCount = 0
        let topBlockerShare = 0
        if (blockerCounts.size > 0) {
            const sorted = Array.from(blockerCounts.entries()).sort((a, b) => b[1] - a[1])
            topBlockerName = sorted[0][0]
            topBlockerBedCount = sorted[0][1]
            topBlockerShare = blockedBedIds.length > 0
                ? Math.round((topBlockerBedCount / blockedBedIds.length) * 100)
                : 0
        }

        return {
            generatedAt: new Date().toISOString(),
            source: 'snapshot_firestore',
            definitionsVersion: 'v1',
            totalBedsCount,
            activeBedsCount,
            blockedBedsCount: blockedBedIds.length,
            blockedBedIds,
            blockedAgingHoursByBedId,
            maxBlockedAgingHours,
            stale24hBedsCount: staleBedIdsByBucket.h24.length,
            staleBedIdsByBucket,
            kamishibaiPendingBedsCount: kamishibaiPendingBedIds.length,
            kamishibaiPendingBedIds,
            kamishibaiImpedimentBedsCount: kamishibaiImpedimentBedIds.length,
            kamishibaiImpedimentBedIds,
            dischargeNext24hCount: dischargeNext24hBedIds.length,
            dischargeNext24hBedIds,
            topBlockerNow: topBlockerName
                ? { name: topBlockerName, bedCount: topBlockerBedCount, share: topBlockerShare }
                : null,
        }
    })
