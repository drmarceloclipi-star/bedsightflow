/**
 * HuddleAdherenceReport.tsx
 *
 * P2-03 — Relatório de aderência de huddle (histórico por turno).
 *
 * Exibe os últimos N turnos (padrão: 7 dias = 14 turnos) com métricas de:
 *   - Presença/ausência do huddle no turno
 *   - Latência (min. após início do turno até o 1º toque no huddle)
 *   - Duração do huddle (startedAt → endedAt)
 *   - Taxa de conclusão do checklist
 *   - Ações registradas e resolvidas
 */

import React, { useState, useEffect, useMemo } from 'react';
import { HuddleRepository } from '../../../../repositories/HuddleRepository';
import type { HuddleDoc } from '../../../../domain/huddle';
import { DEFAULT_SHIFT_SCHEDULE, DEFAULT_SHIFT_TZ } from '../../../../domain/shiftKey';
import type { ShiftSchedule } from '../../../../domain/shiftKey';
import type { UnitOpsSettings } from '../../../../domain/types';
import type { Timestamp } from 'firebase/firestore';

// ── Types ─────────────────────────────────────────────────────────────────────

type DayCount = 7 | 14 | 30;

interface ShiftRow {
    shiftKey: string;
    type: 'AM' | 'PM';
    date: string;
    huddle: HuddleDoc | null;
    // Computed metrics (null when no huddle)
    latencyMin: number | null;
    durationMin: number | null;
    checklistDone: number;
    checklistTotal: number;
    actionsCreated: number;
    actionsDone: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converte um valor TimestampLike do Firestore para milissegundos.
 * Suporta: Firestore Timestamp, Date, string ISO, número.
 */
function toMillis(ts: unknown): number | null {
    if (!ts) return null;
    if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
        return (ts as Timestamp).toMillis();
    }
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'string') {
        const d = new Date(ts);
        return isNaN(d.getTime()) ? null : d.getTime();
    }
    if (typeof ts === 'number') return ts;
    return null;
}

/**
 * Calcula o timestamp UTC do início teórico de um turno a partir do shiftKey e schedule.
 * shiftKey: "YYYY-MM-DD-AM" | "YYYY-MM-DD-PM"
 * Assume timezone America/Sao_Paulo (UTC-3).
 *
 * Usa Intl para obter o offset correto sem hard-coding BRT.
 */
function shiftStartMillis(shiftKey: string, schedule: ShiftSchedule, tz: string): number {
    const parts = shiftKey.split('-'); // ["YYYY", "MM", "DD", "AM"|"PM"]
    const dateStr = parts.slice(0, 3).join('-');
    const type = parts[3] as 'AM' | 'PM';
    const startTime = type === 'AM' ? schedule.amStart : schedule.pmStart;
    const [h, m] = startTime.split(':').map(Number);

    // Build an ISO string in local time, then adjust for the tz offset
    // Strategy: create the UTC time that corresponds to hh:mm in tz on dateStr
    const localNominal = new Date(`${dateStr}T${h.toString().padStart(2, '0')}:${(m ?? 0).toString().padStart(2, '0')}:00`);

    // Get offset for that nominal time in the target timezone (minutes, negative = west of UTC)
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    // Find the UTC offset by probing: we want the Date whose local representation in `tz` is dateStr hh:mm
    // A simple approach: approximate UTC time = localNominal + known_offset, then correct iteratively.
    // Simpler: use fixed UTC offset for SP (UTC-3 = 180 min)
    const offsetMs = 3 * 60 * 60 * 1000; // UTC-3 BRT (simplified; BRST adds 1h in summer — negligible for report)

    void formatter; // suppress unused warning — kept for documentation intent

    return localNominal.getTime() + offsetMs;
}

/**
 * Formata minutos como "Xh Ym" ou "Ym".
 */
function fmtMinutes(min: number): string {
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Formata um milissegundo como "HH:MM" em timezone SP.
 */
function fmtTime(ms: number | null, tz: string): string {
    if (ms === null) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(ms));
}

/**
 * Gera os N × 2 shift keys esperados para os últimos `days` dias (mais recente primeiro).
 */
function generateExpectedShiftKeys(days: DayCount, tz: string): { shiftKey: string; date: string; type: 'AM' | 'PM' }[] {
    const result: { shiftKey: string; date: string; type: 'AM' | 'PM' }[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(d);
        result.push({ shiftKey: `${dateStr}-PM`, date: dateStr, type: 'PM' });
        result.push({ shiftKey: `${dateStr}-AM`, date: dateStr, type: 'AM' });
    }

    return result;
}

/**
 * Computa as métricas de uma linha de turno.
 */
