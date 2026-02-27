import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import { CLOUD_FUNCTIONS } from '../../../../constants/functionNames';
import type { AnalyticsPeriodKey, FreshnessMetrics } from '../../../../domain/analytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { AnalyticsContract } from './AnalyticsContract';

interface FreshnessProps {
    unitId: string;
    period: AnalyticsPeriodKey;
}

const FreshnessCards: React.FC<FreshnessProps> = ({ unitId, period }) => {
    const [data, setData] = useState<FreshnessMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const getAdminFreshnessBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, FreshnessMetrics>(functions, CLOUD_FUNCTIONS.GET_ADMIN_FRESHNESS_BQ);
                const result = await getAdminFreshnessBQ({ unitId, periodKey: period });
                setData(result.data);
            } catch (error) {
                console.error("Error fetching freshness metrics", error);
                setError('Erro ao carregar métricas de atualização.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [unitId, period]);

    if (loading) {
        return <div style={{ color: 'var(--text-muted)' }}>Carregando métricas de atualização...</div>;
    }

    if (error) return <AnalyticsEmptyState type="error" />;

    if (!data) return null;

    const handleDrillDown = (filter: string) => {
        window.open(`/editor?unit=${unitId}&filter=${filter}`, '_blank');
    };

    const freshnessCards = [
        { label: 'Leitos +12h S/ Modificação', value: data.stale12h, filter: 'stale12h', color: 'var(--warning)' },
        { label: 'Leitos +24h S/ Modificação', value: data.stale24h, filter: 'stale24h', color: 'var(--danger)' },
        { label: 'Leitos +48h S/ Modificação', value: data.stale48h, filter: 'stale48h', color: 'var(--danger)' }
    ];

    return (
        <div className="analytics-exploration-section">
            <h4 className="analytics-exploration-subtitle">Rastreio de Atualizações (Freshness)</h4>
            <div className="analytics-grid-3">
                {freshnessCards.map((card, idx) => (
                    <div key={idx}
                        onClick={() => handleDrillDown(card.filter)}
                        className={[
                            'analytics-alert-card',
                            card.value > 0
                                ? (card.color === 'var(--danger)' ? 'analytics-alert-card--danger' : 'analytics-alert-card--warning')
                                : ''
                        ].join(' ')}
                    >
                        <div className="analytics-alert-label">{card.label}</div>
                        <div className="analytics-alert-value" style={{ color: card.value > 0 ? card.color : 'inherit' }}>
                            {card.value}
                        </div>
                        <div className="analytics-alert-link">
                            Ver leitos <span>→</span>
                        </div>
                    </div>
                ))}
            </div>
            <AnalyticsContract
                metric="Leitos sem atualização recente"
                universe="N = Leitos Ativos (Ocupados + Vagos) na unidade"
                window="agora"
                inclusionRule="Avalia o tempo desde a última modificação no leito (lastUpdate). Ignora inativos."
            />
        </div>
    );
};

export default FreshnessCards;
