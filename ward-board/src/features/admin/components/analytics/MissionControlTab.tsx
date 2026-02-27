import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { CLOUD_FUNCTIONS } from '../../../../constants/functionNames';
import type { MissionControlSnapshot, MissionControlPeriod, KpiStatus } from '../../../../domain/analytics';
import MissionControlCard from './MissionControlCard';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

interface MissionControlTabProps {
    unitId: string;
}

// ---- Status computation helpers ----

function blockedStatus(pct: number): KpiStatus {
    if (pct > 35) return 'critical';
    if (pct > 20) return 'warning';
    return 'ok';
}

function staleStatus(count: number): KpiStatus {
    if (count >= 3) return 'critical';
    if (count >= 1) return 'warning';
    return 'ok';
}

function kamishibaiStatus(pct: number): KpiStatus {
    if (pct > 30) return 'critical';
    if (pct > 15) return 'warning';
    return 'ok';
}

function agingStatus(hours: number): KpiStatus {
    if (hours > 48) return 'critical';
    if (hours >= 24) return 'warning';
    return 'ok';
}

function topBlockerStatus(share: number): KpiStatus {
    if (share > 45) return 'critical';
    if (share >= 35) return 'warning';
    return 'ok';
}

function throughputStatus(delta: number | null): KpiStatus {
    if (delta === null) return 'ok';
    if (delta <= -25) return 'critical';
    if (delta <= -10) return 'warning';
    return 'ok';
}

// ---- Functions instance ----
const functions = getFunctions(undefined, 'southamerica-east1');

// ---- Component ----

