import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import type { Timestamp } from 'firebase-admin/firestore'
import { computeEscalations, EscalationThresholds } from '../../shared/escalation'
import { computeShiftKey } from '../../shared/shiftKey'

// ── Types ─────────────────────────────────────────────────────────────────────

type KamishibaiStatus = 'ok' | 'blocked' | 'na'

interface KamishibaiEntry {
    status?: KamishibaiStatus
    blockedAt?: Timestamp | string | null
    updatedAt?: Timestamp | string | null
    reviewedAt?: Timestamp | string | null
    reviewedShiftKey?: string | null
}

export interface MissionControlThresholdsDoc {
    blockedPctWarning?: number
    blockedPctCritical?: number
    kamishibaiImpedimentPctWarning?: number
    kamishibaiImpedimentPctCritical?: number
    freshness12hWarningCount?: number
    freshness24hWarningCount?: number
    freshness24hCriticalCount?: number
    freshness48hCriticalCount?: number
    unreviewedShiftWarningCount?: number
    unreviewedShiftCriticalCount?: number
    escalationOverdueHoursWarning?: number
    escalationOverdueHoursCritical?: number
    escalationMainBlockerHoursWarning?: number
    escalationMainBlockerHoursCritical?: number
}

export const DEFAULT_THRESHOLDS: Required<MissionControlThresholdsDoc> = {
    blockedPctWarning: 20,
    blockedPctCritical: 35,
    kamishibaiImpedimentPctWarning: 15,
    kamishibaiImpedimentPctCritical: 30,
    freshness12hWarningCount: 5,
    freshness24hWarningCount: 1,
    freshness24hCriticalCount: 3,
    freshness48hCriticalCount: 1,
    unreviewedShiftWarningCount: 3,
    unreviewedShiftCriticalCount: 6,
    escalationOverdueHoursWarning: 6,
    escalationOverdueHoursCritical: 12,
    escalationMainBlockerHoursWarning: 8,
    escalationMainBlockerHoursCritical: 24,
}

// ── Timestamp helpers ─────────────────────────────────────────────────────────

function toMillis(raw: unknown): number | null {
    if (!raw) return null
    if (typeof raw === 'string') {
        const ms = new Date(raw).getTime()
        return isNaN(ms) ? null : ms
    }
    if (typeof raw === 'object' && raw !== null && 'toMillis' in raw) {
        return (raw as Timestamp).toMillis()
    }
    return null
}

const KAMISHIBAI_DOMAINS = ['nursing', 'medical', 'physio', 'nutrition', 'social', 'psychology'] as const

// ── Public input types for buildSnapshot ─────────────────────────────────────

export interface SnapshotOpsSettings {
    kamishibaiEnabled?: boolean
    huddleSchedule?: { amStart?: string; pmStart?: string }
}

// ── buildSnapshot — pure function, testable without Firestore ─────────────────
/**
 * Computes the Mission Control Snapshot given raw data.
 * No Firestore reads — all data passed as arguments.
 * Used by the onCall handler and by unit tests.
 */
