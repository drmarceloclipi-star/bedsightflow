import React from 'react';
import type { Bed } from '../../../domain/types';
import { getKamishibaiLabel, KAMISHIBAI_DOMAINS } from '../../../domain/specialtyUtils';

interface KamishibaiScreenProps {
    beds: Bed[];
}

const KamishibaiScreen: React.FC<KamishibaiScreenProps> = ({ beds }) => {
    return (
        <div className="animate-slideIn">
            <div className="flex justify-between items-end p-6 pb-0">
                <h2 className="text-3xl font-serif">Quadro Kamishibai — Pendências por Domínio / Equipe</h2>
                <div className="flex gap-4 text-xs font-bold uppercase tracking-widest text-secondary">
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
            <div className="p-6 pt-2 overflow-x-auto">
                <table className="bg-surface-1 rounded-lg shadow-sm">
                    <thead>
                        <tr>
                            <th style={{ width: '80px' }}>Leito</th>
                            {KAMISHIBAI_DOMAINS.map(s => (
                                <th key={s} className="text-center">{getKamishibaiLabel(s)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {beds.map((bed) => (
                            <tr key={bed.id}>
                                <td className="text-xl font-bold">{bed.number}</td>
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
            </div>
        </div>
    );
};

export default KamishibaiScreen;
