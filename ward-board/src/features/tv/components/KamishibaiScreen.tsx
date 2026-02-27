import React from 'react';
import type { Bed } from '../../../domain/types';
import { getKamishibaiLabel, KAMISHIBAI_DOMAINS } from '../../../domain/specialtyUtils';

interface KamishibaiScreenProps {
    beds: Bed[];
    columns?: number;
}

const KamishibaiScreen: React.FC<KamishibaiScreenProps> = ({ beds, columns = 1 }) => {

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
                        <td><span className="kamishibai-bed-num">{bed.number}</span></td>
                        {KAMISHIBAI_DOMAINS.map(s => {
                            const entry = bed.kamishibai?.[s];
                            return (
                                <td key={s} className="text-center">
                                    <div className={`kamishibai-dot ${entry?.status || 'na'}`} />
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
                        <div className="kamishibai-dot ok" style={{ width: '16px', height: '16px', margin: 0 }} /> <span>OK / Concluído</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="kamishibai-dot pending" style={{ width: '16px', height: '16px', margin: 0 }} /> <span>Pendente</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="kamishibai-dot blocked" style={{ width: '16px', height: '16px', margin: 0 }} /> <span>Impedido</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="kamishibai-dot na" style={{ width: '16px', height: '16px', margin: 0 }} /> <span>N/A</span>
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
                    zoom: 0.8;
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
                }
            `}</style>
        </div>
    );
};

export default KamishibaiScreen;

