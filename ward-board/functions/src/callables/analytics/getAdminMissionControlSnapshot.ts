import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import type { Timestamp } from 'firebase-admin/firestore'

// ── Types ─────────────────────────────────────────────────────────────────────

type KamishibaiStatus = 'ok' | 'blocked' | 'na'

interface KamishibaiEntry {
    status?: KamishibaiStatus
    blockedAt?: Timestamp | string | null
    updatedAt?: Timestamp | string | null
    reviewedAt?: Timestamp | string | null
    reviewedShiftKey?: string | null
}

interface MissionControlThresholdsDoc {
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
}

const DEFAULT_THRESHOLDS: Required<MissionControlThresholdsDoc> = {
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
}

// ── ShiftKey helper (inline — não importa src/) ────────────────────────────────
const SHIFT_TZ = 'America/Sao_Paulo'

function computeShiftKey(now: Date, amStart = '07:00', pmStart = '19:00'): string {
    const localStr = new Intl.DateTimeFormat('sv-SE', {
        timeZone: SHIFT_TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now)
    const [datePart, timePart] = localStr.split(' ')
    const [h, m] = (timePart ?? '00:00').split(':').map(Number)
    const localMin = (h ?? 0) * 60 + (m ?? 0)
    const [amH, amM] = amStart.split(':').map(Number)
    const [pmH, pmM] = pmStart.split(':').map(Number)
    const amMinutes = (amH ?? 7) * 60 + (amM ?? 0)
    const pmMinutes = (pmH ?? 19) * 60 + (pmM ?? 0)

    if (localMin >= amMinutes && localMin < pmMinutes) return `${datePart}-AM`
    if (localMin >= pmMinutes) return `${datePart}-PM`
    // madrugada → PM do dia anterior
    const d = new Date((datePart ?? '') + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    return `${d.toISOString().slice(0, 10)}-PM`
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

/**
 * getAdminMissionControlSnapshot v1
 *
 * Corrects aging/freshness bugs from v0:
 * - Aging KPI1: uses mainBlockerBlockedAt (fallback: updatedAt proxy + warning)
 * - Freshness KPI2: uses max(kamishibai.{domain}.reviewedAt) per bed (not bed.updatedAt)
 * - Adds: unreviewedBedsCount (UNREVIEWED_THIS_SHIFT), kamishibaiImpedimentsByDomain
 * - Adds: thresholdsUsed (from settings/mission_control, merged with defaults)
 * - Adds: kamishibaiEnabled (ops.kamishibaiEnabled)
 *
 * Ref: LEAN_CONTRACT_HRHDS.md, LEAN_SHIFTKEY_SPEC_HRHDS.md, SCHEMA_V1_CHANGELOG.md
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
        const now = Date.now()

        // ── Fetch paralelo: beds + ops settings + mc thresholds ────────────────
        const [bedsSnap, opsSnap, mcSnap] = await Promise.all([
            db.collection(`units/${unitId}/beds`).get(),
            db.doc(`units/${unitId}/settings/ops`).get(),
            db.doc(`units/${unitId}/settings/mission_control`).get(),
        ])

        // ── Thresholds (merge defaults) ────────────────────────────────────────
        const rawThresholds = mcSnap.exists ? (mcSnap.data() as MissionControlThresholdsDoc) : {}
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
        }

        // ── Ops settings ───────────────────────────────────────────────────────
        const opsData = opsSnap.exists ? opsSnap.data() : {}
        const kamishibaiEnabled: boolean = typeof opsData?.kamishibaiEnabled === 'boolean'
            ? opsData.kamishibaiEnabled
            : true // compat v0: default true
        const huddleSchedule = opsData?.huddleSchedule as { amStart?: string; pmStart?: string } | undefined
        const currentShift = computeShiftKey(
            new Date(now),
            huddleSchedule?.amStart ?? '07:00',
            huddleSchedule?.pmStart ?? '19:00',
        )

        // ── Accumulators ───────────────────────────────────────────────────────
        const ms12h = 12 * 60 * 60 * 1000
        const ms24h = 24 * 60 * 60 * 1000
        const ms48h = 48 * 60 * 60 * 1000

        let activeBedsCount = 0
        const totalBedsCount = bedsSnap.size

        // KPI 1 — Bloqueados
        const blockedBedIds: string[] = []
        const blockedAgingHoursByBedId: Record<string, number> = {}
        const blockedAgingFallbackBedIds: string[] = []
        const warnings: string[] = []
        let maxBlockedAgingHours = 0

        // KPI 2 — Freshness (v1: lastReviewedAt por bed, não updatedAt)
        const staleBedIdsByBucket: { h12: string[]; h24: string[]; h48: string[] } = {
            h12: [], h24: [], h48: [],
        }

        // KPI 3 — Kamishibai
        const kamishibaiImpedimentBedIds: string[] = []
        const kamishibaiImpedimentsByDomainCount: Record<string, number> = {}
        let kamishibaiMaxBlockedAgingHours = 0

        // v1: Não revisados neste turno
        const unreviewedBedIds: string[] = []
        const unreviewedByDomainCount: Record<string, number> = {}

        // KPI 4 — Altas
        const dischargeNext24hBedIds: string[] = []

        // KPI 7 — Top blocker
        const blockerCounts = new Map<string, number>()

        // Pendências v1
        let openPendenciesCount = 0
        let overduePendenciesCount = 0
        const bedsWithOpenPendenciesIds: string[] = []

        for (const doc of bedsSnap.docs) {
            const bed = doc.data()
            const bedId = doc.id
            const hasPatient = typeof bed.patientAlias === 'string' && bed.patientAlias.trim() !== ''

            if (hasPatient) activeBedsCount++

            // ── v1: Freshness — usa max(reviewedAt nos domínios aplicáveis) ───
            // Substitui updatedAt como proxy (era bug auditado)
            if (hasPatient) {
                const kamishibai = bed.kamishibai && typeof bed.kamishibai === 'object'
                    ? bed.kamishibai as Record<string, KamishibaiEntry>
                    : {}

                // Applicability: applicableDomains se presente (Variante A), senão todos os 6
                const applicable: string[] = Array.isArray(bed.applicableDomains) && bed.applicableDomains.length > 0
                    ? (bed.applicableDomains as string[])
                    : [...KAMISHIBAI_DOMAINS]

                // Freshness: max(reviewedAt) entre domínios aplicáveis
                let maxReviewedAtMs: number | null = null
                for (const domain of applicable) {
                    const entry = kamishibai[domain]
                    if (!entry) continue
                    const ms = toMillis(entry.reviewedAt)
                    if (ms !== null && (maxReviewedAtMs === null || ms > maxReviewedAtMs)) {
                        maxReviewedAtMs = ms
                    }
                }

                // Se nenhum reviewedAt → conservador → bucket 48h
                const refMs = maxReviewedAtMs ?? (now - ms48h - 1)
                const age = now - refMs
                if (age > ms12h) staleBedIdsByBucket.h12.push(bedId)
                if (age > ms24h) staleBedIdsByBucket.h24.push(bedId)
                if (age > ms48h) staleBedIdsByBucket.h48.push(bedId)
            }

            if (!hasPatient) continue

            // ── KPI 1: Bloqueados + aging real ────────────────────────────────
            const blocker = typeof bed.mainBlocker === 'string' ? bed.mainBlocker.trim() : ''
            if (blocker) {
                blockedBedIds.push(bedId)
                blockerCounts.set(blocker, (blockerCounts.get(blocker) ?? 0) + 1)

                // v1: usa mainBlockerBlockedAt; fallback updatedAt + warning
                const blockedAtMs = toMillis(bed.mainBlockerBlockedAt)
                let agingMs: number
                if (blockedAtMs !== null) {
                    agingMs = now - blockedAtMs
                } else {
                    // Fallback proxy — gera warning
                    const fallbackMs = toMillis(bed.updatedAt)
                    agingMs = fallbackMs !== null ? now - fallbackMs : 0
                    blockedAgingFallbackBedIds.push(bedId)
                    warnings.push(`WARN_BLOCKED_AT_MISSING: bed_${bed.number ?? bedId} used updatedAt as proxy for aging`)
                }
                const agingHours = Math.round(agingMs / 3600000)
                blockedAgingHoursByBedId[bedId] = agingHours
                if (agingHours > maxBlockedAgingHours) maxBlockedAgingHours = agingHours
            }

            // ── KPI 3: Kamishibai impedimentos + aging + unreviewed ───────────
            const kamishibai = bed.kamishibai && typeof bed.kamishibai === 'object'
                ? bed.kamishibai as Record<string, KamishibaiEntry>
                : {}

            const applicable: string[] = Array.isArray(bed.applicableDomains) && bed.applicableDomains.length > 0
                ? (bed.applicableDomains as string[])
                : [...KAMISHIBAI_DOMAINS]

            let bedHasAnyImpediment = false
            let bedHasAnyUnreviewed = false

            for (const domain of applicable) {
                const entry: KamishibaiEntry | undefined = kamishibai[domain]

                // Kamishibai impedimento (blocked)
                if (entry?.status === 'blocked') {
                    bedHasAnyImpediment = true
                    kamishibaiImpedimentsByDomainCount[domain] =
                        (kamishibaiImpedimentsByDomainCount[domain] ?? 0) + 1

                    // Aging por domínio: blockedAt > updatedAt do entry > updatedAt do bed
                    const blockedAtMs = toMillis(entry.blockedAt)
                        ?? toMillis(entry.updatedAt)
                        ?? toMillis(bed.updatedAt)
                    if (blockedAtMs !== null) {
                        const agingH = Math.round((now - blockedAtMs) / 3600000)
                        if (agingH > kamishibaiMaxBlockedAgingHours) {
                            kamishibaiMaxBlockedAgingHours = agingH
                        }
                    }
                }

                // Unreviewed this shift: domínio aplicável, não blocked, reviewedShiftKey ≠ currentShift
                // (reproduz regra 5 do resolveKamishibaiVisualState sem importar src/)
                if (entry?.status !== 'blocked' && kamishibaiEnabled) {
                    const reviewedShiftKey = entry?.reviewedShiftKey
                    const isReviewed = reviewedShiftKey === currentShift
                    if (!isReviewed) {
                        bedHasAnyUnreviewed = true
                        unreviewedByDomainCount[domain] =
                            (unreviewedByDomainCount[domain] ?? 0) + 1
                    }
                }
            }

            if (bedHasAnyImpediment) kamishibaiImpedimentBedIds.push(bedId)
            if (bedHasAnyUnreviewed) unreviewedBedIds.push(bedId)

            // ── Pendências v1 ─────────────────────────────────────────────────
            const rawPendencies = Array.isArray(bed.pendencies) ? bed.pendencies : []

            // Integridade: pendências sem id não devem ser contadas (WARN_PENDENCY_MISSING_ID)
            const missingIds = rawPendencies.filter((p: { id?: string }) => !p.id)
            if (missingIds.length > 0) {
                console.warn('WARN_PENDENCY_MISSING_ID', { bedId, count: missingIds.length })
            }

            // Somente status='open' conta — 'canceled' e 'done' são ignorados
            const openPendencies = rawPendencies.filter(
                (p: { status?: string; id?: string }) => p.status === 'open' && p.id
            )
            const overduePendencies = openPendencies.filter((p: { dueAt?: string | null }) => {
                if (!p.dueAt) return false
                const dueMs = toMillis(p.dueAt)
                return dueMs !== null && dueMs < now
            })
            if (openPendencies.length > 0) {
                openPendenciesCount += openPendencies.length
                bedsWithOpenPendenciesIds.push(bedId)
            }
            overduePendenciesCount += overduePendencies.length


            // ── KPI 4: Altas ─────────────────────────────────────────────────
            if (bed.expectedDischarge === '24h') {
                dischargeNext24hBedIds.push(bedId)
            }
        }

        // ── Top blocker ────────────────────────────────────────────────────────
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
            // KPI 1
            blockedBedsCount: blockedBedIds.length,
            blockedBedIds,
            blockedAgingHoursByBedId,
            maxBlockedAgingHours,
            // KPI 2 — Freshness v1 (baseada em reviewedAt, não updatedAt)
            stale24hBedsCount: staleBedIdsByBucket.h24.length,
            staleBedIdsByBucket,
            // KPI 3
            kamishibaiImpedimentBedsCount: kamishibaiImpedimentBedIds.length,
            kamishibaiImpedimentBedIds,
            // KPI 4
            dischargeNext24hCount: dischargeNext24hBedIds.length,
            dischargeNext24hBedIds,
            // KPI 7
            topBlockerNow: topBlockerName
                ? { name: topBlockerName, bedCount: topBlockerBedCount, share: topBlockerShare }
                : null,
            // ── v1 additions ──────────────────────────────────────────────────
            thresholdsUsed: thresholds,
            warnings: warnings.length > 0 ? warnings : undefined,
            unreviewedBedsCount: kamishibaiEnabled ? unreviewedBedIds.length : 0,
            unreviewedBedIds: kamishibaiEnabled ? unreviewedBedIds : [],
            unreviewedByDomainCount: kamishibaiEnabled ? unreviewedByDomainCount : {},
            kamishibaiImpedimentsByDomainCount,
            kamishibaiMaxBlockedAgingHours,
            blockedAgingFallbackBedIds: blockedAgingFallbackBedIds.length > 0 ? blockedAgingFallbackBedIds : undefined,
            kamishibaiEnabled,
            // Pendências v1
            openPendenciesCount,
            overduePendenciesCount,
            bedsWithOpenPendenciesCount: bedsWithOpenPendenciesIds.length,
            bedsWithOpenPendenciesIds,
        }
    })
