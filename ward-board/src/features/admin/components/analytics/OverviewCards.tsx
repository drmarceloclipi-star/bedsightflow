import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import type { AnalyticsPeriodKey, AdminOverviewMetrics } from '../../../../domain/analytics';

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
                const getAdminOverviewBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, AdminOverviewMetrics>(functions, 'getAdminOverviewBQ');
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

    if (error) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{error}</div>;

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
    ];

    const handleDrillDown = (filter: string) => {
        // Will open in a new tab to preserve the admin dashboard context
        window.open(`/mobile?unit=${unitId}&filter=${filter}`, '_blank');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* ALERTS SECTION */}
            <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                    AGORA — Situação Operacional
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem'
                }}>
                    {alertCards.map((card, idx) => (
                        <div key={idx}
                            onClick={() => handleDrillDown(card.filter)}
                            style={{
                                backgroundColor: 'var(--bg-surface-1)',
                                padding: '1.25rem',
                                borderRadius: '8px',
                                border: `1px solid ${card.value > 0 ? card.color : 'var(--border-soft)'}`,
                                cursor: 'pointer',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', paddingRight: '2rem' }}>
                                {card.label}
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 600, color: card.value > 0 ? card.color : 'var(--text-primary)' }}>
                                {card.value}
                            </div>
                            <div style={{
                                marginTop: '1rem',
                                fontSize: '0.75rem',
                                color: 'var(--accent)',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                Abrir lista <span aria-hidden="true">→</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* CONTEXT SECTION */}
            <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Visão de Contexto</h4>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem'
                }}>
                    {contextCards.map((card, idx) => (
                        <div key={idx} style={{
                            backgroundColor: 'var(--bg-surface-2)',
                            padding: '1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-soft)',
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                {card.label}
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {card.value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OverviewCards;
