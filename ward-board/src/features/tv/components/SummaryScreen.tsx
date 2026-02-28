import React from 'react';
import type { SummaryMetrics } from '../../../domain/types';

interface SummaryScreenProps {
    metrics: SummaryMetrics;
    unitName?: string;
}

const SummaryScreen: React.FC<SummaryScreenProps> = ({ metrics, unitName }) => {
    return (
        <div className="animate-slideIn flex flex-col items-center justify-center p-12 h-full">
            <h2 className="text-4xl font-serif mb-12">Resumo Executivo — {unitName || 'Unidade'}</h2>

            <div className="grid-summary w-full max-w-5xl">
                <div className="summary-card">
                    <span className="summary-label">Pacientes Ativos</span>
                    <span className="summary-value">{metrics.activePatients}</span>
                </div>

                <div className="summary-card highlight-success">
                    <span className="summary-label">Altas Previstas (24h)</span>
                    <span className="summary-value">{metrics.discharges24h}</span>
                </div>

                <div className="summary-card highlight-danger">
                    <span className="summary-label">Leitos com Bloqueio</span>
                    <span className="summary-value">{metrics.withBlockers}</span>
                </div>

            </div>

            <div className="mt-16 text-muted text-lg font-serif italic">
                "Foco na fluidez, segurança e alta qualificada."
            </div>
        </div>
    );
};

export default SummaryScreen;
