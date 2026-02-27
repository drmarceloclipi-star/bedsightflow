import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import { CLOUD_FUNCTIONS } from '../../../../constants/functionNames';
import type { AnalyticsPeriodKey, BlockerMetric } from '../../../../domain/analytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { AnalyticsContract } from './AnalyticsContract';

interface TopBlockersProps {
    unitId: string;
    period: AnalyticsPeriodKey;
}

const TopBlockersTable: React.FC<TopBlockersProps> = ({ unitId, period }) => {
    const [data, setData] = useState<BlockerMetric[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const getAdminTopBlockersBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, BlockerMetric[]>(functions, CLOUD_FUNCTIONS.GET_ADMIN_TOP_BLOCKERS_BQ);
                const result = await getAdminTopBlockersBQ({ unitId, periodKey: period });
                setData(result.data);
            } catch (error) {
                console.error("Error fetching top blockers", error);
                setError('Erro ao carregar bloqueadores.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [unitId, period]);

    if (loading) {
        return <div className="analytics-loading-text">Carregando bloqueadores...</div>;
    }

    if (error) return <AnalyticsEmptyState type="error" />;

    if (!data || data.length === 0) return <AnalyticsEmptyState type="empty" message="Nenhum bloqueador registrado no período" />;

    const maxOccurrences = Math.max(...data.map(b => b.count));

    return (
        <div className="analytics-chart-container">
            <h4 className="analytics-exploration-subtitle">Top Bloqueadores</h4>
            <table className="analytics-table">
                <thead>
                    <tr>
                        <th>Motivo</th>
                        <th>Ocorrências</th>
                        <th className="col-impact">Impacto %</th>
                    </tr>
                </thead>
                <tbody>
                    {data.slice(0, 10).map((b, idx) => (
                        <tr key={idx}>
                            <td>{b.blocker}</td>
                            <td className="font-semibold">{b.count}</td>
                            <td>
                                <div className="analytics-impact-container">
                                    <div className="analytics-impact-bar-rail">
                                        <div className="analytics-impact-bar-fill" style={{ '--bar-width': `${(b.count / maxOccurrences) * 100}%` } as React.CSSProperties} />
                                    </div>
                                    <span className="analytics-impact-value">
                                        {((b.count / data.reduce((acc, curr) => acc + curr.count, 0)) * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <AnalyticsContract
                metric="Acionamentos de bloqueio de fluxo"
                universe="N = Total de ocorrências de bloqueios registradas no período"
                window="periodo"
                inclusionRule="Conta eventos onde o status mudou para 'blocked'. Não representa leitos únicos, mas sim acionamentos."
            />
        </div>
    );
};

export default TopBlockersTable;
