import React from 'react';
import type { Bed, SpecialtyKey } from '../../../domain/types';
import { DischargeEstimateLabel, SpecialtyLabel } from '../../../domain/types';
import { getShortSpecialty, getVisibleSpecialties } from '../../../domain/specialtyUtils';

interface KanbanScreenProps {
    beds: Bed[];
    columns?: number;
}

const getDischargeColorClass = (estimate: string) => {
    switch (estimate) {
        case '24h': return 'state-success-bg';
        case '2-3_days': return 'state-warning-bg';
        case '>3_days': return 'state-danger-bg';
        default: return 'kanban-badge-indefinida';
    }
};

const KanbanScreen: React.FC<KanbanScreenProps> = ({ beds, columns = 1 }) => {
    const sortedBeds = [...beds].sort((a, b) =>
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
                    <th style={{ width: '38%' }}>Bloqueador Principal</th>
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
            `}</style>
        </div>
    );
};

export default KanbanScreen;
