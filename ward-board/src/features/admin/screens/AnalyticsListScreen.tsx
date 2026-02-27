import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { useAuthStatus } from '../../../hooks/useAuthStatus';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../../infra/firebase/config';
import type { Bed } from '../../../domain/types';

type FilterKey =
    | 'blocked_now'
    | 'stale_24h'
    | 'kamishibai_pending'
    | 'kamishibai_impediment'
    | 'discharge_next_24h'
    | 'blocking_aging'
    | 'top_blocker';

const FILTER_META: Record<FilterKey, { title: string; description: string; icon: string }> = {
    blocked_now: {
        title: 'Leitos Bloqueados Agora',
        description: 'Leitos com mainBlocker preenchido, ordenados por tempo de atualização (mais antigos primeiro).',
        icon: '🔴',
    },
    stale_24h: {
        title: 'Sem Atualização >24h',
        description: 'Leitos não atualizados nas últimas 24 horas, ordenados do mais antigo.',
        icon: '⏱️',
    },
    kamishibai_pending: {
        title: 'Pendências Kamishibai (Modo A)',
        description: 'Leitos com pelo menos 1 domínio Kamishibai com status "pending".',
        icon: '🟡',
    },
    kamishibai_impediment: {
        title: 'Impedimentos Kamishibai',
        description: 'Leitos com pelo menos 1 domínio Kamishibai com status "blocked".',
        icon: '🟠',
    },
    discharge_next_24h: {
        title: 'Altas Esperadas nas Próximas 24h',
        description: 'Leitos com expectedDischarge = "24h".',
        icon: '🟢',
    },
    blocking_aging: {
        title: 'Bloqueios por Aging',
        description: 'Leitos bloqueados, ordenados por tempo desde a última atualização (mais antigos primeiro).',
        icon: '⏳',
    },
    top_blocker: {
        title: 'Top Bloqueador',
        description: 'Leitos com o motivo de bloqueio mais frequente no momento.',
        icon: '🏆',
    },
};

const parseTimestampToMillis = (raw: unknown): number => {
    if (!raw) return 0;
    if (typeof raw === 'string') return new Date(raw).getTime();
    if (typeof raw === 'object' && raw !== null && 'toMillis' in raw && typeof (raw as { toMillis: () => number }).toMillis === 'function') {
        return (raw as { toMillis: () => number }).toMillis();
    }
    return 0;
};

type BedRow = Bed & { _ageHours?: number };