const MissionControlTab: React.FC<MissionControlTabProps> = ({ unitId }) => {
    const navigate = useNavigate();

    const [snapshot, setSnapshot] = useState<MissionControlSnapshot | null>(null);
    const [period, setPeriod] = useState<MissionControlPeriod | null>(null);
    const [loadingSnapshot, setLoadingSnapshot] = useState(true);
    const [loadingPeriod, setLoadingPeriod] = useState(true);
    const [errorSnapshot, setErrorSnapshot] = useState<string | null>(null);
    const [errorPeriod, setErrorPeriod] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchSnapshot = useCallback(async () => {
        setLoadingSnapshot(true);
        setErrorSnapshot(null);
        try {
            const fn = httpsCallable<{ unitId: string }, MissionControlSnapshot>(
                functions,
                CLOUD_FUNCTIONS.GET_ADMIN_MISSION_CONTROL_SNAPSHOT
            );
            const res = await fn({ unitId });
            setSnapshot(res.data);
            setLastUpdated(new Date());
        } catch {
            setErrorSnapshot('Erro ao carregar situação operacional.');
        } finally {
            setLoadingSnapshot(false);
        }
    }, [unitId]);

    const fetchPeriod = useCallback(async () => {
        setLoadingPeriod(true);
        setErrorPeriod(null);
        try {
            const fn = httpsCallable<{ unitId: string; range: string }, MissionControlPeriod>(
                functions,
                CLOUD_FUNCTIONS.GET_ADMIN_MISSION_CONTROL_PERIOD
            );
            const res = await fn({ unitId, range: '7d' });
            setPeriod(res.data);
        } catch {
            setErrorPeriod('Erro ao carregar dados de tendência.');
        } finally {
            setLoadingPeriod(false);
        }
    }, [unitId]);

    useEffect(() => {
        fetchSnapshot();
        fetchPeriod();
    }, [fetchSnapshot, fetchPeriod]);

    const drilldown = (filter: string) => {
        navigate(`/admin/unit/${unitId}/analytics/lists?filter=${filter}`);
    };

    const N = snapshot?.activeBedsCount ?? 0;
    const T = snapshot?.totalBedsCount ?? 0;
    const pctOf = (n: number) => (N > 0 ? Math.round((n / N) * 100 * 10) / 10 : 0);
    const pctOfTotal = (n: number) => (T > 0 ? Math.round((n / T) * 100) : 0);

    // KPI 1
    const blocked = snapshot?.blockedBedsCount ?? 0;
    const blockedPct = pctOf(blocked);

    // KPI 2
    const stale = snapshot?.stale24hBedsCount ?? 0;
    const stalePct = pctOf(stale);

    // KPI 3
    const kamPending = snapshot?.kamishibaiPendingBedsCount ?? 0;
    const kamPct = pctOf(kamPending);

    // KPI 4
    const discharges = snapshot?.dischargeNext24hCount ?? 0;

    // KPI 5 throughput
    const totalDis = period?.totalDischarges ?? 0;
    const avgDis = period?.avgDischargesPerDay ?? 0;
    const tpDelta = period?.throughputDelta ?? null;

    // KPI 6 aging
    const maxAging = snapshot?.maxBlockedAgingHours ?? 0;

    // KPI 7 top blocker
    const topBlocker = snapshot?.topBlockerNow;

    return (
        <div className="mc-tab">
            {/* Refresh bar */}
            <div className="mc-toolbar">
                <span className="mc-last-updated">
                    {lastUpdated ? `Atualizado: ${lastUpdated.toLocaleTimeString('pt-BR')}` : 'Carregando...'}
                </span>
                <button
                    className="btn btn-outline mc-refresh-btn"
                    onClick={() => { fetchSnapshot(); fetchPeriod(); }}
                    type="button"
                >
                    ↻ Atualizar
                </button>
            </div>

            {/* ===== SEÇÃO 1: AGORA ===== */}
            <section className="mc-section">
                <h2 className="mc-section-title">AGORA — Situação Operacional</h2>

                {errorSnapshot ? (
                    <AnalyticsEmptyState type="error" message={errorSnapshot} />
                ) : (
                    <>
                        {/* Linha 1 — Alertas */}
                        <div className="mc-kpi-grid mc-kpi-grid--4">
                            {/* KPI 1 — Bloqueados */}
                            <MissionControlCard
                                id="blocked_now"
                                title="Bloqueados agora"
                                scope="AGORA"
                                value={blocked}
                                percent={blockedPct}
                                denominator={N ? `de ${N} leitos ativos` : undefined}
                                status={blockedStatus(blockedPct)}
                                countermeasure="Rodar huddle de bloqueios (10 min) e atacar top 3 causas do dia."
                                drilldown={{ label: 'Ver leitos bloqueados', onClick: () => drilldown('blocked_now') }}
                                contractMetric="Leitos com mainBlocker ≠ vazio"
                                contractUniverse={`N = ${N} leitos ativos`}
                                contractWindow="agora"
                                loading={loadingSnapshot}
                            />

                            {/* KPI 2 — Sem atualização >24h */}
                            <MissionControlCard
                                id="stale_24h"
                                title="Sem atualização >24h"
                                scope="AGORA"
                                value={stale}
                                percent={stalePct}
                                denominator={N ? `de ${N} leitos ativos` : undefined}
                                status={staleStatus(stale)}
                                countermeasure="Cobrar atualização antes do fim do turno; priorizar >48h."
                                drilldown={{ label: 'Ver leitos sem atualização', onClick: () => drilldown('stale_24h') }}
                                contractMetric="Leitos com updatedAt > 24h atrás"
                                contractUniverse={`N = ${N} leitos (ocupados + vazios)`}
                                contractWindow="agora"
                                loading={loadingSnapshot}
                            />

                            {/* KPI 3 — Pendências Kamishibai (Modo A) */}
                            <MissionControlCard
                                id="kamishibai_pending"
                                title="Pendências Kamishibai"
                                scope="AGORA"
                                value={kamPending}
                                percent={kamPct}
                                denominator={N ? `de ${N} leitos ativos` : undefined}
                                status={kamishibaiStatus(kamPct)}
                                countermeasure="Varredura por domínio e resolver pendências rápidas antes do almoço."
                                drilldown={{ label: 'Ver pendências', onClick: () => drilldown('kamishibai_pending') }}
                                contractMetric="Leitos com ≥1 entrada kamishibai = pending"
                                contractUniverse={`N = ${N} leitos ativos (Modo A)`}
                                contractWindow="agora"
                                contractRule="Modo A: pelo menos 1 domínio pendente por leito"
                                loading={loadingSnapshot}
                            />

                            {/* KPI 4 — Altas próximas 24h */}
                            <MissionControlCard
                                id="discharge_next_24h"
                                title="Altas próximas 24h"
                                scope="AGORA"
                                value={discharges}
                                denominator={N ? `de ${N} leitos ativos` : undefined}
                                status="ok"
                                countermeasure="Revisar barreiras de alta nos top 5 leitos; alinhar pendências multiprofissionais."
                                drilldown={{ label: 'Ver leitos com alta esperada', onClick: () => drilldown('discharge_next_24h') }}
                                contractMetric="Leitos com expectedDischarge = '24h'"
                                contractUniverse={`N = ${N} leitos ativos`}
                                contractWindow="agora"
                                loading={loadingSnapshot}
                            />
                        </div>

                        {/* Linha 2 — Contexto */}
                        <div className="mc-kpi-grid mc-kpi-grid--3 mc-context-row">
                            {loadingSnapshot ? (
                                <>
                                    <div className="mc-skeleton mc-skeleton-small" />
                                    <div className="mc-skeleton mc-skeleton-small" />
                                    <div className="mc-skeleton mc-skeleton-small" />
                                </>
                            ) : (
                                <>
                                    <div className="mc-context-card">
                                        <span className="mc-context-label">Leitos ocupados</span>
                                        <span className="mc-context-value">{snapshot?.activeBedsCount ?? '—'}</span>
                                        <span className="mc-context-sub">
                                            {snapshot ? `${pctOfTotal(snapshot.activeBedsCount)}% do total (${snapshot.totalBedsCount})` : ''}
                                        </span>
                                    </div>
                                    <div className="mc-context-card">
                                        <span className="mc-context-label">Leitos vagos</span>
                                        <span className="mc-context-value">
                                            {snapshot ? snapshot.totalBedsCount - snapshot.activeBedsCount : '—'}
                                        </span>
                                        <span className="mc-context-sub">
                                            {snapshot ? `${pctOfTotal(snapshot.totalBedsCount - snapshot.activeBedsCount)}% do total` : ''}
                                        </span>
                                    </div>
                                    <div className="mc-context-card">
                                        <span className="mc-context-label">Impedimentos Kamishibai</span>
                                        <span className="mc-context-value">{snapshot?.kamishibaiImpedimentBedsCount ?? '—'}</span>
                                        <button
                                            className="mc-context-link"
                                            onClick={() => drilldown('kamishibai_impediment')}
                                            type="button"
                                        >
                                            Ver lista →
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </section>

            {/* ===== SEÇÃO 2: PERÍODO ===== */}
            <section className="mc-section">
                <h2 className="mc-section-title">PERÍODO — Tendência mínima (últimos 7 dias)</h2>

                {errorPeriod ? (
                    <AnalyticsEmptyState type="error" message={errorPeriod} />
                ) : (
                    <div className="mc-kpi-grid mc-kpi-grid--3">
                        {/* KPI 5 — Throughput */}
                        <MissionControlCard
                            id="throughput_7d"
                            title="Altas (Throughput)"
                            scope="PERÍODO"
                            value={totalDis}
                            unit="altas"
                            denominator={`Média: ${avgDis}/dia nos últimos 7d`}
                            status={throughputStatus(tpDelta)}
                            comparison={
                                tpDelta !== null
                                    ? {
                                        label: 'vs semana anterior',
                                        value: `${tpDelta >= 0 ? '+' : ''}${tpDelta}%`,
                                        delta: tpDelta,
                                    }
                                    : undefined
                            }
                            countermeasure="Se throughput caiu: checar Bloqueados e Pendências; atacar gargalo principal."
                            contractMetric="Eventos RESET_BED_KANBAN + RESET_BED_ALL em audit_logs"
                            contractUniverse="N = todos os resets no período"
                            contractWindow="periodo"
                            loading={loadingPeriod}
                        />

                        {/* KPI 6 — Aging de bloqueio */}
                        <MissionControlCard
                            id="blocking_aging"
                            title="Aging de bloqueio (máx)"
                            scope="AGORA"
                            value={maxAging > 0 ? `${maxAging}h` : '—'}
                            denominator={`Entre ${snapshot?.blockedBedsCount ?? 0} leitos bloqueados`}
                            status={agingStatus(maxAging)}
                            comparison={{
                                label: 'Meta',
                                value: '< 24h',
                            }}
                            countermeasure="Escalonar bloqueios >48h com responsável e prazo."
                            drilldown={{ label: 'Ver bloqueios por aging', onClick: () => drilldown('blocking_aging') }}
                            contractMetric="Máximo de (now − updatedAt) entre leitos bloqueados"
                            contractUniverse="N = leitos com mainBlocker ≠ vazio (AGORA)"
                            contractWindow="agora"
                            loading={loadingSnapshot}
                        />

                        {/* KPI 7 — Top bloqueador */}
                        <MissionControlCard
                            id="top_blocker_pareto"
                            title="Top bloqueador (Pareto)"
                            scope="AGORA"
                            value={topBlocker?.name ?? '—'}
                            unit={topBlocker ? `${topBlocker.bedCount} leito${topBlocker.bedCount !== 1 ? 's' : ''}` : undefined}
                            percent={topBlocker?.share}
                            denominator={topBlocker ? `de ${snapshot?.blockedBedsCount ?? 0} leitos bloqueados` : undefined}
                            status={topBlocker ? topBlockerStatus(topBlocker.share) : 'ok'}
                            countermeasure="Se 1 causa domina: abrir playbook do motivo e atacar raiz."
                            drilldown={topBlocker ? { label: 'Ver leitos com este bloqueio', onClick: () => drilldown('top_blocker') } : undefined}
                            contractMetric="Motivo mais frequente em mainBlocker (snapshot)"
                            contractUniverse="N = leitos com mainBlocker ≠ vazio (AGORA)"
                            contractWindow="agora"
                            loading={loadingSnapshot}
                        />
                    </div>
                )}
            </section>
        </div>
    );
};

export default MissionControlTab;
