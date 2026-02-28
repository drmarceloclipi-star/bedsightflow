import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import { CLOUD_FUNCTIONS } from '../../../../constants/functionNames';
import type { AnalyticsPeriodKey, FreshnessMetrics } from '../../../../domain/analytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { AnalyticsContract } from './AnalyticsContract';

interface FreshnessProps {
    unitId: string;
    period: AnalyticsPeriodKey;
    refreshTrigger?: number;
}

const FreshnessCards: React.FC<FreshnessProps> = ({ unitId, period, refreshTrigger }) => {
    const navigate = useNavigate();
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
            } catch (err) {
                console.error('Error fetching freshness metrics', err);
                setError('Erro ao carregar métricas de atualização.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [unitId, period, refreshTrigger]);

    if (loading) {
        return <div className="analytics-loading-text">Carregando métricas de atualização...</div>;
    }

    if (error) return <AnalyticsEmptyState type="error" />;
    if (!data) return null;

    const handleDrillDown = (filter: string) => {
        navigate(`/admin/unit/${unitId}/analytics/lists?filter=${filter}`);
    };

    const freshnessCards = [
        { label: 'Leitos +12h S/ Modificação', value: data.stale12h, filter: 'stale12h', severity: 'warning' as const },
        { label: 'Leitos +24h S/ Modificação', value: data.stale24h, filter: 'stale24h', severity: 'danger' as const },
        { label: 'Leitos +48h S/ Modificação', value: data.stale48h, filter: 'stale48h', severity: 'danger' as const },
    ];

    return (
        <div className="analytics-exploration-section">
            <h4 className="analytics-exploration-subtitle">Rastreio de Atualizações (Freshness)</h4>
            <div className="analytics-grid-3">
                {freshnessCards.map((card, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => handleDrillDown(card.filter)}
                        className={[
                            'analytics-alert-card',
                            card.value > 0 ? `analytics-alert-card--${card.severity}` : '',
                        ].join(' ')}
                    >
                        <div className="analytics-alert-label">{card.label}</div>
                        <div className={`analytics-alert-value${card.value > 0 ? ` analytics-alert-value--${card.severity}` : ''}`}>
                            {card.value}
                        </div>
                        <div className="analytics-alert-link">
                            Ver leitos <span>→</span>
                        </div>
                    </button>
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