const AnalyticsListScreen: React.FC = () => {
    const { unitId } = useParams<{ unitId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { isAdmin, loading: authLoading } = useAuthStatus();

    const filter = (searchParams.get('filter') ?? 'blocked_now') as FilterKey;
    const meta = FILTER_META[filter] ?? FILTER_META['blocked_now'];

    const [beds, setBeds] = useState<BedRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBeds = useCallback(async () => {
        if (!unitId || !isAdmin) return;
        setLoading(true);
        setError(null);
        try {
            const now = Date.now();
            const ms24h = 24 * 60 * 60 * 1000;

            const bedsRef = collection(db, `units/${unitId}/beds`);
            const snap = await getDocs(query(bedsRef));

            let rows: BedRow[] = snap.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<Bed, 'id'>),
            }));

            // Apply client-side filter (avoids composite index requirements)
            switch (filter) {
                case 'blocked_now':
                case 'blocking_aging':
                case 'top_blocker':
                    rows = rows.filter(b => b.patientAlias?.trim() && b.mainBlocker?.trim());
                    rows = rows.map(b => {
                        const ms = parseTimestampToMillis(b.updatedAt);
                        return { ...b, _ageHours: ms ? Math.round((now - ms) / 3600000) : 0 };
                    });
                    rows.sort((a, b) => (b._ageHours ?? 0) - (a._ageHours ?? 0));
                    break;

                case 'stale_24h':
                    rows = rows.filter(b => {
                        const ms = parseTimestampToMillis(b.updatedAt);
                        if (!ms) return true;
                        return now - ms > ms24h;
                    });
                    rows = rows.map(b => {
                        const ms = parseTimestampToMillis(b.updatedAt);
                        return { ...b, _ageHours: ms ? Math.round((now - ms) / 3600000) : 0 };
                    });
                    rows.sort((a, b) => (b._ageHours ?? 0) - (a._ageHours ?? 0));
                    break;

                case 'kamishibai_pending':
                    rows = rows.filter(b => {
                        if (!b.kamishibai || typeof b.kamishibai !== 'object') return false;
                        return Object.values(b.kamishibai as Record<string, { status: string }>).some(e => e.status === 'pending');
                    });
                    break;

                case 'kamishibai_impediment':
                    rows = rows.filter(b => {
                        if (!b.kamishibai || typeof b.kamishibai !== 'object') return false;
                        return Object.values(b.kamishibai as Record<string, { status: string }>).some(e => e.status === 'blocked');
                    });
                    break;

                case 'discharge_next_24h':
                    rows = rows.filter(b => b.expectedDischarge === '24h' && b.patientAlias?.trim());
                    break;

                default:
                    break;
            }

            setBeds(rows);
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar lista de leitos.');
        } finally {
            setLoading(false);
        }
    }, [unitId, filter, isAdmin]);

    useEffect(() => {
        fetchBeds();
    }, [fetchBeds]);

    const formatAge = (hours?: number) => {
        if (!hours) return '—';
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    };

    if (authLoading) return <div className="analytics-list-loading">Carregando...</div>;
    if (!isAdmin) return <Navigate to="/login" replace />;

    return (
        <div className="analytics-list-screen">
            {/* Header */}
            <div className="analytics-list-header">
                <button
                    className="btn btn-outline analytics-list-back"
                    onClick={() => navigate(-1)}
                    type="button"
                >
                    ← Voltar
                </button>
                <div className="analytics-list-title-group">
                    <span className="analytics-list-icon">{meta.icon}</span>
                    <div>
                        <h2 className="analytics-list-title">{meta.title}</h2>
                        <p className="analytics-list-description">{meta.description}</p>
                    </div>
                </div>
                <span className="analytics-list-count">
                    {loading ? '...' : `${beds.length} leito${beds.length !== 1 ? 's' : ''}`}
                </span>
            </div>

            {/* Body */}
            {loading && (
                <div className="analytics-list-loading">Carregando lista...</div>
            )}
            {error && (
                <div className="analytics-list-error">{error}</div>
            )}
            {!loading && !error && beds.length === 0 && (
                <div className="analytics-list-empty">
                    <span className="analytics-list-empty-icon">✅</span>
                    <p>Nenhum leito encontrado para este filtro.</p>
                </div>
            )}
            {!loading && beds.length > 0 && (
                <table className="analytics-list-table">
                    <thead>
                        <tr>
                            <th>Leito</th>
                            <th>Paciente</th>
                            <th>Bloqueador</th>
                            <th>Alta esperada</th>
                            {filter === 'blocked_now' || filter === 'blocking_aging' || filter === 'stale_24h' ? (
                                <th>Tempo sem atualização</th>
                            ) : null}
                        </tr>
                    </thead>
                    <tbody>
                        {beds.map(bed => (
                            <tr key={bed.id}>
                                <td className="analytics-list-bed-num">{bed.number}</td>
                                <td>{bed.patientAlias || <span className="text-muted">—</span>}</td>
                                <td>
                                    {bed.mainBlocker ? (
                                        <span className="analytics-list-blocker-tag">{bed.mainBlocker}</span>
                                    ) : (
                                        <span className="text-muted">—</span>
                                    )}
                                </td>
                                <td>{bed.expectedDischarge === '24h' ? '< 24h' : bed.expectedDischarge ?? '—'}</td>
                                {filter === 'blocked_now' || filter === 'blocking_aging' || filter === 'stale_24h' ? (
                                    <td>
                                        <span className={`analytics-list-age${(bed._ageHours ?? 0) > 48 ? ' analytics-list-age--critical' : (bed._ageHours ?? 0) > 24 ? ' analytics-list-age--warning' : ''}`}>
                                            {formatAge(bed._ageHours)}
                                        </span>
                                    </td>
                                ) : null}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default AnalyticsListScreen;
