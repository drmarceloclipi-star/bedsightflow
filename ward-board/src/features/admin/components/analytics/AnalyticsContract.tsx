import React from 'react';

export type AnalyticsWindow = 'agora' | 'periodo' | 'turno atual';

export interface AnalyticsContractProps {
    metric: string;
    universe: string;
    window: AnalyticsWindow;
    inclusionRule?: string;
}

export const AnalyticsContract: React.FC<AnalyticsContractProps> = ({
    metric,
    universe,
    window,
    inclusionRule
}) => {
    return (
        <div className="mc-contract">
            <div className="mc-contract-row">
                <div className="mc-contract-item">
                    <span className="mc-contract-label">Métrica:</span>
                    <span className="mc-contract-value">{metric}</span>
                </div>
                <div className="mc-contract-item">
                    <span className="mc-contract-label">Universo (N):</span>
                    <span className="mc-contract-value">{universe}</span>
                </div>
            </div>

            <div className="mc-contract-row">
                <div className="mc-contract-item">
                    <span className="mc-contract-label">Janela:</span>
                    <span className={`mc-contract-badge mc-contract-badge--${window}`}>
                        {window === 'agora' ? 'Snapshot (Agora)' : window === 'turno atual' ? 'Turno Atual' : 'Histórico (Período)'}
                    </span>
                </div>
                {inclusionRule && (
                    <div className="mc-contract-item">
                        <span className="mc-contract-label">Inclusão:</span>
                        <span className="mc-contract-value">{inclusionRule}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
