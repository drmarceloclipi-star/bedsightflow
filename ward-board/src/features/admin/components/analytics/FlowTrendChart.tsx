import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import { CLOUD_FUNCTIONS } from '../../../../constants/functionNames';
import type { AnalyticsPeriodKey, DailyBucketPoint } from '../../../../domain/analytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { AnalyticsContract } from './AnalyticsContract';

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
                const getAdminFlowMetricsBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, DailyBucketPoint[]>(functions, CLOUD_FUNCTIONS.GET_ADMIN_FLOW_METRICS_BQ);
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
        return <div className="analytics-loading-text">Carregando dados de fluxo...</div>;
    }

    if (error) return <AnalyticsEmptyState type="error" />;

    if (!data || data.length === 0) return <AnalyticsEmptyState type="empty" message="Sem dados de fluxo para o período" />;

    // A simple HTML table/bar generic representation since we might not have a chart library installed
    // This is an MVP visualization that is sober and operational
    const maxVal = Math.max(...data.map(d => d.lt24h + d.d2to3 + d.gt3d + d.undefinedBucket));

    return (
        <div className="analytics-chart-container">
            <h4 className="analytics-exploration-subtitle">Evolução de Altas</h4>
            <div className="analytics-bar-chart">
                {data.map((day, idx) => {
                    const total = day.lt24h + day.d2to3 + day.gt3d + day.undefinedBucket;
                    return (
                        <div key={idx} className="analytics-bar-item">
                            <div className="analytics-bar-label">{day.date}</div>
                            <div className="analytics-bar-rail">
                                <div className="analytics-bar-segment bg-success" style={{ '--bar-width': `${(day.lt24h / maxVal) * 100}%` } as React.CSSProperties} title={`< 24h: ${day.lt24h}`} />
                                <div className="analytics-bar-segment bg-warning" style={{ '--bar-width': `${(day.d2to3 / maxVal) * 100}%` } as React.CSSProperties} title={`2-3 dias: ${day.d2to3}`} />
                                <div className="analytics-bar-segment bg-danger" style={{ '--bar-width': `${(day.gt3d / maxVal) * 100}%` } as React.CSSProperties} title={`> 3 dias: ${day.gt3d}`} />
                                <div className="analytics-bar-segment bg-muted" style={{ '--bar-width': `${(day.undefinedBucket / maxVal) * 100}%` } as React.CSSProperties} title={`Indefinido: ${day.undefinedBucket}`} />
                            </div>
                            <div className="analytics-bar-total">{total}</div>
                        </div>
                    );
                })}
            </div>
            {/* Legend */}
            <div className="analytics-legend">
                <div className="analytics-legend-item"><div className="analytics-legend-dot bg-success" /> &lt; 24h</div>
                <div className="analytics-legend-item"><div className="analytics-legend-dot bg-warning" /> 2-3 dias</div>
                <div className="analytics-legend-item"><div className="analytics-legend-dot bg-danger" /> &gt; 3 dias</div>
                <div className="analytics-legend-item"><div className="analytics-legend-dot bg-muted" /> Indefinido</div>
            </div>

            <AnalyticsContract
                metric="Tempos de permanência acumulados nas altas do dia"
                universe="N = Total de Altas realizadas por dia"
                window="periodo"
                inclusionRule="Avalia pacientes retirados do censo na data de referência (status alterado para discharge/transfer)."
            />
        </div>
    );
};

export default FlowTrendChart;
