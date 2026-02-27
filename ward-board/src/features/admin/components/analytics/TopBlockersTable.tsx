import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../infra/firebase/config';
import type { AnalyticsPeriodKey, BlockerMetric } from '../../../../domain/analytics';

interface TopBlockersProps {
    unitId: string;
    period: AnalyticsPeriodKey;
}

const TopBlockersTable: React.FC<TopBlockersProps> = ({ unitId, period }) => {
    const [data, setData] = useState<BlockerMetric[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const getAdminTopBlockersBQ = httpsCallable<{ unitId: string, periodKey: AnalyticsPeriodKey }, BlockerMetric[]>(functions, 'getAdminTopBlockersBQ');
                const result = await getAdminTopBlockersBQ({ unitId, periodKey: period });
                setData(result.data);
            } catch (error) {
                console.error("Error fetching top blockers", error);
                setError('Erro ao carregar bloqueadores.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [unitId, period]);

    if (loading) {
        return <div style={{ color: 'var(--text-muted)' }}>Carregando bloqueadores...</div>;
    }

    if (error) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{error}</div>;

    if (!data || data.length === 0) return <div style={{ color: 'var(--text-muted)' }}>Nenhum bloqueador registrado no período.</div>;

    const maxOccurrences = Math.max(...data.map(b => b.count));

    return (
        <div style={{ backgroundColor: 'var(--bg-surface-1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', marginTop: 0, color: 'var(--text-primary)' }}>Top Bloqueadores</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-soft)' }}>
                        <th style={{ padding: '0.75rem 0', fontWeight: 600 }}>Motivo</th>
                        <th style={{ padding: '0.75rem 0', fontWeight: 600 }}>Ocorrências</th>
                        <th style={{ padding: '0.75rem 0', fontWeight: 600, width: '40%' }}>Impacto %</th>
                    </tr>
                </thead>
                <tbody>
                    {data.slice(0, 10).map((b, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                            <td style={{ padding: '0.75rem 0', color: 'var(--text-primary)' }}>{b.blocker}</td>
                            <td style={{ padding: '0.75rem 0', fontWeight: 600 }}>{b.count}</td>
                            <td style={{ padding: '0.75rem 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, backgroundColor: 'var(--bg-surface-2)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${(b.count / maxOccurrences) * 100}%`, backgroundColor: 'var(--accent)', height: '100%' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {((b.count / data.reduce((acc, curr) => acc + curr.count, 0)) * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TopBlockersTable;
