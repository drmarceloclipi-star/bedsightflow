import React from 'react';
import type { AnalyticsPeriodKey } from '../../../../domain/analytics';

interface AnalyticsFiltersProps {
    period: AnalyticsPeriodKey;
    onPeriodChange: (period: AnalyticsPeriodKey) => void;
    unitId: string;
}

const PERIOD_OPTIONS: { key: AnalyticsPeriodKey; label: string }[] = [
    { key: 'today', label: 'Hoje' },
    { key: '7d', label: 'Últimos 7 dias' },
    { key: '30d', label: 'Últimos 30 dias' },
    // Custom filter not implemented in MVP to keep it simple
];

const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({ period, onPeriodChange, unitId }) => {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface-1)',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid var(--border-soft)',
            flexWrap: 'wrap',
            gap: '1rem',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Período:
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {PERIOD_OPTIONS.map(option => (
                        <button
                            key={option.key}
                            onClick={() => onPeriodChange(option.key)}
                            style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '4px',
                                border: '1px solid',
                                borderColor: period === option.key ? 'var(--accent-primary)' : 'var(--border-soft)',
                                backgroundColor: period === option.key ? 'var(--accent-primary)' : 'transparent',
                                color: period === option.key ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: period === option.key ? 600 : 400,
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Unidade selecionada:</span>
                <span style={{
                    backgroundColor: 'var(--bg-surface-2)',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-soft)'
                }}>
                    {unitId.toUpperCase()}
                </span>
            </div>
        </div>
    );
};

export default AnalyticsFilters;
