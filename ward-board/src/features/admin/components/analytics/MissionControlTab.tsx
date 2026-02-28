import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { CLOUD_FUNCTIONS } from '../../../../constants/functionNames';
import type { MissionControlSnapshot, KpiStatus } from '../../../../domain/analytics';
import {
    DEFAULT_MISSION_CONTROL_THRESHOLDS,
    blockedStatus,
    kamishibaiImpedimentStatus,
    freshnessStatus,
    unreviewedShiftStatus,
} from '../../../../domain/missionControl';
import type { MissionControlThresholds } from '../../../../domain/missionControl';
import MissionControlCard from './MissionControlCard';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

interface MissionControlTabProps {
    unitId: string;
    refreshTrigger?: number;
}

// ---- Functions instance ----
const functions = getFunctions(undefined, 'southamerica-east1');

// ---- Component ----

const MissionControlTab: React.FC<MissionControlTabProps> = ({ unitId, refreshTrigger }) => {
    const navigate = useNavigate();

    const [snapshot, setSnapshot] = useState<MissionControlSnapshot | null>(null);
    const [loadingSnapshot, setLoadingSnapshot] = useState(true);
    const [errorSnapshot, setErrorSnapshot] = useState<string | null>(null);

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
        } catch {
            setErrorSnapshot('Erro ao carregar situação operacional.');
        } finally {
            setLoadingSnapshot(false);
        }
    }, [unitId]);

    useEffect(() => {
        fetchSnapshot();
    }, [fetchSnapshot, refreshTrigger]);

    const drilldown = (filter: string) => {
        navigate(`/admin/unit/${unitId}/analytics/lists?filter=${filter}`);
    };

    // ── Thresholds: vêm do snapshot (settings/mission_control + defaults) ───────
    const t: MissionControlThresholds = snapshot?.thresholdsUsed ?? DEFAULT_MISSION_CONTROL_THRESHOLDS;

    // ── Universo ─────────────────────────────────────────────────────────────────
    const N = snapshot?.activeBedsCount ?? 0;
    const T = snapshot?.totalBedsCount ?? 0;
    const pctOf = (n: number) => (N > 0 ? Math.round((n / N) * 100 * 10) / 10 : 0);
    const pctOfTotal = (n: number) => (T > 0 ? Math.round((n / T) * 100) : 0);

    // KPI 1 — Bloqueados
    const blocked = snapshot?.blockedBedsCount ?? 0;
    const blockedPct = pctOf(blocked);

    // KPI 4 — Altas
    const discharges = snapshot?.dischargeNext24hCount ?? 0;

    // Freshness — v1: baseada em reviewedAt (não updatedAt)
    const stale12h = snapshot?.staleBedIdsByBucket?.h12?.length ?? 0;
    const stale24h = snapshot?.staleBedIdsByBucket?.h24?.length ?? 0;
    const stale48h = snapshot?.staleBedIdsByBucket?.h48?.length ?? 0;

    // v1: Não revisados neste turno
    const unreviewed = snapshot?.unreviewedBedsCount ?? 0;
    const kamishibaiEnabled = snapshot?.kamishibaiEnabled ?? true;

    // v1: Kamishibai impedimentos
    const kamishibaiPct = pctOf(snapshot?.kamishibaiImpedimentBedsCount ?? 0);

    // Data quality warnings (fallback proxy usado)
    const hasWarnings = (snapshot?.warnings?.length ?? 0) > 0;

    return (
        <div className="mc-tab">
            {/* Data quality notice (v1) */}
            {hasWarnings && !loadingSnapshot && (
                <div
                    className="mc-data-quality-notice"
                    style={{
                        fontSize: '0.7rem',
                        color: 'var(--state-warning)',
                        background: 'var(--state-warning-bg)',
                        border: '1px solid var(--state-warning)',
                        borderRadius: '6px',
                        padding: '0.4rem 0.75rem',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}
                >
                    <span>⚠</span>
                    <span>
                        {snapshot!.warnings!.length} leito(s) sem <code>mainBlockerBlockedAt</code> → aging calculado via <code>updatedAt</code> (proxy).
                        {' '}Preencha o campo para precisão real.
                    </span>
                </div>
            )}

            {/* Linha 0 — Contexto */}
            <div className="mc-kpi-grid mc-kpi-grid--3 mc-context-row" style={{ marginBottom: '1rem' }}>
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
                        <div className="mc-context-card" style={{ cursor: 'pointer' }} onClick={() => drilldown('kamishibai_impediment')}>
                            <span className="mc-context-label">Impedimentos Kamishibai</span>
                            <span className="mc-context-value">{snapshot?.kamishibaiImpedimentBedsCount ?? '—'}</span>
                            <button
                                className="mc-context-link"
                                onClick={(e) => { e.stopPropagation(); drilldown('kamishibai_impediment'); }}
                                type="button"
                            >
                                Ver lista →
                            </button>
                        </div>
                    </>
                )}
            </div>

            <section className="mc-section">
                <h2 className="mc-section-title mc-section-title--no-margin">Estado do Sistema Agora</h2>

                {errorSnapshot ? (
                    <AnalyticsEmptyState type="error" message={errorSnapshot} />
                ) : (
                    <>
                        {/* Linha 1 — Alertas Primários */}
                        <div className="mc-kpi-grid mc-kpi-grid--3">
                            {/* KPI 1 — Bloqueados */}
                            <MissionControlCard
                                id="blocked_now"
                                title="Bloqueados agora"
                                scope="AGORA"
                                value={blocked}
                                percent={blockedPct}
                                denominator={N ? `de ${N} leitos ativos` : undefined}
                                status={blockedStatus(blockedPct, t)}
                                countermeasure="Rodar huddle de bloqueios (10 min) e atacar top 3 causas do dia."
                                drilldown={{ label: 'Ver leitos bloqueados', onClick: () => drilldown('blocked_now') }}
                                contractMetric="Leitos com mainBlocker ≠ vazio"
                                contractUniverse={`N = ${N} leitos ativos`}
                                contractWindow="agora"
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

                            {/* v1: Não revisados neste turno */}
                            {kamishibaiEnabled && (
                                <MissionControlCard
                                    id="unreviewed_shift"
                                    title="Não revisados neste turno"
                                    scope="AGORA"
                                    value={unreviewed}
                                    percent={pctOf(unreviewed)}
                                    denominator={N ? `de ${N} leitos ativos` : undefined}
                                    status={unreviewedShiftStatus(unreviewed, t)}
                                    countermeasure="Cobrar revisão Kamishibai antes do fim do turno."
                                    drilldown={{ label: 'Ver leitos não revisados', onClick: () => drilldown('unreviewed_shift') }}
                                    contractMetric="Leitos com ≥1 domínio aplicável UNREVIEWED_THIS_SHIFT"
                                    contractUniverse={`N = ${N} leitos ativos`}
                                    contractWindow="turno atual"
                                    loading={loadingSnapshot}
                                />
                            )}
                        </div>

                        {/* Linha 2 — Freshness (v1: reviewedAt, não updatedAt) */}
                        <h3 className="mc-subsection-title">
                            Rastreio de Atualizações
                            <span
                                style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--color-muted)', marginLeft: '0.5rem', verticalAlign: 'middle' }}
                                title="v1: baseado em última revisão Kamishibai por domínio (não em updatedAt do leito)"
                            >
                                v1 ✓
                            </span>
                        </h3>
                        <div className="mc-kpi-grid mc-kpi-grid--3 mc-freshness-row">
                            <MissionControlCard
                                id="stale_48h"
                                title="Sem revisão +48h"
                                scope="AGORA"
                                value={stale48h}
                                percent={pctOf(stale48h)}
                                denominator={N ? `de ${N} leitos ativos` : undefined}
                                status={freshnessStatus(stale48h, '48h', t)}
                                countermeasure="Falha de processo. Acionar coordenação imediatamente."
                                drilldown={{ label: 'Ver leitos +48h', onClick: () => drilldown('stale48h') }}
                                contractMetric="Leitos cuja última revisão Kamishibai foi >48h"
                                contractUniverse={`N = ${N} leitos`}
                                contractWindow="agora"
                                loading={loadingSnapshot}
                            />
                            <MissionControlCard
                                id="stale_24h"
                                title="Sem revisão +24h"
                                scope="AGORA"
                                value={stale24h}
                                percent={pctOf(stale24h)}
                                denominator={N ? `de ${N} leitos ativos` : undefined}
                                status={freshnessStatus(stale24h, '24h', t)}
                                countermeasure="Cobrar atualização antes do fim do turno."
                                drilldown={{ label: 'Ver leitos +24h', onClick: () => drilldown('stale24h') }}
                                contractMetric="Leitos cuja última revisão Kamishibai foi >24h"
                                contractUniverse={`N = ${N} leitos`}
                                contractWindow="agora"
                                loading={loadingSnapshot}
                            />
                            <MissionControlCard
                                id="stale_12h"
                                title="Sem revisão +12h"
                                scope="AGORA"
                                value={stale12h}
                                percent={pctOf(stale12h)}
                                denominator={N ? `de ${N} leitos ativos` : undefined}
                                status={freshnessStatus(stale12h, '12h', t)}
                                countermeasure="Verificar se há equipe sem acesso ao sistema."
                                drilldown={{ label: 'Ver leitos +12h', onClick: () => drilldown('stale12h') }}
                                contractMetric="Leitos cuja última revisão Kamishibai foi >12h"
                                contractUniverse={`N = ${N} leitos`}
                                contractWindow="agora"
                                loading={loadingSnapshot}
                            />
                        </div>

                        {/* Kamishibai pct (inline info, não ocupa card) */}
                        {kamishibaiEnabled && snapshot && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
                                Kamishibai impedimentos:{' '}
                                <strong style={{ color: kamishibaiImpedimentStatus(kamishibaiPct, t) === 'ok' ? 'var(--state-success)' : kamishibaiImpedimentStatus(kamishibaiPct, t) === 'critical' ? 'var(--state-danger)' : 'var(--state-warning)' }}>
                                    {snapshot.kamishibaiImpedimentBedsCount} leitos ({kamishibaiPct}%)
                                </strong>
                                {' '}— Thresholds: {t.kamishibaiImpedimentPctWarning}% warning, {t.kamishibaiImpedimentPctCritical}% critical
                            </div>
                        )}

                        {/* Pendências v1 */}
                        <div className="mc-cards-row" style={{ marginTop: '1.5rem' }}>
                            <MissionControlCard
                                id="pendencies_open"
                                title="Pendências abertas"
                                scope="AGORA"
                                value={snapshot?.openPendenciesCount ?? 0}
                                denominator={snapshot?.bedsWithOpenPendenciesCount !== undefined
                                    ? `em ${snapshot.bedsWithOpenPendenciesCount} leito${snapshot.bedsWithOpenPendenciesCount !== 1 ? 's' : ''}`
                                    : undefined}
                                status={(snapshot?.openPendenciesCount ?? 0) === 0 ? 'ok' : 'warning'}
                                countermeasure="Verificar responsáveis e prazos com equipe no próximo huddle."
                                drilldown={{ label: 'Ver leitos com pendências', onClick: () => drilldown('pendencies_open') }}
                                contractMetric="Total de pendências operacionais abertas (status=open)"
                                contractUniverse={`N = ${snapshot?.activeBedsCount ?? 0} leitos ativos`}
                                contractWindow="turno atual"
                                loading={loadingSnapshot}
                            />
                            <MissionControlCard
                                id="pendencies_overdue"
                                title="Pendências vencidas"
                                scope="AGORA"
                                value={snapshot?.overduePendenciesCount ?? 0}
                                status={(snapshot?.overduePendenciesCount ?? 0) === 0 ? 'ok' : 'critical'}
                                countermeasure="Escalar ou redesignar responsável imediatamente."
                                drilldown={{ label: 'Ver leitos com vencidas', onClick: () => drilldown('pendencies_overdue') }}
                                contractMetric="Pendências com dueAt passado e status=open"
                                contractUniverse={`N = ${snapshot?.openPendenciesCount ?? 0} pendências abertas`}
                                contractWindow="turno atual"
                                loading={loadingSnapshot}
                            />
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
// Tiny helper: retornamos o tipo KpiStatus para uso externo se necessário
export type { KpiStatus };
export default MissionControlTab;
