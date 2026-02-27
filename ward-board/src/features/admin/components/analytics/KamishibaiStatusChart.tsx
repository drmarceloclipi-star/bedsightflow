import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import type { AnalyticsPeriodKey, KamishibaiStatusBreakdown, KamishibaiDomainMetric } from '../../../../domain/analytics';

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
                const getAdminKamishibaiStatsBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, KamishibaiResult>(functions, 'getAdminKamishibaiStatsBQ');
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
        return <div style={{ color: 'var(--text-muted)' }}>Carregando métricas Kamishibai...</div>;
    }

    if (error) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{error}</div>;

    if (!data) return null;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Distribution */}
            <div style={{ backgroundColor: 'var(--bg-surface-1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', marginTop: 0, color: 'var(--text-primary)' }}>Distribuição de Status Globais</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--success)' }}>OK</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{data.distribution.ok}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--warning)' }}>Pendências</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{data.distribution.pending}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>Bloqueios</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{data.distribution.blocked}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Não Aplicável</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{data.distribution.na}</span>
                    </div>
                </div>
            </div>

            {/* By Domain */}
            <div style={{ backgroundColor: 'var(--bg-surface-1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', marginTop: 0, color: 'var(--text-primary)' }}>Por Domínio</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {data.byDomain.map((domain, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '120px', fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>{domain.domain}</div>
                            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                                {domain.pending > 0 && <span style={{ color: 'var(--warning)' }}>{domain.pending} pend.</span>}
                                {domain.blocked > 0 && <span style={{ color: 'var(--danger)' }}>{domain.blocked} bloq.</span>}
                                {domain.pending === 0 && domain.blocked === 0 && <span style={{ color: 'var(--success)' }}>Tudo OK</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default KamishibaiStatusChart;
