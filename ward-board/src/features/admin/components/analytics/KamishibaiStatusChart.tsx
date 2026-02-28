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
    refreshTrigger?: number;
}

const DOMAIN_TRANSLATIONS: Record<string, string> = {
    'MEDICAL': 'Médico',
    'NUTRITION': 'Nutrição',
    'PSYCHOLOGY': 'Psicologia',
    'SOCIAL': 'Serviço Social',
    'PHYSIO': 'Fisioterapia',
    'NURSING': 'Enfermagem'
};

const KamishibaiStatusChart: React.FC<KamishibaiStatsProps> = ({ unitId, period, refreshTrigger }) => {
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
            } catch (err) {
                console.error('Error fetching kamishibai stats', err);
                setError('Erro ao carregar métricas Kamishibai.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [unitId, period, refreshTrigger]);

    if (loading) {
        return <div className="analytics-loading-text">Carregando métricas Kamishibai...</div>;
    }

    if (error) return <AnalyticsEmptyState type="error" />;
    if (!data) return null;

    const totalItems = data.distribution.ok + data.distribution.blocked + data.distribution.na;
    if (totalItems === 0) return <AnalyticsEmptyState type="empty" message="Nenhuma avaliação Kamishibai no período" />;

    const naPercent = Math.round((data.distribution.na / totalItems) * 100);
    const activeItems = totalItems - data.distribution.na;

    // Determine insight message
    let insightMessage: string | null = null;
    let insightSub: string | null = null;
    if (naPercent >= 100) {
        insightMessage = '100% dos itens não aplicáveis no período — possível ausência de preenchimento operacional.';
        insightSub = 'Verifique se as equipes estão preenchendo o checklist Kamishibai conforme o esperado.';
    } else if (naPercent >= 80) {
        insightMessage = `${naPercent}% dos itens não aplicáveis — verifique se os processos estão sendo avaliados.`;
        insightSub = `Apenas ${activeItems} de ${totalItems} itens foram efetivamente avaliados no período.`;
    }

    return (
        <div className="analytics-exploration-section">
            {insightMessage && (
                <div className="analytics-insight-banner">
                    <span className="analytics-insight-banner-icon">⚠️</span>
                    <div className="analytics-insight-banner-content">
                        <span className="analytics-insight-banner-text">{insightMessage}</span>
                        {insightSub && <span className="analytics-insight-banner-sub">{insightSub}</span>}
                    </div>
                </div>
            )}

            <div className="analytics-grid-2">
                {/* Distribuição de status */}
                <div className="analytics-chart-container">
                    <h4 className="analytics-exploration-subtitle">
                        Status dos Itens Kamishibai (N={totalItems})
                    </h4>
                    <p className="analytics-chart-subtitle">
                        N = total de itens avaliados no período
                    </p>
                    <div className="analytics-stat-list">
                        <div className="analytics-stat-item">
                            <span className="analytics-stat-label analytics-text--ok">OK</span>
                            <span className="analytics-stat-value">{data.distribution.ok}</span>
                        </div>
                        <div className="analytics-stat-item">
                            <span className="analytics-stat-label analytics-text--critical">Bloqueios</span>
                            <span className="analytics-stat-value">{data.distribution.blocked}</span>
                        </div>
                        <div className="analytics-stat-item">
                            <span className="analytics-stat-label analytics-text--muted">Não Aplicável</span>
                            <span className="analytics-stat-value">{data.distribution.na}</span>
                        </div>
                    </div>
                </div>

                {/* Por domínio */}
                <div className="analytics-chart-container">
                    <h4 className="analytics-exploration-subtitle">Por Domínio</h4>
                    <div className="analytics-stat-list">
                        {data.byDomain.map((domain, idx) => (
                            <div key={idx} className="analytics-stat-item">
                                <div className="analytics-stat-label analytics-stat-label--bold">
                                    {DOMAIN_TRANSLATIONS[domain.domain] || domain.domain}
                                </div>
                                <div className="analytics-stat-sub">
                                    {domain.blocked > 0 && <span className="analytics-text--critical">{domain.blocked} bloq.</span>}
                                    {domain.blocked === 0 && <span className="analytics-text--ok">Tudo OK</span>}
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
