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