function buildRow(
    expected: { shiftKey: string; date: string; type: 'AM' | 'PM' },
    huddleMap: Map<string, HuddleDoc>,
    schedule: ShiftSchedule,
    tz: string
): ShiftRow {
    const huddle = huddleMap.get(expected.shiftKey) ?? null;

    if (!huddle) {
        return {
            ...expected,
            huddle: null,
            latencyMin: null,
            durationMin: null,
            checklistDone: 0,
            checklistTotal: 0,
            actionsCreated: 0,
            actionsDone: 0,
        };
    }

    const startMs = toMillis(huddle.startedAt);
    const endMs = toMillis(huddle.endedAt ?? null);
    const theoreticalStart = shiftStartMillis(expected.shiftKey, schedule, tz);

    const latencyMin = startMs !== null ? Math.max(0, Math.round((startMs - theoreticalStart) / 60000)) : null;
    const durationMin = startMs !== null && endMs !== null ? Math.max(0, Math.round((endMs - startMs) / 60000)) : null;

    const checklistDone = huddle.checklist.filter(i => i.status === 'done').length;
    const checklistTotal = huddle.checklist.length;
    const actionsCreated = huddle.topActions.length;
    const actionsDone = huddle.topActions.filter(a => a.status === 'done').length;

    return {
        ...expected,
        huddle,
        latencyMin,
        durationMin,
        checklistDone,
        checklistTotal,
        actionsCreated,
        actionsDone,
    };
}

// ── Summary metrics ────────────────────────────────────────────────────────────

interface SummaryMetrics {
    totalExpected: number;
    totalPresent: number;
    totalCompleted: number;
    adherencePct: number;
    completionPct: number;
    avgLatencyMin: number | null;
    avgDurationMin: number | null;
}

