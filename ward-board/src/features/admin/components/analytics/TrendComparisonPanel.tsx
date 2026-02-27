import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import type { AnalyticsPeriodKey } from '../../../../domain/analytics';

/**
 * The backend getAdminTrendComparisonBQ returns { currentPeriod, previousPeriod }
 * where each period is an array of { date, value } objects.
 * We transform this into a summary comparison on the frontend.
 */
interface PeriodPoint {
    date: string;
    value: number;
}

interface TrendComparisonBQResult {
    currentPeriod: PeriodPoint[];
    previousPeriod: PeriodPoint[];
}

interface TrendComparisonProps {
    unitId: string;
    period: AnalyticsPeriodKey;
}

const TrendComparisonPanel: React.FC<TrendComparisonProps> = ({ unitId, period }) => {
    const [data, setData] = useState<TrendComparisonBQResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const getAdminTrendComparisonBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, TrendComparisonBQResult>(functions, 'getAdminTrendComparisonBQ');
                const result = await getAdminTrendComparisonBQ({ unitId, periodKey: period });
                setData(result.data);
            } catch (err) {
                console.error("Error fetching trend comparison", err);
                setError('Erro ao carregar comparativo de tendências.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [unitId, period]);

    if (loading) {
        return <div style={{ color: 'var(--text-muted)' }}>Calculando comparação de tendências...</div>;
    }

    if (error) {
        return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{error}</div>;
    }

    if (!data || (!data.currentPeriod?.length && !data.previousPeriod?.length)) return null;

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
        <div style={{ backgroundColor: 'var(--bg-surface-1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', marginTop: 0, color: 'var(--text-primary)' }}>Comparativo com Período Anterior</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                {metrics.map((metric, idx) => {
                    const isPositive = metric.diffPercent > 0;
                    const isNeutral = metric.diffPercent === 0;
                    const color = isNeutral ? 'var(--text-muted)' : isPositive ? 'var(--danger)' : 'var(--success)';

                    return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', backgroundColor: 'var(--bg-surface-2)', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{metric.label}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{metric.current}</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color }}>
                                    {isPositive ? '↑' : isNeutral ? '-' : '↓'} {Math.abs(metric.diffPercent)}%
                                </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Anterior: {metric.previous}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TrendComparisonPanel;
