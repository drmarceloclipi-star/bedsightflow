import React, { useMemo } from 'react';
import type { Bed, UnitOpsSettings } from '../../../domain/types';
import { getKamishibaiLabel, KAMISHIBAI_DOMAINS } from '../../../domain/specialtyUtils';
import {
    resolveKamishibaiVisualState,
    visualStateToCssClass,
    type ResolveKamishibaiOpts,
} from '../../../domain/kamishibaiVisualState';
import { currentShiftKey } from '../../../domain/shiftKey';
import { DEFAULT_SHIFT_SCHEDULE } from '../../../domain/shiftKey';
import { computePendencyCounts, formatPendencyBadge } from '../../../domain/pendencies';

interface KamishibaiScreenProps {
    beds: Bed[];
    columns?: number;
    /** Configuração operacional da unidade (v1). Ausente → defaults v0. */
    opsSettings?: UnitOpsSettings | null;
    /** Referência de tempo para overdue — injetado pelo TvDashboard (state 'now') */
    now?: Date;
}

/**
 * Badge de pendências por leito no Kamishibai.
 * Posicionado na célula do leito (número) para não poluir as colunas de domínio.
 * Performance: memoizado individualmente — recalcula apenas quando bed ou now mudam.
 */
const PendencyBadge: React.FC<{ bed: Bed; now: Date }> = React.memo(({ bed, now }) => {
    const counts = useMemo(() => computePendencyCounts(bed, now), [bed, now]);
    const label = formatPendencyBadge(counts);
    if (!label) return null;

    return (
        <span
            className={`tv-badge tv-badge--pendencies${counts.overdue > 0 ? ' tv-badge--overdue' : ''}`}
            data-pendencies-open={counts.open}
            data-pendencies-overdue={counts.overdue}
            aria-label={
                counts.overdue > 0
                    ? `Pendências abertas: ${counts.open}. Pendências vencidas: ${counts.overdue}`
                    : `Pendências abertas: ${counts.open}`
            }
            title={`${counts.open} pendência(s) aberta(s)${counts.overdue > 0 ? `, ${counts.overdue} vencida(s)` : ''}`}
        >
            {label}
        </span>
    );
});
PendencyBadge.displayName = 'PendencyBadge';

