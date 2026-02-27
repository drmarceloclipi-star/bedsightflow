export type AnalyticsPeriodKey = 'today' | '7d' | '30d' | 'custom'
export type AnalyticsGranularity = 'day' | 'week'

export type AdminOverviewMetrics = {
    activePatients: number
    occupiedBeds: number
    vacantBeds: number
    dischargeLt24h: number
    bedsWithBlocker: number
    pendingKamishibai: number
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
    pending: number
    blocked: number
    na: number
}

export type KamishibaiDomainMetric = {
    domain: string
    ok: number
    pending: number
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
    // KPI 1
    blockedBedsCount: number
    blockedBedIds: string[]
    blockedAgingHoursByBedId: Record<string, number>
    maxBlockedAgingHours: number
    // KPI 2
    stale24hBedsCount: number
    staleBedIdsByBucket: { h12: string[]; h24: string[]; h48: string[] }
    // KPI 3
    kamishibaiPendingBedsCount: number
    kamishibaiPendingBedIds: string[]
    kamishibaiImpedimentBedsCount: number
    kamishibaiImpedimentBedIds: string[]
    // KPI 4
    dischargeNext24hCount: number
    dischargeNext24hBedIds: string[]
    // KPI 7 (now)
    topBlockerNow: TopBlockerNow | null
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

