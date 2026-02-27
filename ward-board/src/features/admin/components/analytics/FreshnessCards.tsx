import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import type { AnalyticsPeriodKey, FreshnessMetrics } from '../../../../domain/analytics';

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
                const getAdminFreshnessBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, FreshnessMetrics>(functions, 'getAdminFreshnessBQ');
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

    if (error) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{error}</div>;

    if (!data) return null;

    const handleDrillDown = (filter: string) => {
        window.open(`/mobile?unit=${unitId}&filter=${filter}`, '_blank');
    };

    const freshnessCards = [
        { label: 'Leitos +12h S/ Modificação', value: data.stale12h, filter: 'stale12h', color: 'var(--warning)' },
        { label: 'Leitos +24h S/ Modificação', value: data.stale24h, filter: 'stale24h', color: 'var(--danger)' },
        { label: 'Leitos +48h S/ Modificação', value: data.stale48h, filter: 'stale48h', color: 'var(--danger)' }
    ];

    return (
        <div style={{ backgroundColor: 'var(--bg-surface-1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', marginTop: 0, color: 'var(--text-primary)' }}>Rastreio de Atualizações (Freshness)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                {freshnessCards.map((card, idx) => (
                    <div key={idx}
                        onClick={() => handleDrillDown(card.filter)}
                        style={{
                            padding: '1rem',
                            backgroundColor: 'var(--bg-surface-2)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            border: `1px solid ${card.value > 0 ? card.color : 'transparent'}`
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{card.label}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: card.value > 0 ? card.color : 'var(--text-primary)' }}>
                            {card.value}
                        </div>
                        <div style={{
                            marginTop: '0.75rem',
                            fontSize: '0.75rem',
                            color: 'var(--accent)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            Ver leitos <span aria-hidden="true">→</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FreshnessCards;