const KamishibaiScreen: React.FC<KamishibaiScreenProps> = ({ beds, columns = 1, opsSettings, now = new Date() }) => {

    /**
     * Calcular currentShiftKey UMA VEZ por render para todo o quadro.
     * Recalcula quando opsSettings.huddleSchedule muda (ex: nova leitura do Firestore).
     */
    const resolvedCurrentShiftKey = useMemo(() => {
        const schedule = opsSettings?.huddleSchedule ?? DEFAULT_SHIFT_SCHEDULE;
        return currentShiftKey(schedule);
    }, [opsSettings?.huddleSchedule]);

    const kamishibaiEnabled = opsSettings?.kamishibaiEnabled ?? true;

    /** Opts v1 compartilhados para todos os dots da tela. */
    const resolveOpts: ResolveKamishibaiOpts = {
        kamishibaiEnabled,
        resolvedCurrentShiftKey,
        schedule: opsSettings?.huddleSchedule ?? DEFAULT_SHIFT_SCHEDULE,
    };

    const renderTable = (bedsList: Bed[]) => (
        <table className="kamishibai-compact-table bg-surface-1 rounded-lg shadow-sm">
            <thead>
                <tr>
                    <th style={{ width: '80px' }}>Leito</th>
                    {KAMISHIBAI_DOMAINS.map(s => (
                        <th key={s} className="text-center">{getKamishibaiLabel(s)}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {bedsList.map((bed) => (
                    <tr key={bed.id}>
                        <td>
                            <span className="kamishibai-bed-num">{bed.number}</span>
                            {/* Badge de pendências na coluna do leito — ação aberta, não domínio */}
                            <PendencyBadge bed={bed} now={now} />
                        </td>
                        {KAMISHIBAI_DOMAINS.map(s => {
                            const state = resolveKamishibaiVisualState(bed, s, resolveOpts);
                            const dotClass = visualStateToCssClass(state);
                            const showDot = state === 'OK' || state === 'BLOCKED' || state === 'NOT_APPLICABLE';
                            // data-state diferencia INACTIVE de UNREVIEWED_THIS_SHIFT no DOM:
                            // permite telemetria futura sem alterar visual
                            const dataState = state === 'UNREVIEWED_THIS_SHIFT' ? 'unreviewed' : state.toLowerCase();
                            return (
                                <td key={s} className="text-center" data-state={dataState} data-domain={s}>
                                    {showDot ? (
                                        <div
                                            className={`kamishibai-dot ${dotClass}`}
                                            role="img"
                                            aria-label={
                                                state === 'OK' ? 'OK — revisado neste turno' :
                                                    state === 'BLOCKED' ? 'Impedido' :
                                                        'Não aplicável'
                                            }
                                        />
                                    ) : (
                                        <div
                                            className="kamishibai-dot kamishibai-empty"
                                            role="img"
                                            aria-label={
                                                state === 'INACTIVE'
                                                    ? 'Leito vazio ou Kamishibai inativo'
                                                    : 'Não revisado neste turno'
                                            }
                                        />
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const showDualColumns = columns > 1 && beds.length > 0;
    const midPoint = showDualColumns ? Math.ceil(beds.length / 2) : beds.length;

    const leftBeds = showDualColumns ? beds.slice(0, midPoint) : beds;
    const rightBeds = showDualColumns ? beds.slice(midPoint) : [];

    return (
        <div className="kamishibai-container animate-slideIn h-full flex flex-col">
            <div className="kamishibai-header flex justify-between items-end p-6 pb-0 flex-shrink-0">
                <h2 className="kamishibai-title text-3xl font-serif">Quadro Kamishibai — Pendências por Domínio / Equipe</h2>
                <div className="kamishibai-legend flex gap-4 text-xs font-bold uppercase tracking-widest text-secondary">
                    <div className="flex items-center gap-2">
                        <div className="kamishibai-dot kamishibai-dot--ok" style={{ width: '16px', height: '16px', margin: 0 }} />
                        <span>OK / Concluído</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="kamishibai-dot kamishibai-dot--blocked" style={{ width: '16px', height: '16px', margin: 0 }} />
                        <span>Impedido</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Placeholder visual para NOT_APPLICABLE na legenda */}
                        <div className="kamishibai-dot kamishibai-placeholder--na" style={{ width: '16px', height: '16px', margin: 0 }} />
                        <span>N/A</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Célula vazia = sem cor (não revisado no turno) */}
                        <div className="kamishibai-dot kamishibai-empty" style={{ width: '16px', height: '16px', margin: 0, border: '1px solid var(--border-soft)' }} />
                        <span>Sem cor (não revisado)</span>
                    </div>
                </div>
            </div>
            <div className="kamishibai-main p-4 pt-1 flex-1 overflow-hidden">
                <div className="kamishibai-grid" style={{ display: 'grid', gridTemplateColumns: showDualColumns ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr', gap: '2rem', height: '100%' }}>
                    <div className="kamishibai-table-wrapper">
                        {renderTable(leftBeds)}
                    </div>
                    {showDualColumns && (
                        <div className="kamishibai-table-wrapper">
                            {renderTable(rightBeds)}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .kamishibai-container {
                    /* anterior: zoom: 0.8 — não semântico e quebra em Firefox/Safari */
                    /* solução: reduzir font-size do container; filhos com 'em' herdam */
                    font-size: 80%;
                }

                .kamishibai-table-wrapper {
                    min-width: 0;
                    overflow: auto;
                }

                .kamishibai-compact-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }

                .kamishibai-compact-table thead th {
                    text-align: left;
                    font-size: 0.65rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--text-muted);
                    padding: 0.4rem 0.6rem;
                    border-bottom: 2px solid var(--border-soft);
                    white-space: nowrap;
                }

                .kamishibai-compact-table thead th.text-center {
                    text-align: center;
                }

                .kamishibai-compact-table tbody td {
                    padding: 0.35rem 0.6rem;
                    border-bottom: 1px solid var(--border-soft);
                    vertical-align: middle;
                    overflow: hidden;
                }

                .kamishibai-compact-table tbody tr:last-child td {
                    border-bottom: none;
                }

                .kamishibai-compact-table tbody tr:hover td {
                    background-color: var(--bg-surface-2);
                }

                .kamishibai-bed-num {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    white-space: nowrap;
                    margin-right: 0.3rem;
                }
            `}</style>
        </div>
    );
};

export default KamishibaiScreen;
