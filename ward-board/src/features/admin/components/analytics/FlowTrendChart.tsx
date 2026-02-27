import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import type { AnalyticsPeriodKey, DailyBucketPoint } from '../../../../domain/analytics';

interface FlowTrendChartProps {
    unitId: string;
    period: AnalyticsPeriodKey;
}

const FlowTrendChart: React.FC<FlowTrendChartProps> = ({ unitId, period }) => {
    const [data, setData] = useState<DailyBucketPoint[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const getAdminFlowMetricsBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, DailyBucketPoint[]>(functions, 'getAdminFlowMetricsBQ');
                const result = await getAdminFlowMetricsBQ({ unitId, periodKey: period });
                setData(result.data);
            } catch (error) {
                console.error("Error fetching flow metrics", error);
                setError('Erro ao carregar dados de fluxo.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [unitId, period]);

    if (loading) {
        return <div style={{ color: 'var(--text-muted)' }}>Carregando dados de fluxo...</div>;
    }

    if (error) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{error}</div>;

    if (!data || data.length === 0) return <div style={{ color: 'var(--text-muted)' }}>Sem dados de fluxo para o período.</div>;

    // A simple HTML table/bar generic representation since we might not have a chart library installed
    // This is an MVP visualization that is sober and operational
    const maxVal = Math.max(...data.map(d => d.lt24h + d.d2to3 + d.gt3d + d.undefinedBucket));

    return (
        <div style={{ backgroundColor: 'var(--bg-surface-1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', marginTop: 0, color: 'var(--text-primary)' }}>Evolução de Altas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {data.map((day, idx) => {
                    const total = day.lt24h + day.d2to3 + day.gt3d + day.undefinedBucket;
                    return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '80px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{day.date}</div>
                            <div style={{ flex: 1, display: 'flex', height: '1.5rem', backgroundColor: 'var(--bg-surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${(day.lt24h / maxVal) * 100}%`, backgroundColor: 'var(--success)' }} title={`< 24h: ${day.lt24h}`} />
                                <div style={{ width: `${(day.d2to3 / maxVal) * 100}%`, backgroundColor: 'var(--warning)' }} title={`2-3 dias: ${day.d2to3}`} />
                                <div style={{ width: `${(day.gt3d / maxVal) * 100}%`, backgroundColor: 'var(--danger)' }} title={`> 3 dias: ${day.gt3d}`} />
                                <div style={{ width: `${(day.undefinedBucket / maxVal) * 100}%`, backgroundColor: 'var(--text-muted)' }} title={`Indefinido: ${day.undefinedBucket}`} />
                            </div>
                            <div style={{ width: '30px', fontSize: '0.875rem', fontWeight: 600, textAlign: 'right' }}>{total}</div>
                        </div>
                    );
                })}
            </div>
            {/* Simple Legend */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><div style={{ width: '10px', height: '10px', backgroundColor: 'var(--success)', borderRadius: '2px' }} /> &lt; 24h</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><div style={{ width: '10px', height: '10px', backgroundColor: 'var(--warning)', borderRadius: '2px' }} /> 2-3 dias</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><div style={{ width: '10px', height: '10px', backgroundColor: 'var(--danger)', borderRadius: '2px' }} /> &gt; 3 dias</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><div style={{ width: '10px', height: '10px', backgroundColor: 'var(--text-muted)', borderRadius: '2px' }} /> Indefinido</div>
            </div>
        </div>
    );
};

export default FlowTrendChart;
