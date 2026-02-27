import React from 'react';
import type { KpiStatus } from '../../../../domain/analytics';
import { AnalyticsContract } from './AnalyticsContract';
import type { AnalyticsWindow } from './AnalyticsContract';

interface DrilldownConfig {
    label: string;
    onClick: () => void;
}

interface ComparisonConfig {
    label: string;
    value: string;
    delta?: number | null; // positive = up, negative = down
}

interface MissionControlCardProps {
    id: string;
    title: string;
    scope: 'AGORA' | 'PERÍODO';
    value: string | number;
    unit?: string;
    denominator?: string; // "de N ativos"
    percent?: number | null;
    status: KpiStatus;
    comparison?: ComparisonConfig;
    countermeasure?: string;
    drilldown?: DrilldownConfig;
    // Analytics contract
    contractMetric: string;
    contractUniverse: string;
    contractWindow: AnalyticsWindow;
    contractRule?: string;
    loading?: boolean;
}

function getStatusClass(status: KpiStatus): string {
    if (status === 'critical') return 'mc-card--critical';
    if (status === 'warning') return 'mc-card--warning';
    return 'mc-card--ok';
}

function getStatusLabel(status: KpiStatus): string {
    if (status === 'critical') return 'CRÍTICO';
    if (status === 'warning') return 'ATENÇÃO';
    return 'OK';
}

function getDeltaClass(delta: number): string {
    return delta >= 0 ? 'mc-delta--up' : 'mc-delta--down';
}

const MissionControlCard: React.FC<MissionControlCardProps> = ({
    title,
    scope,
    value,
    unit,
    denominator,
    percent,
    status,
    comparison,
    countermeasure,
    drilldown,
    contractMetric,
    contractUniverse,
    contractWindow,
    contractRule,
    loading,
}) => {
    if (loading) {
        return (
            <div className="mc-card mc-card--loading">
                <div className="mc-card-skeleton" />
            </div>
        );
    }

    return (
        <div className={`mc-card ${getStatusClass(status)}`}>
            {/* Header */}
            <div className="mc-card-header">
                <span className="mc-card-scope">{scope}</span>
                <span className={`mc-card-status-badge mc-badge--${status}`}>
                    {getStatusLabel(status)}
                </span>
            </div>

            {/* Title */}
            <h3 className="mc-card-title">{title}</h3>

            {/* Main value */}
            <div className="mc-card-value-row">
                <span className="mc-card-value">{value}</span>
                {unit && <span className="mc-card-unit">{unit}</span>}
                {percent !== null && percent !== undefined && (
                    <span className={`mc-card-percent mc-percent--${status}`}>
                        {percent.toFixed(1)}%
                    </span>
                )}
            </div>

            {denominator && (
                <div className="mc-card-denominator">{denominator}</div>
            )}

            {/* Comparison */}
            {comparison && (
                <div className="mc-card-comparison">
                    <span className="mc-comparison-label">{comparison.label}:</span>
                    <span className="mc-comparison-value">{comparison.value}</span>
                    {comparison.delta !== null && comparison.delta !== undefined && (
                        <span className={`mc-delta ${getDeltaClass(comparison.delta)}`}>
                            {comparison.delta >= 0 ? '▲' : '▼'} {Math.abs(comparison.delta)}%
                        </span>
                    )}
                </div>
            )}

            {/* Countermeasure */}
            {countermeasure && status !== 'ok' && (
                <div className="mc-card-countermeasure">
                    <span className="mc-countermeasure-icon">⚑</span>
                    <span className="mc-countermeasure-text">{countermeasure}</span>
                </div>
            )}

            {/* Drill-down CTA */}
            {drilldown && (
                <button
                    className="mc-card-drilldown-btn"
                    onClick={drilldown.onClick}
                    type="button"
                >
                    {drilldown.label} →
                </button>
            )}

            {/* Semantic contract */}
            <AnalyticsContract
                metric={contractMetric}
                universe={contractUniverse}
                window={contractWindow}
                inclusionRule={contractRule}
            />
        </div>
    );
};

export default MissionControlCard;
