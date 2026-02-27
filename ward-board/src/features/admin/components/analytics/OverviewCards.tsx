import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import { CLOUD_FUNCTIONS } from '../../../../constants/functionNames';
import type { AnalyticsPeriodKey, AdminOverviewMetrics } from '../../../../domain/analytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { AnalyticsContract } from './AnalyticsContract';

interface OverviewCardsProps {
    unitId: string;
    period: AnalyticsPeriodKey;
}

const OverviewCards: React.FC<OverviewCardsProps> = ({ unitId, period }) => {
    const [data, setData] = useState<AdminOverviewMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const getAdminOverviewBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, AdminOverviewMetrics>(functions, CLOUD_FUNCTIONS.GET_ADMIN_OVERVIEW_BQ);
                const result = await getAdminOverviewBQ({ unitId, periodKey: period });
                setData(result.data);
            } catch (error) {
                console.error("Error fetching overview data", error);
                setError('Erro ao carregar visão geral.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [unitId, period]);

    if (loading) {
        return <div style={{ color: 'var(--text-muted)' }}>Carregando visão geral...</div>;
    }

    if (error) return <AnalyticsEmptyState type="error" />;

    if (!data) return null;

    const alertCards = [
        { label: 'Leitos com Bloqueador', value: data.bedsWithBlocker, filter: 'blocked', color: 'var(--danger)' },
        { label: 'Sem atualização (>24h)', value: data.staleBeds24h, filter: 'stale24h', color: 'var(--warning)' },
        { label: 'Pendências Kamishibai', value: data.pendingKamishibai, filter: 'kamishibai=pending', color: 'var(--warning)' },
        { label: 'Impedimentos Kamishibai', value: data.blockedKamishibai, filter: 'kamishibai=blocked', color: 'var(--danger)' },
    ];

    const contextCards = [
        { label: 'Leitos Ocupados', value: data.occupiedBeds },
        { label: 'Leitos Vagos', value: data.vacantBeds },
        { label: 'Pacientes Ativos', value: data.activePatients },
        { label: 'Altas < 24h', value: data.dischargeLt24h },
    ];

    const handleDrillDown = (filter: string) => {
        // Will open in a new tab to preserve the admin dashboard context
        window.open(`/editor?unit=${unitId}&filter=${filter}`, '_blank');
    };

    return (
        <div className="analytics-overview-cards">
            {/* CONTEXT SECTION */}
            <div className="analytics-exploration-section">
                <h4 className="analytics-exploration-subtitle">Visão de Contexto</h4>
                <div className="analytics-grid-4">
                    {contextCards.map((card, idx) => (
                        <div key={idx} className="mc-context-card">
                            <span className="mc-context-label">{card.label}</span>
                            <span className="mc-context-value">{card.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ALERTS SECTION (Historical/Exploration context) */}
            <div className="analytics-exploration-section">
                <h4 className="analytics-exploration-subtitle">Alertas no Período</h4>
                <div className="analytics-grid-4">
                    {alertCards.map((card, idx) => (
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
                                Abrir lista <span>→</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <AnalyticsContract
                metric="Situação Operacional e Alertas"
                universe="N = Leitos Ativos (Ocupados + Vagos) na unidade"
                window="agora"
                inclusionRule="Ignora leitos inativos ou bloqueados fisicamente que não fazem parte do censo."
            />
        </div>
    );
};

export default OverviewCards;
