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

    const cards = [
        { label: 'Pacientes Ativos', value: data.activePatients },
        { label: 'Leitos Ocupados', value: data.occupiedBeds },
        { label: 'Leitos Vagos', value: data.vacantBeds },
        { label: 'Altas < 24h', value: data.dischargeLt24h },
        { label: 'Leitos com Bloqueador', value: data.bedsWithBlocker },
        { label: 'Pendências Kamishibai', value: data.pendingKamishibai },
        { label: 'Impedimentos Kamishibai', value: data.blockedKamishibai },
        { label: 'Sem atualização (24h)', value: data.staleBeds24h },
    ];

    return (
        <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>Visão Geral</h3>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '1rem'
            }}>
                {cards.map((card, idx) => (
                    <div key={idx} style={{
                        backgroundColor: 'var(--bg-surface-1)',
                        padding: '1.25rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-soft)',
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                            {card.label}
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {card.value}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OverviewCards;
