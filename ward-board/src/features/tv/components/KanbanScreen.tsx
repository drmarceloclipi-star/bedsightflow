import React from 'react';
import type { Bed, SpecialtyKey } from '../../../domain/types';
import { DischargeEstimateLabel, SpecialtyLabel } from '../../../domain/types';
import { getShortSpecialty, getVisibleSpecialties } from '../../../domain/specialtyUtils';

interface KanbanScreenProps {
    beds: Bed[];
}

const KanbanScreen: React.FC<KanbanScreenProps> = ({ beds }) => {
    // Ordenar leitos conforme a lógica do hospital (numérica/leito)
    const sortedBeds = [...beds].sort((a, b) => {
        return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
    });

    const getDischargeColorClass = (estimate: string) => {
        switch (estimate) {
            case '24h': return 'state-success-bg';
            case '2-3_days': return 'state-warning-bg';
            case '>3_days': return 'state-danger-bg';
            default: return '';
        }
    };

    return (
        <div className="animate-slideIn h-full flex flex-col p-4">
            <h2 className="text-3xl font-serif mb-6 flex justify-between items-center">
                <span>Quadro Kanban — Fluxo de Alta</span>
                <span className="text-sm font-sans text-muted uppercase tracking-widest">{sortedBeds.length} Leitos</span>
            </h2>

            <div className="flex-grow overflow-hidden">
                <table className="bg-surface-1 rounded-xl shadow-lg w-full kanban-table">
                    <thead>
                        <tr>
                            <th style={{ width: '10%' }}>Leito</th>
                            <th style={{ width: '25%' }}>Paciente</th>
                            <th style={{ width: '25%' }}>Especialidades Médicas</th>
                            <th style={{ width: '15%' }}>Previsão Alta</th>
                            <th style={{ width: '25%' }}>Bloqueador Principal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedBeds.map((bed) => {
                            const specialties = bed.involvedSpecialties || [];
                            const visibleSpecialties = getVisibleSpecialties(specialties);
                            const remainingCount = 0; // Ocultar contagem de outras especialidades por enquanto

                            return (
                                <tr key={bed.id}>
                                    <td className="text-3xl font-bold py-4 px-6">{bed.number}</td>
                                    <td className="py-4 px-6">
                                        <div className="text-2xl font-medium truncate" title={bed.patientAlias}>{bed.patientAlias || '--'}</div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {visibleSpecialties.map(s => (
                                                <span key={s} className="specialty-chip" title={SpecialtyLabel[s as SpecialtyKey]}>
                                                    {getShortSpecialty(s as SpecialtyKey)}
                                                </span>
                                            ))}
                                            {remainingCount > 0 && (
                                                <span className="text-xs font-bold text-muted px-2">
                                                    +{remainingCount}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`unit-badge ${getDischargeColorClass(bed.expectedDischarge)}`}>
                                            {DischargeEstimateLabel[bed.expectedDischarge]}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-xl text-secondary truncate max-w-[300px]" title={bed.mainBlocker}>
                                        {bed.mainBlocker || <span className="opacity-30">Nenhum</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <style>{`
                .kanban-table {
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                .kanban-table th {
                    text-align: left;
                    font-size: 1rem;
                    text-transform: uppercase;
                    color: var(--text-muted);
                    padding: 1.5rem 1.5rem;
                    border-bottom: 3px solid var(--surface-2);
                    letter-spacing: 0.05em;
                }
                .kanban-table td {
                    border-bottom: 2px solid var(--surface-2);
                    transition: background 0.2s;
                }
                .kanban-table tr:hover td {
                    background: var(--surface-2);
                }
                .kanban-table tr:last-child td {
                    border-bottom: none;
                }
                .specialty-chip {
                    background: var(--surface-2);
                    color: var(--text-primary);
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 6px;
                    border: 1px solid var(--border-color);
                }
                .unit-badge {
                    font-size: 1.1rem;
                    font-weight: 600;
                    padding: 6px 16px;
                    border-radius: 8px;
                    display: inline-block;
                }
            `}</style>
        </div>
    );
};

export default KanbanScreen;

