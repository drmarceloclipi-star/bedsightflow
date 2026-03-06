import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import { CLOUD_FUNCTIONS } from '../../../../constants/functionNames';
import type { AnalyticsPeriodKey } from '../../../../domain/analytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { AnalyticsContract } from './AnalyticsContract';

/**
 * The backend getAdminTrendComparison returns { currentPeriod, previousPeriod }
 * where each period is an array of { date, value } objects.
 * We transform this into a summary comparison on the frontend.
 */
interface PeriodPoint {
    date: string;
    value: number;
}

interface TrendComparisonResult {
    currentPeriod: PeriodPoint[];
    previousPeriod: PeriodPoint[];
}

interface TrendComparisonProps {
    unitId: string;
    period: AnalyticsPeriodKey;
    refreshTrigger?: number;
}

const TrendComparisonPanel: React.FC<TrendComparisonProps> = ({ unitId, period, refreshTrigger }) => {
    const [data, setData] = useState<TrendComparisonResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const getAdminTrendComparison = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, TrendComparisonResult>(functions, CLOUD_FUNCTIONS.GET_ADMIN_TREND_COMPARISON);
                const result = await getAdminTrendComparison({ unitId, periodKey: period });
                setData(result.data);
            } catch (err) {
                console.error("Error fetching trend comparison", err);
                setError('Erro ao carregar comparativo de tendências.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [unitId, period, refreshTrigger]);

    if (loading) {
        return <div className="analytics-loading-text">Calculando comparação de tendências...</div>;
    }

    if (error) return <AnalyticsEmptyState type="error" />;

    if (!data || (!data.currentPeriod?.length && !data.previousPeriod?.length)) return <AnalyticsEmptyState type="empty" message="Sem dados para comparar no período" />;

    // Sum the values for current and previous periods
    const currentTotal = data.currentPeriod?.reduce((acc, p) => acc + p.value, 0) ?? 0;
    const previousTotal = data.previousPeriod?.reduce((acc, p) => acc + p.value, 0) ?? 0;
    const diffPercent = previousTotal === 0 ? 0 : Math.round(((currentTotal - previousTotal) / previousTotal) * 100);

    const metrics = [
        {
            label: 'Total de Eventos (Período Atual)',
            current: currentTotal,
            previous: previousTotal,
            diffPercent,
        },
        {
            label: 'Média Diária (Período Atual)',
            current: data.currentPeriod?.length ? Math.round(currentTotal / data.currentPeriod.length) : 0,
            previous: data.previousPeriod?.length ? Math.round(previousTotal / data.previousPeriod.length) : 0,
            diffPercent: (data.previousPeriod?.length && data.currentPeriod?.length)
                ? Math.round(((currentTotal / data.currentPeriod.length) - (previousTotal / data.previousPeriod.length)) / (previousTotal / data.previousPeriod.length) * 100)
                : 0,
        },
    ];

    return (
        <div className="analytics-chart-container">
            <h4 className="analytics-exploration-subtitle">Comparativo com Período Anterior</h4>
            <div className="analytics-comparison-grid">
                {metrics.map((metric, idx) => {
                    const isPositive = metric.diffPercent > 0;
                    const isNeutral = metric.diffPercent === 0;
                    const deltaClass = isNeutral
                        ? 'analytics-comparison-delta--neutral'
                        : isPositive ? 'analytics-comparison-delta--positive' : 'analytics-comparison-delta--negative';

                    return (
                        <div key={idx} className="analytics-comparison-card">
                            <div className="analytics-comparison-label">{metric.label}</div>
                            <div className="analytics-comparison-value-row">
                                <span className="analytics-comparison-value">{metric.current}</span>
                                <span className={`analytics-comparison-delta ${deltaClass}`}>
                                    {isPositive ? '↑' : isNeutral ? '-' : '↓'} {Math.abs(metric.diffPercent)}%
                                </span>
                            </div>
                            <div className="analytics-comparison-previous">Anterior: {metric.previous}</div>
                        </div>
                    );
                })}
            </div>

            <AnalyticsContract
                metric="Comparativo de volume de altas e transferências"
                universe="N = Total de eventos de giro de leito"
                window="periodo"
                inclusionRule="Compara a janela de dias atual com a janela imediatamente anterior de igual tamanho."
            />
        </div>
    );
};

export default TrendComparisonPanel;
