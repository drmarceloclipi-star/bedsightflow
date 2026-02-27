import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import { CLOUD_FUNCTIONS } from '../../../../constants/functionNames';
import type { AnalyticsPeriodKey, KamishibaiStatusBreakdown, KamishibaiDomainMetric } from '../../../../domain/analytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { AnalyticsContract } from './AnalyticsContract';

interface KamishibaiResult {
    distribution: KamishibaiStatusBreakdown;
    byDomain: KamishibaiDomainMetric[];
}

interface KamishibaiStatsProps {
    unitId: string;
    period: AnalyticsPeriodKey;
}

const KamishibaiStatusChart: React.FC<KamishibaiStatsProps> = ({ unitId, period }) => {
    const [data, setData] = useState<KamishibaiResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const getAdminKamishibaiStatsBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, KamishibaiResult>(functions, CLOUD_FUNCTIONS.GET_ADMIN_KAMISHIBAI_STATS_BQ);
                const result = await getAdminKamishibaiStatsBQ({ unitId, periodKey: period });
                setData(result.data);
            } catch (error) {
                console.error("Error fetching kamishibai stats", error);
                setError('Erro ao carregar métricas Kamishibai.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [unitId, period]);

    if (loading) {
        return <div className="analytics-loading-text">Carregando métricas Kamishibai...</div>;
    }

    if (error) return <AnalyticsEmptyState type="error" />;

    if (!data) return null;

    const totalItems = data.distribution.ok + data.distribution.pending + data.distribution.blocked + data.distribution.na;
    if (totalItems === 0) return <AnalyticsEmptyState type="empty" message="Nenhuma avaliação Kamishibai no período" />;

    return (
        <div className="analytics-exploration-section">
            <div className="analytics-grid-2">
                {/* Distribution */}
                <div className="analytics-chart-container">
                    <h4 className="analytics-exploration-subtitle">
                        Status dos Itens Kamishibai (N={totalItems})
                    </h4>
                    <p className="analytics-chart-subtitle">
                        N = total de itens avaliados no período
                    </p>
                    <div className="analytics-stat-list">
                        <div className="analytics-stat-item">
                            <span className="analytics-stat-label color-success">OK</span>
                            <span className="analytics-stat-value">{data.distribution.ok}</span>
                        </div>
                        <div className="analytics-stat-item">
                            <span className="analytics-stat-label color-warning">Pendências</span>
                            <span className="analytics-stat-value">{data.distribution.pending}</span>
                        </div>
                        <div className="analytics-stat-item">
                            <span className="analytics-stat-label color-danger">Bloqueios</span>
                            <span className="analytics-stat-value">{data.distribution.blocked}</span>
                        </div>
                        <div className="analytics-stat-item">
                            <span className="analytics-stat-label color-muted">Não Aplicável</span>
                            <span className="analytics-stat-value">{data.distribution.na}</span>
                        </div>
                    </div>
                </div>

                {/* By Domain */}
                <div className="analytics-chart-container">
                    <h4 className="analytics-exploration-subtitle">Por Domínio</h4>
                    <div className="analytics-stat-list">
                        {data.byDomain.map((domain, idx) => (
                            <div key={idx} className="analytics-stat-item">
                                <div className="analytics-stat-label font-semibold">{domain.domain}</div>
                                <div className="analytics-stat-sub">
                                    {domain.pending > 0 && <span className="color-warning">{domain.pending} pend.</span>}
                                    {domain.blocked > 0 && <span className="color-danger">{domain.blocked} bloq.</span>}
                                    {domain.pending === 0 && domain.blocked === 0 && <span className="color-success">Tudo OK</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <AnalyticsContract
                metric="Avaliações do checklist de processos (Kamishibai)"
                universe={`N = Total de itens checados no período selecionado (${totalItems})`}
                window="periodo"
                inclusionRule="Inclui todos os itens de Kamishibai preenchidos para a unidade (exceto NA na métrica, mas NA está no universo)."
            />
        </div>
    );
};

export default KamishibaiStatusChart;
