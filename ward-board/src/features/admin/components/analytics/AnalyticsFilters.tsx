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
];

const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({ period, onPeriodChange, unitId }) => {
    return (
        <div className="analytics-filters">
            <div className="analytics-filters-period">
                <span className="analytics-filters-label">Período:</span>
                <div className="analytics-filters-options">
                    {PERIOD_OPTIONS.map(option => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => onPeriodChange(option.key)}
                            className={`analytics-filter-btn${period === option.key ? ' analytics-filter-btn--active' : ''}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="analytics-filters-unit">
                <span className="analytics-filters-unit-label">Unidade selecionada:</span>
                <span className="analytics-filters-unit-badge">
                    {unitId.toUpperCase()}
                </span>
            </div>
        </div>
    );
};

export default AnalyticsFilters;