export function buildSnapshot(
    beds: Array<Record<string, unknown>>,
    ops: SnapshotOpsSettings,
    rawThresholds: MissionControlThresholdsDoc,
    now: Date
): Record<string, unknown> {
    const nowMs = now.getTime()

    const thresholds: Required<MissionControlThresholdsDoc> = {
        blockedPctWarning: rawThresholds.blockedPctWarning ?? DEFAULT_THRESHOLDS.blockedPctWarning,
        blockedPctCritical: rawThresholds.blockedPctCritical ?? DEFAULT_THRESHOLDS.blockedPctCritical,
        kamishibaiImpedimentPctWarning: rawThresholds.kamishibaiImpedimentPctWarning ?? DEFAULT_THRESHOLDS.kamishibaiImpedimentPctWarning,
        kamishibaiImpedimentPctCritical: rawThresholds.kamishibaiImpedimentPctCritical ?? DEFAULT_THRESHOLDS.kamishibaiImpedimentPctCritical,
        freshness12hWarningCount: rawThresholds.freshness12hWarningCount ?? DEFAULT_THRESHOLDS.freshness12hWarningCount,
        freshness24hWarningCount: rawThresholds.freshness24hWarningCount ?? DEFAULT_THRESHOLDS.freshness24hWarningCount,
        freshness24hCriticalCount: rawThresholds.freshness24hCriticalCount ?? DEFAULT_THRESHOLDS.freshness24hCriticalCount,
        freshness48hCriticalCount: rawThresholds.freshness48hCriticalCount ?? DEFAULT_THRESHOLDS.freshness48hCriticalCount,
        unreviewedShiftWarningCount: rawThresholds.unreviewedShiftWarningCount ?? DEFAULT_THRESHOLDS.unreviewedShiftWarningCount,
        unreviewedShiftCriticalCount: rawThresholds.unreviewedShiftCriticalCount ?? DEFAULT_THRESHOLDS.unreviewedShiftCriticalCount,
        escalationOverdueHoursWarning: rawThresholds.escalationOverdueHoursWarning ?? DEFAULT_THRESHOLDS.escalationOverdueHoursWarning,
        escalationOverdueHoursCritical: rawThresholds.escalationOverdueHoursCritical ?? DEFAULT_THRESHOLDS.escalationOverdueHoursCritical,
        escalationMainBlockerHoursWarning: rawThresholds.escalationMainBlockerHoursWarning ?? DEFAULT_THRESHOLDS.escalationMainBlockerHoursWarning,
        escalationMainBlockerHoursCritical: rawThresholds.escalationMainBlockerHoursCritical ?? DEFAULT_THRESHOLDS.escalationMainBlockerHoursCritical,
    }

    const kamishibaiEnabled: boolean = typeof ops.kamishibaiEnabled === 'boolean' ? ops.kamishibaiEnabled : true
    const currentShift = computeShiftKey(
        now,
        ops.huddleSchedule?.amStart ?? '07:00',
        ops.huddleSchedule?.pmStart ?? '19:00',
    )

    const ms12h = 12 * 3600000
    const ms24h = 24 * 3600000
    const ms48h = 48 * 3600000

    let activeBedsCount = 0
    const totalBedsCount = beds.length
    const blockedBedIds: string[] = []
    const blockedAgingHoursByBedId: Record<string, number> = {}
    const blockedAgingFallbackBedIds: string[] = []
    const warnings: string[] = []
    let maxBlockedAgingHours = 0
    const staleBedIdsByBucket: { h12: string[]; h24: string[]; h48: string[] } = { h12: [], h24: [], h48: [] }
    const kamishibaiImpedimentBedIds: string[] = []
    const kamishibaiImpedimentsByDomainCount: Record<string, number> = {}
    let kamishibaiMaxBlockedAgingHours = 0
    const unreviewedBedIds: string[] = []
    const unreviewedByDomainCount: Record<string, number> = {}
    const dischargeNext24hBedIds: string[] = []
    const blockerCounts = new Map<string, number>()
    let openPendenciesCount = 0
    let overduePendenciesCount = 0
    const bedsWithOpenPendenciesIds: string[] = []
    const escalationThresholdsUsados: EscalationThresholds = {
        escalationOverdueHoursWarning: thresholds.escalationOverdueHoursWarning,
        escalationOverdueHoursCritical: thresholds.escalationOverdueHoursCritical,
        escalationMainBlockerHoursWarning: thresholds.escalationMainBlockerHoursWarning,
        escalationMainBlockerHoursCritical: thresholds.escalationMainBlockerHoursCritical,
    }
    const escalationsResult = computeEscalations(beds, escalationThresholdsUsados, now)

    for (const bed of beds) {
        const bedId = bed.id as string
        const hasPatient = typeof bed.patientAlias === 'string' && (bed.patientAlias as string).trim() !== ''
        if (hasPatient) activeBedsCount++

        if (hasPatient) {
            const kamishibai = bed.kamishibai && typeof bed.kamishibai === 'object'
                ? bed.kamishibai as Record<string, KamishibaiEntry> : {}
            const applicable: string[] = Array.isArray(bed.applicableDomains) && (bed.applicableDomains as string[]).length > 0
                ? (bed.applicableDomains as string[]) : [...KAMISHIBAI_DOMAINS]
            let maxReviewedAtMs: number | null = null
            for (const domain of applicable) {
                const entry = kamishibai[domain]
                if (!entry) continue
                const ms = toMillis(entry.reviewedAt)
                if (ms !== null && (maxReviewedAtMs === null || ms > maxReviewedAtMs)) maxReviewedAtMs = ms
            }
            const refMs = maxReviewedAtMs ?? (nowMs - ms48h - 1)
            const age = nowMs - refMs
            if (age > ms12h) staleBedIdsByBucket.h12.push(bedId)
            if (age > ms24h) staleBedIdsByBucket.h24.push(bedId)
            if (age > ms48h) staleBedIdsByBucket.h48.push(bedId)
        }

        if (!hasPatient) continue

        const blocker = typeof bed.mainBlocker === 'string' ? (bed.mainBlocker as string).trim() : ''
        if (blocker) {
            blockedBedIds.push(bedId)
            blockerCounts.set(blocker, (blockerCounts.get(blocker) ?? 0) + 1)
            const blockedAtMs = toMillis(bed.mainBlockerBlockedAt)
            let agingMs: number
            if (blockedAtMs !== null) {
                agingMs = nowMs - blockedAtMs
            } else {
                const fallbackMs = toMillis(bed.updatedAt)
                agingMs = fallbackMs !== null ? nowMs - fallbackMs : 0
                blockedAgingFallbackBedIds.push(bedId)
                warnings.push(`WARN_BLOCKED_AT_MISSING: bed_${bed.number ?? bedId} used updatedAt as proxy for aging`)
            }
            const agingHours = Math.round(agingMs / 3600000)
            blockedAgingHoursByBedId[bedId] = agingHours
            if (agingHours > maxBlockedAgingHours) maxBlockedAgingHours = agingHours
        }

        const kamishibai = bed.kamishibai && typeof bed.kamishibai === 'object'
            ? bed.kamishibai as Record<string, KamishibaiEntry> : {}
        const applicable: string[] = Array.isArray(bed.applicableDomains) && (bed.applicableDomains as string[]).length > 0
            ? (bed.applicableDomains as string[]) : [...KAMISHIBAI_DOMAINS]
        let bedHasAnyImpediment = false
        let bedHasAnyUnreviewed = false

        for (const domain of applicable) {
            const entry: KamishibaiEntry | undefined = kamishibai[domain]
            if (entry?.status === 'blocked') {
                bedHasAnyImpediment = true
                kamishibaiImpedimentsByDomainCount[domain] = (kamishibaiImpedimentsByDomainCount[domain] ?? 0) + 1
                const blockedAtMs = toMillis(entry.blockedAt) ?? toMillis(entry.updatedAt) ?? toMillis(bed.updatedAt)
                if (blockedAtMs !== null) {
                    const agingH = Math.round((nowMs - blockedAtMs) / 3600000)
                    if (agingH > kamishibaiMaxBlockedAgingHours) kamishibaiMaxBlockedAgingHours = agingH
                }
            }
            if (entry?.status !== 'blocked' && kamishibaiEnabled) {
                const isReviewed = entry?.reviewedShiftKey === currentShift
                if (!isReviewed) {
                    bedHasAnyUnreviewed = true
                    unreviewedByDomainCount[domain] = (unreviewedByDomainCount[domain] ?? 0) + 1
                }
            }
        }

        if (bedHasAnyImpediment) kamishibaiImpedimentBedIds.push(bedId)
        if (bedHasAnyUnreviewed) unreviewedBedIds.push(bedId)

        const rawPendencies = Array.isArray(bed.pendencies)
            ? bed.pendencies as Array<{ id?: string; status?: string; dueAt?: string | null }> : []
        const openPendencies = rawPendencies.filter(p => p.status === 'open' && p.id)
        const overduePendencies = openPendencies.filter(p => {
            if (!p.dueAt) return false
            const dueMs = toMillis(p.dueAt)
            return dueMs !== null && dueMs < nowMs
        })
        if (openPendencies.length > 0) { openPendenciesCount += openPendencies.length; bedsWithOpenPendenciesIds.push(bedId) }
        if (overduePendencies.length > 0) overduePendenciesCount += overduePendencies.length
        if (bed.expectedDischarge === '24h') dischargeNext24hBedIds.push(bedId)
    }

    let topBlockerName: string | null = null
    let topBlockerBedCount = 0
    let topBlockerShare = 0
    if (blockerCounts.size > 0) {
        const sorted = Array.from(blockerCounts.entries()).sort((a, b) => b[1] - a[1])
        topBlockerName = sorted[0][0]
        topBlockerBedCount = sorted[0][1]
        topBlockerShare = blockedBedIds.length > 0 ? Math.round((topBlockerBedCount / blockedBedIds.length) * 100) : 0
    }

    return {
        generatedAt: now.toISOString(),
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
        kamishibaiImpedimentBedsCount: kamishibaiImpedimentBedIds.length,
        kamishibaiImpedimentBedIds,
        dischargeNext24hCount: dischargeNext24hBedIds.length,
        dischargeNext24hBedIds,
        topBlockerNow: topBlockerName ? { name: topBlockerName, bedCount: topBlockerBedCount, share: topBlockerShare } : null,
        thresholdsUsed: thresholds,
        warnings: warnings.length > 0 ? warnings : undefined,
        unreviewedBedsCount: kamishibaiEnabled ? unreviewedBedIds.length : 0,
        unreviewedBedIds: kamishibaiEnabled ? unreviewedBedIds : [],
        unreviewedByDomainCount: kamishibaiEnabled ? unreviewedByDomainCount : {},
        kamishibaiImpedimentsByDomainCount,
        kamishibaiMaxBlockedAgingHours,
        blockedAgingFallbackBedIds: blockedAgingFallbackBedIds.length > 0 ? blockedAgingFallbackBedIds : undefined,
        kamishibaiEnabled,
        openPendenciesCount,
        overduePendenciesCount,
        bedsWithOpenPendenciesCount: bedsWithOpenPendenciesIds.length,
        bedsWithOpenPendenciesIds,
        escalations: {
            total: escalationsResult.total,
            overdueCritical: escalationsResult.overdueCriticalBedIds.length,
            blockerCritical: escalationsResult.blockerCriticalBedIds.length,
            overdueCriticalBedIds: escalationsResult.overdueCriticalBedIds,
            blockerCriticalBedIds: escalationsResult.blockerCriticalBedIds,
        }
    }
}

/**
 * getAdminMissionControlSnapshot v1 — Cloud Function onCall.
 * Delegates computation to buildSnapshot (pure, testable).
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
        const now = new Date()
        const [bedsSnap, opsSnap, mcSnap] = await Promise.all([
            db.collection(`units/${unitId}/beds`).get(),
            db.doc(`units/${unitId}/settings/ops`).get(),
            db.doc(`units/${unitId}/settings/mission_control`).get(),
        ])
        const rawThresholds = mcSnap.exists ? (mcSnap.data() as MissionControlThresholdsDoc) : {}
        const opsData = opsSnap.exists ? opsSnap.data() : {}
        const ops: SnapshotOpsSettings = {
            kamishibaiEnabled: typeof opsData?.kamishibaiEnabled === 'boolean' ? opsData.kamishibaiEnabled : undefined,
            huddleSchedule: opsData?.huddleSchedule as { amStart?: string; pmStart?: string } | undefined,
        }
        const beds = bedsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        return buildSnapshot(beds, ops, rawThresholds, now)
    })
