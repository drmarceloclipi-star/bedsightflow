import React, { useMemo } from 'react';
import type { Bed, SpecialtyKey } from '../../../domain/types';
import { DischargeEstimateLabel, SpecialtyLabel } from '../../../domain/types';
import { getShortSpecialty, getVisibleSpecialties } from '../../../domain/specialtyUtils';
import { computePendencyCounts, formatPendencyBadge } from '../../../domain/pendencies';

interface KanbanScreenProps {
    beds: Bed[];
    columns?: number;
    /** Referência de tempo para calcular overdue — injetado pelo TvDashboard (state 'now') */
    now?: Date;
    /**
     * P1-03: modo kanban da unidade.
     * PASSIVE      → exibe todos os leitos (gestão à vista completa, incluindo vagos).
     * ACTIVE_LITE  → exibe apenas leitos com paciente (patientAlias preenchido),
     *                focando na carga ativa sem ruído de leitos vazios.
     */
    kanbanMode?: 'PASSIVE' | 'ACTIVE_LITE';
}

const getDischargeColorClass = (estimate: string) => {
    switch (estimate) {
        case '24h': return 'state-success-bg';
        case '2-3_days': return 'state-warning-bg';
        case '>3_days': return 'state-danger-bg';
        default: return 'kanban-badge-indefinida';
    }
};

/**
 * Badge de pendências por leito.
 * Memoizado individualmente para evitar re-render a cada tick do timer de progresso.
 *
 * Performance: useMemo(computePendencyCounts) depende de [bed, now].
 * 'now' é um state atualizado a cada 30s no TvDashboard — re-render controlado.
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

const KanbanScreen: React.FC<KanbanScreenProps> = ({ beds, columns = 1, now = new Date(), kanbanMode = 'PASSIVE' }) => {
    // P1-03: ACTIVE_LITE mostra apenas leitos com paciente; PASSIVE mostra todos
    const visibleBeds = kanbanMode === 'ACTIVE_LITE'
        ? beds.filter(b => b.patientAlias && b.patientAlias.trim().length > 0)
        : beds;

    const sortedBeds = [...visibleBeds].sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' })
    );

    const renderTable = (bedsList: Bed[]) => (
        <table className="kanban-compact-table">
            <thead>
                <tr>
                    <th style={{ width: '10%' }}>Leito</th>
                    <th style={{ width: '16%' }}>Paciente</th>
                    <th style={{ width: '18%' }}>Especialidades</th>
                    <th style={{ width: '18%' }}>Previsão Alta</th>
                    <th style={{ width: '34%' }}>Bloqueador Principal</th>
                    <th style={{ width: '4%' }} aria-label="Pendências"></th>
                </tr>
            </thead>
            <tbody>
                {bedsList.map((bed) => {
                    const visibleSpecialties = getVisibleSpecialties(
                        (bed.involvedSpecialties || []) as SpecialtyKey[]
                    );

                    return (
                        <tr key={bed.id}>
                            <td>
                                <span className="kanban-bed-num">{bed.number}</span>
                            </td>
                            <td>
                                <span className="kanban-patient">{bed.patientAlias || '—'}</span>
                            </td>
                            <td>
                                <div className="kanban-chips">
                                    {visibleSpecialties.length > 0
                                        ? visibleSpecialties.map(s => (
                                            <span
                                                key={s}
                                                className="specialty-chip-mini"
                                                title={SpecialtyLabel[s as SpecialtyKey]}
                                            >
                                                {getShortSpecialty(s as SpecialtyKey)}
                                            </span>
                                        ))
                                        : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                                    }
                                </div>
                            </td>
                            <td>
                                <span className={`kanban-badge ${getDischargeColorClass(bed.expectedDischarge)}`}>
                                    {DischargeEstimateLabel[bed.expectedDischarge]}
                                </span>
                            </td>
                            <td>
                                <span className="kanban-blocker" title={bed.mainBlocker}>
                                    {bed.mainBlocker || <span style={{ opacity: 0.3 }}>Nenhum</span>}
                                </span>
                            </td>
                            <td className="kanban-pendency-cell">
                                <PendencyBadge bed={bed} now={now} />
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );

    const showDualColumns = columns > 1 && sortedBeds.length > 0;
    const midPoint = showDualColumns ? Math.ceil(sortedBeds.length / 2) : sortedBeds.length;

    const leftBeds = showDualColumns ? sortedBeds.slice(0, midPoint) : sortedBeds;
    const rightBeds = showDualColumns ? sortedBeds.slice(midPoint) : [];

    return (
        <div className="animate-slideIn h-full flex flex-col" style={{ padding: '0.5rem 1.25rem 1rem' }}>
            <h2 className="kanban-title">
                Quadro Kanban — Fluxo de Alta
                {/* P1-03: badge de modo apenas no ACTIVE_LITE para sinalizar filtragem */}
                {kanbanMode === 'ACTIVE_LITE' && (
                    <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', fontWeight: 700, opacity: 0.5, marginLeft: '0.75rem', verticalAlign: 'middle', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        ACTIVE_LITE · {visibleBeds.length} leito{visibleBeds.length !== 1 ? 's' : ''}
                    </span>
                )}
            </h2>

            <div className="kanban-table-wrapper" style={{ display: 'grid', gridTemplateColumns: showDualColumns ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr', gap: '2rem' }}>
                <div className="kanban-table-inner-wrapper">
                    {renderTable(leftBeds)}
                </div>
                {showDualColumns && (
                    <div className="kanban-table-inner-wrapper">
                        {renderTable(rightBeds)}
                    </div>
                )}
            </div>

            <style>{`
                .kanban-title {
                    font-size: 1.4rem;
                    font-family: var(--font-serif);
                    color: var(--text-secondary);
                    margin-bottom: 0.75rem;
                    flex-shrink: 0;
                }

                .kanban-table-wrapper {
                    flex: 1;
                    overflow: auto;
                    min-height: 0;
                }

                .kanban-table-inner-wrapper {
                    min-width: 0;
                    overflow: auto;
                }

                .kanban-compact-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }

                .kanban-compact-table thead th {
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

                .kanban-compact-table tbody td {
                    padding: 0.35rem 0.6rem;
                    border-bottom: 1px solid var(--border-soft);
                    vertical-align: middle;
                    overflow: hidden;
                }

                .kanban-compact-table tbody tr:last-child td {
                    border-bottom: none;
                }

                .kanban-compact-table tbody tr:hover td {
                    background-color: var(--bg-surface-2);
                }

                .kanban-bed-num {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    white-space: nowrap;
                }

                .kanban-patient {
                    font-size: 0.95rem;
                    font-weight: 500;
                    color: var(--text-primary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .kanban-badge {
                    display: inline-block;
                    font-size: 0.7rem;
                    font-weight: 600;
                    padding: 0.15rem 0.5rem;
                    border-radius: 99px;
                    border: 1px solid currentColor;
                    white-space: nowrap;
                }

                .kanban-badge-indefinida {
                    color: var(--text-muted);
                    border-color: var(--border-soft);
                    border-style: dashed;
                }

                .kanban-blocker {
                    font-size: 0.82rem;
                    color: var(--text-secondary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: block;
                }

                .kanban-chips {
                    display: flex;
                    flex-wrap: nowrap;
                    gap: 0.2rem;
                    overflow: hidden;
                }

                .kanban-pendency-cell {
                    text-align: right;
                    white-space: nowrap;
                    min-width: 48px;
                }
            `}</style>
        </div>
    );
};

export default KanbanScreen;
