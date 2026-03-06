/**
 * LEAN Mission Control v1 — Thresholds configuráveis
 * Ref: LEAN_CONTRACT_HRHDS.md §4, AUDIT_MissionControl_2026-02-28.md
 *
 * Thresholds vivem em Firestore: units/{unitId}/settings/mission_control
 * Ausentes → defaults abaixo (sem breaking change).
 */
import escalationDefaults from '../../escalation-defaults.json';

// ── Interface ─────────────────────────────────────────────────────────────────

export interface MissionControlThresholds {
    /** % de leitos bloqueados que aciona warning */
    blockedPctWarning: number;
    /** % de leitos bloqueados que aciona critical */
    blockedPctCritical: number;
    /** Thresholds de aging do bloqueador (horas) */
    blockedAgingWarningHours: number;
    blockedAgingCriticalHours: number;
    /** Kamishibai % impedimentos */
    kamishibaiImpedimentPctWarning: number;
    kamishibaiImpedimentPctCritical: number;
    /** Freshness (by lastReviewedAt) — count de leitos não revisados */
    freshness12hWarningCount: number;
    freshness24hWarningCount: number;
    freshness24hCriticalCount: number;
    freshness48hCriticalCount: number;
    /** Não revisados neste turno — count de leitos */
    unreviewedShiftWarningCount: number;
    unreviewedShiftCriticalCount: number;
    /** Escalonamento v1 (horas) */
    escalationOverdueHoursWarning: number;
    escalationOverdueHoursCritical: number;
    escalationMainBlockerHoursWarning: number;
    escalationMainBlockerHoursCritical: number;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_MISSION_CONTROL_THRESHOLDS: MissionControlThresholds = {
    blockedPctWarning: 20,
    blockedPctCritical: 35,
    blockedAgingWarningHours: 12,
    blockedAgingCriticalHours: 24,
    kamishibaiImpedimentPctWarning: 15,
    kamishibaiImpedimentPctCritical: 30,
    freshness12hWarningCount: 5,
    freshness24hWarningCount: 1,
    freshness24hCriticalCount: 3,
    freshness48hCriticalCount: 1,
    unreviewedShiftWarningCount: 3,
    unreviewedShiftCriticalCount: 6,
    // Escalonamento v1 — Single Source of Truth: ../../escalation-defaults.json
    escalationOverdueHoursWarning: escalationDefaults.escalationOverdueHoursWarning,
    escalationOverdueHoursCritical: escalationDefaults.escalationOverdueHoursCritical,
    escalationMainBlockerHoursWarning: escalationDefaults.escalationMainBlockerHoursWarning,
    escalationMainBlockerHoursCritical: escalationDefaults.escalationMainBlockerHoursCritical,
};

// ── Parser Firestore doc → thresholds (merge seguro com defaults) ─────────────

export function parseMissionControlThresholds(raw: unknown): MissionControlThresholds {
    if (!raw || typeof raw !== 'object') return DEFAULT_MISSION_CONTROL_THRESHOLDS;
    const d = DEFAULT_MISSION_CONTROL_THRESHOLDS;
    const r = raw as Record<string, unknown>;
    const num = (key: keyof MissionControlThresholds) =>
        typeof r[key] === 'number' ? (r[key] as number) : d[key];
    return {
        blockedPctWarning: num('blockedPctWarning'),
        blockedPctCritical: num('blockedPctCritical'),
        blockedAgingWarningHours: num('blockedAgingWarningHours'),
        blockedAgingCriticalHours: num('blockedAgingCriticalHours'),
        kamishibaiImpedimentPctWarning: num('kamishibaiImpedimentPctWarning'),
        kamishibaiImpedimentPctCritical: num('kamishibaiImpedimentPctCritical'),
        freshness12hWarningCount: num('freshness12hWarningCount'),
        freshness24hWarningCount: num('freshness24hWarningCount'),
        freshness24hCriticalCount: num('freshness24hCriticalCount'),
        freshness48hCriticalCount: num('freshness48hCriticalCount'),
        unreviewedShiftWarningCount: num('unreviewedShiftWarningCount'),
        unreviewedShiftCriticalCount: num('unreviewedShiftCriticalCount'),
        escalationOverdueHoursWarning: num('escalationOverdueHoursWarning'),
        escalationOverdueHoursCritical: num('escalationOverdueHoursCritical'),
        escalationMainBlockerHoursWarning: num('escalationMainBlockerHoursWarning'),
        escalationMainBlockerHoursCritical: num('escalationMainBlockerHoursCritical'),
    };
}

// ── KPI Status helpers ────────────────────────────────────────────────────────
// Importáveis pela UI sem depender de firebase/functions

import type { KpiStatus } from './analytics';

export function blockedStatus(pct: number, t: MissionControlThresholds): KpiStatus {
    if (pct > t.blockedPctCritical) return 'critical';
    if (pct > t.blockedPctWarning) return 'warning';
    return 'ok';
}

export function kamishibaiImpedimentStatus(pct: number, t: MissionControlThresholds): KpiStatus {
    if (pct > t.kamishibaiImpedimentPctCritical) return 'critical';
    if (pct > t.kamishibaiImpedimentPctWarning) return 'warning';
    return 'ok';
}

export function freshnessStatus(count: number, tier: '12h' | '24h' | '48h', t: MissionControlThresholds): KpiStatus {
    if (count === 0) return 'ok';
    if (tier === '48h') return count >= t.freshness48hCriticalCount ? 'critical' : 'warning';
    if (tier === '24h') return count >= t.freshness24hCriticalCount ? 'critical' : 'warning';
    return count >= t.freshness12hWarningCount ? 'warning' : 'ok';
}

export function unreviewedShiftStatus(count: number, t: MissionControlThresholds): KpiStatus {
    if (count === 0) return 'ok';
    if (count >= t.unreviewedShiftCriticalCount) return 'critical';
    if (count >= t.unreviewedShiftWarningCount) return 'warning';
    return 'ok';
}
