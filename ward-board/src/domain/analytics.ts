export type AnalyticsPeriodKey = 'today' | '7d' | '30d' | 'custom'
export type AnalyticsGranularity = 'day' | 'week'

export type AdminOverviewMetrics = {
    activePatients: number
    occupiedBeds: number
    vacantBeds: number
    dischargeLt24h: number
    bedsWithBlocker: number
    blockedKamishibai: number
    staleBeds24h: number
}

export type DailyBucketPoint = {
    date: string
    lt24h: number
    d2to3: number
    gt3d: number
    undefinedBucket: number
}

export type KamishibaiStatusBreakdown = {
    ok: number
    blocked: number
    na: number
}

export type KamishibaiDomainMetric = {
    domain: string
    ok: number
    blocked: number
    na: number
}

export type BlockerMetric = {
    blocker: string
    count: number
    previousCount?: number
    delta?: number
}

export type FreshnessMetrics = {
    stale12h: number
    stale24h: number
    stale48h: number
    updatesByHour: Array<{ hour: number; count: number }>
    updatesByDay: Array<{ date: string; count: number }>
}

export type TrendComparisonMetric = {
    label: string
    current: number
    previous: number
    diffPercent: number
}

// ---- Mission Control types ----

export type KpiStatus = 'ok' | 'warning' | 'critical'

export type TopBlockerNow = {
    name: string
    bedCount: number
    share: number // 0-100
}

export type MissionControlSnapshot = {
    generatedAt: string
    source: string
    definitionsVersion: string
    totalBedsCount: number
    activeBedsCount: number
    // KPI 1 — Bloqueados agora
    blockedBedsCount: number
    blockedBedIds: string[]
    blockedAgingHoursByBedId: Record<string, number>
    maxBlockedAgingHours: number
    // KPI 2 — Freshness (v1: baseada em lastReviewedAt por domínio, não em updatedAt)
    stale24hBedsCount: number
    staleBedIdsByBucket: { h12: string[]; h24: string[]; h48: string[] }
    // KPI 3 — Kamishibai impedimentos
    kamishibaiImpedimentBedsCount: number
    kamishibaiImpedimentBedIds: string[]
    // KPI 4 — Altas próximas 24h
    dischargeNext24hCount: number
    dischargeNext24hBedIds: string[]
    // KPI 7 — Top bloqueador
    topBlockerNow: TopBlockerNow | null
    // ── v1 additions (backwards-compatible — todos opcionais) ─────────────────
    /** Thresholds efetivamente usados (defaults + overrides de settings/mission_control) */
    thresholdsUsed?: import('./missionControl').MissionControlThresholds
    /** Avisos de qualidade de dados (ex: mainBlockerBlockedAt ausente, usado updatedAt proxy) */
    warnings?: string[]
    /** Leitos ativos com pelo menos 1 domínio aplicável em UNREVIEWED_THIS_SHIFT */
    unreviewedBedsCount?: number
    unreviewedBedIds?: string[]
    /** Por domínio: quantos beds têm aquele domínio UNREVIEWED neste turno */
    unreviewedByDomainCount?: Record<string, number>
    /** Por domínio: quantos beds têm aquele domínio BLOCKED (kamishibai) */
    kamishibaiImpedimentsByDomainCount?: Record<string, number>
    /** Aging máximo de impedimento Kamishibai (kamishibai.{domain}.blockedAt, fallback updatedAt) */
    kamishibaiMaxBlockedAgingHours?: number
    /** IDs de leitos onde aging de bloqueador usou proxy (mainBlockerBlockedAt ausente) */
    blockedAgingFallbackBedIds?: string[]
    /** kamishibaiEnabled da unidade — false → cards Kamishibai devem ser ocultados na UI */
    kamishibaiEnabled?: boolean
    // ── Pendências v1 ─────────────────────────────────────────────────────────
    /** Total de pendências abertas (status=open) em todos os leitos */
    openPendenciesCount?: number
    /** Pendências vencidas (dueAt < now && status=open) */
    overduePendenciesCount?: number
    /** Quantidade de leitos com pelo menos 1 pendência aberta */
    bedsWithOpenPendenciesCount?: number
    bedsWithOpenPendenciesIds?: string[]
}

export type DailyDischarge = {
    date: string
    count: number
}

export type MissionControlPeriod = {
    generatedAt: string
    source: string
    definitionsVersion: string
    range: 'today' | '7d' | '30d'
    dischargesByDay: DailyDischarge[]
    totalDischarges: number
    avgDischargesPerDay: number
    prevPeriodTotalDischarges: number
    throughputDelta: number | null // percentage change vs previous period
    topBlockersPeriod: Array<{ blocker: string; count: number }>
}