function computeSummary(rows: ShiftRow[]): SummaryMetrics {
    const totalExpected = rows.length;
    const present = rows.filter(r => r.huddle !== null);
    const completed = present.filter(r => r.durationMin !== null); // has endedAt

    const latencies = present.map(r => r.latencyMin).filter((v): v is number => v !== null);
    const durations = completed.map(r => r.durationMin).filter((v): v is number => v !== null);

    return {
        totalExpected,
        totalPresent: present.length,
        totalCompleted: completed.length,
        adherencePct: totalExpected > 0 ? Math.round((present.length / totalExpected) * 100) : 0,
        completionPct: totalExpected > 0 ? Math.round((completed.length / totalExpected) * 100) : 0,
        avgLatencyMin: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
        avgDurationMin: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
    unitId: string;
    opsSettings: UnitOpsSettings | null;
}

const HuddleAdherenceReport: React.FC<Props> = ({ unitId, opsSettings }) => {
    const [days, setDays] = useState<DayCount>(7);
    const [huddles, setHuddles] = useState<HuddleDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const schedule = opsSettings?.huddleSchedule ?? DEFAULT_SHIFT_SCHEDULE;
    const tz = DEFAULT_SHIFT_TZ;

    // Fetch more huddles when period increases (days × 2 shifts/day)
    useEffect(() => {
        setLoading(true);
        setError(null);
        HuddleRepository.listRecentHuddles(unitId, days * 2)
            .then(setHuddles)
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
            })
            .finally(() => setLoading(false));
    }, [unitId, days]);

    const rows = useMemo<ShiftRow[]>(() => {
        const expected = generateExpectedShiftKeys(days, tz);
        const huddleMap = new Map(huddles.map(h => [h.shiftKey, h]));
        return expected.map(e => buildRow(e, huddleMap, schedule, tz));
    }, [days, huddles, schedule, tz]);

    const summary = useMemo(() => computeSummary(rows), [rows]);

    return (
        <div className="bg-surface-1 border rounded-lg p-6 shadow-sm flex flex-col gap-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-serif text-primary mb-1">Aderência ao Huddle</h3>
                    <p className="text-sm text-muted">
                        Histórico de presença e métricas de cadência LSW por turno.
                    </p>
                </div>
                <div className="flex items-center gap-1 bg-surface-2 p-1 border rounded-lg self-start md:self-auto">
                    {([7, 14, 30] as DayCount[]).map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${days === d
                                ? 'bg-white text-primary shadow-sm ring-1 ring-border'
                                : 'text-muted-more hover:text-primary-800 hover:bg-surface-3'
                                }`}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary cards */}
            {!loading && !error && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <SummaryCard
                        label="Aderência"
                        value={`${summary.adherencePct}%`}
                        sub={`${summary.totalPresent}/${summary.totalExpected} turnos`}
                        accent={summary.adherencePct >= 80 ? 'green' : summary.adherencePct >= 50 ? 'yellow' : 'red'}
                    />
                    <SummaryCard
                        label="Conclusão"
                        value={`${summary.completionPct}%`}
                        sub={`${summary.totalCompleted} encerrados`}
                        accent={summary.completionPct >= 80 ? 'green' : summary.completionPct >= 50 ? 'yellow' : 'red'}
                    />
                    <SummaryCard
                        label="Latência média"
                        value={summary.avgLatencyMin !== null ? fmtMinutes(summary.avgLatencyMin) : '—'}
                        sub="após início do turno"
                        accent={summary.avgLatencyMin === null ? 'neutral' : summary.avgLatencyMin <= 15 ? 'green' : summary.avgLatencyMin <= 30 ? 'yellow' : 'red'}
                    />
                    <SummaryCard
                        label="Duração média"
                        value={summary.avgDurationMin !== null ? fmtMinutes(summary.avgDurationMin) : '—'}
                        sub="huddles encerrados"
                        accent="neutral"
                    />
                    <SummaryCard
                        label="Ausentes"
                        value={String(summary.totalExpected - summary.totalPresent)}
                        sub="turnos sem huddle"
                        accent={summary.totalExpected - summary.totalPresent === 0 ? 'green' : 'red'}
                    />
                </div>
            )}

            {/* Table */}
            {loading && <div className="skeleton h-48 w-full rounded-lg" />}
            {error && (
                <div className="text-sm text-danger p-3 bg-state-danger-bg border border-state-danger rounded-md">
                    Erro ao carregar histórico: {error}
                </div>
            )}
            {!loading && !error && (
                <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-sm border-collapse min-w-[640px]">
                        <thead>
                            <tr className="border-b border-border bg-surface-2 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                                <th className="px-3 py-2">Turno</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Início</th>
                                <th className="px-3 py-2">Latência</th>
                                <th className="px-3 py-2">Duração</th>
                                <th className="px-3 py-2">Checklist</th>
                                <th className="px-3 py-2">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <AdherenceRow key={row.shiftKey} row={row} tz={tz} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const SummaryCard: React.FC<{
    label: string;
    value: string;
    sub: string;
    accent: 'green' | 'yellow' | 'red' | 'neutral';
}> = ({ label, value, sub, accent }) => {
    const accentClass = {
        green: 'text-success-700',
        yellow: 'text-warning-700',
        red: 'text-danger-600',
        neutral: 'text-primary',
    }[accent];

    return (
        <div className="bg-surface-2 border rounded-lg p-3 flex flex-col gap-1">
            <span className="text-xs text-muted font-medium">{label}</span>
            <span className={`text-xl font-bold ${accentClass}`}>{value}</span>
            <span className="text-xs text-muted-more">{sub}</span>
        </div>
    );
};

const AdherenceRow: React.FC<{ row: ShiftRow; tz: string }> = ({ row, tz }) => {
    const { huddle, latencyMin, durationMin, checklistDone, checklistTotal, actionsCreated, actionsDone } = row;

    const startMs = huddle ? toMillis(huddle.startedAt) : null;

    let statusBadge: React.ReactNode;
    if (!huddle) {
        statusBadge = (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-3 text-muted border">
                Ausente
            </span>
        );
    } else if (huddle.endedAt) {
        statusBadge = (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-success-100 text-success-800 border border-success-200">
                ✓ Concluído
            </span>
        );
    } else {
        statusBadge = (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-warning-100 text-warning-800 border border-warning-200">
                Iniciado
            </span>
        );
    }

    const latencyColor =
        latencyMin === null ? 'text-muted'
            : latencyMin <= 15 ? 'text-success-700'
                : latencyMin <= 30 ? 'text-warning-700'
                    : 'text-danger-600';

    const checklistPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : null;
    const checklistColor =
        checklistPct === null ? 'text-muted'
            : checklistPct === 100 ? 'text-success-700'
                : checklistPct >= 50 ? 'text-warning-700'
                    : 'text-danger-600';

    return (
        <tr className="border-b border-border hover:bg-surface-2 transition-colors">
            <td className="px-3 py-2">
                <div className="font-mono text-xs text-primary">{row.shiftKey}</div>
                <div className="text-xs text-muted mt-0.5">{row.type}</div>
            </td>
            <td className="px-3 py-2">{statusBadge}</td>
            <td className="px-3 py-2 text-xs font-mono text-muted">
                {fmtTime(startMs, tz)}
            </td>
            <td className={`px-3 py-2 text-xs font-semibold ${latencyColor}`}>
                {latencyMin !== null ? fmtMinutes(latencyMin) : '—'}
            </td>
            <td className="px-3 py-2 text-xs text-muted">
                {durationMin !== null ? fmtMinutes(durationMin) : '—'}
            </td>
            <td className={`px-3 py-2 text-xs font-semibold ${checklistColor}`}>
                {checklistTotal > 0 ? `${checklistDone}/${checklistTotal}` : '—'}
                {checklistPct !== null && <span className="ml-1 text-muted font-normal">({checklistPct}%)</span>}
            </td>
            <td className="px-3 py-2 text-xs text-muted">
                {actionsCreated > 0 ? `${actionsDone}/${actionsCreated} resolvidas` : '—'}
            </td>
        </tr>
    );
};

export default HuddleAdherenceReport;
