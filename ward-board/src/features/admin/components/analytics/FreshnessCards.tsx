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

    return (
        <div style={{ backgroundColor: 'var(--bg-surface-1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', marginTop: 0, color: 'var(--text-primary)' }}>Rastreio de Atualizações (Freshness)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-2)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Leitos +12h S/ Modificação</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--warning)' }}>
                        {data.stale12h}
                    </div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-2)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Leitos +24h S/ Modificação</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--danger)' }}>
                        {data.stale24h}
                    </div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-2)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Leitos +48h S/ Modificação</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--danger)' }}>
                        {data.stale48h}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FreshnessCards;
