import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { useAuthStatus } from '../../../hooks/useAuthStatus';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../../infra/firebase/config';
import type { Bed, Pendency } from '../../../domain/types';
import { computeEscalations, DEFAULT_ESCALATION_THRESHOLDS } from '../../../domain/escalation';

type FilterKey =
    | 'blocked_now'
    | 'stale_24h'
    | 'kamishibai_impediment'
    | 'discharge_next_24h'
    | 'blocking_aging'
    | 'top_blocker'
    | 'unreviewed_shift'   // v1: UNREVIEWED_THIS_SHIFT (shiftKey)
    | 'blocked_aging'     // v1: sort por mainBlockerBlockedAt real
    | 'pendencies_open'   // v1: leitos com pendência aberta
    | 'pendencies_overdue' // v1: leitos com pendência vencida
    | 'escalations_overdue'
    | 'escalations_blocker';

const FILTER_META: Record<FilterKey, { title: string; description: string; icon: string }> = {
    blocked_now: {
        title: 'Leitos Bloqueados Agora',
        description: 'Leitos com mainBlocker preenchido, ordenados por tempo de bloqueio (mais antigos primeiro).',
        icon: '🔴',
    },
    stale_24h: {
        title: 'Sem Revisão >24h',
        description: 'Leitos não revisados nas últimas 24 horas (baseado em revisão Kamishibai, não em atualização geral).',
        icon: '⏱️',
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
        title: 'Bloqueios por Aging (legado)',
        description: 'Leitos bloqueados, ordenados por updatedAt (proxy). Use blocked_aging para aging real.',
        icon: '⏳',
    },
    top_blocker: {
        title: 'Top Bloqueador',
        description: 'Leitos com o motivo de bloqueio mais frequente no momento.',
        icon: '🏆',
    },
    unreviewed_shift: {
        title: 'Não Revisados neste Turno',
        description: 'Leitos ativos com pelo menos 1 domínio Kamishibai aplicável sem revisão neste turno (reviewedShiftKey ≠ turno atual).',
        icon: '🔵',
    },
    blocked_aging: {
        title: 'Bloqueios por Aging Real',
        description: 'Leitos bloqueados ordenados por mainBlockerBlockedAt (tempo real de bloqueio). Leitos sem esse campo são indicados com * (proxy updatedAt).',
        icon: '⏳',
    },
    pendencies_open: {
        title: 'Leitos com Pendências Abertas',
        description: 'Leitos com pelo menos 1 pendência operacional aberta (status=open), ordenados por número de pendências desc.',
        icon: '📋',
    },
    pendencies_overdue: {
        title: 'Leitos com Pendências Vencidas',
        description: 'Leitos com pelo menos 1 pendência cujo prazo (dueAt) já passou e status=open.',
        icon: '⚠️',
    },
    escalations_overdue: {
        title: '🔥 Escalonamento: Pendência de Longo Atraso',
        description: 'Pendências operacionais vencidas que excederam o tempo crítico configurado. Exige ação imediata.',
        icon: '🔥',
    },
    escalations_blocker: {
        title: '🔥 Escalonamento: Bloqueio Grave',
        description: 'Leitos bloqueados há tempo excessivo excedendo limite crítico configurado.',
        icon: '🔥',
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

// ShiftKey para filtragem client-side (mirror do resolveKamishibaiVisualState)
function clientShiftKey(): string {
    const now = new Date();
    const localStr = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now);
    const [datePart, timePart] = localStr.split(' ');
    const [h, m] = (timePart ?? '00:00').split(':').map(Number);
    const localMin = (h ?? 0) * 60 + (m ?? 0);
    if (localMin >= 7 * 60 && localMin < 19 * 60) return `${datePart}-AM`;
    if (localMin >= 19 * 60) return `${datePart}-PM`;
    const d = new Date((datePart ?? '') + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return `${d.toISOString().slice(0, 10)}-PM`;
}

// v1 schema fields not yet in Bed type (backwards-compat)
interface BedV1Extended {
    mainBlockerBlockedAt?: unknown;
    applicableDomains?: string[];
    pendencies?: Pendency[];
}

type BedRow = Bed & BedV1Extended & {
    _ageHours?: number;
    _agingProxied?: boolean; // mainBlockerBlockedAt ausente, proxy via updatedAt
};

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
            const currentShift = clientShiftKey();

            const bedsRef = collection(db, `units/${unitId}/beds`);
            const snap = await getDocs(query(bedsRef));

            let rows: BedRow[] = snap.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<Bed, 'id'>),
            }));

            // Apply client-side filter
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

                case 'blocked_aging': {
                    // v1: sort por mainBlockerBlockedAt real; fallback updatedAt com flag
                    rows = rows.filter(b => b.patientAlias?.trim() && b.mainBlocker?.trim());
                    rows = rows.map(b => {
                        const realMs = parseTimestampToMillis(b.mainBlockerBlockedAt);
                        if (realMs > 0) {
                            return { ...b, _ageHours: Math.round((now - realMs) / 3600000), _agingProxied: false };
                        }
                        const fallbackMs = parseTimestampToMillis(b.updatedAt);
                        return {
                            ...b,
                            _ageHours: fallbackMs ? Math.round((now - fallbackMs) / 3600000) : 0,
                            _agingProxied: true,
                        };
                    });
                    rows.sort((a, b) => (b._ageHours ?? 0) - (a._ageHours ?? 0));
                    break;
                }

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

                case 'kamishibai_impediment':
                    rows = rows.filter(b => {
                        if (!b.kamishibai || typeof b.kamishibai !== 'object') return false;
                        return Object.values(b.kamishibai as Record<string, { status: string }>).some(e => e.status === 'blocked');
                    });
                    break;

                case 'unreviewed_shift': {
                    // v1: leitos ativos com ≥1 domínio aplicável em UNREVIEWED_THIS_SHIFT
                    const DOMAINS = ['nursing', 'medical', 'physio', 'nutrition', 'social', 'psychology'];
                    rows = rows.filter(b => {
                        if (!b.patientAlias?.trim()) return false;
                        const kamishibai = (b.kamishibai ?? {}) as Record<string, { status?: string; reviewedShiftKey?: string }>;
                        const applicable: string[] = Array.isArray(b.applicableDomains) && (b.applicableDomains as string[]).length > 0
                            ? (b.applicableDomains as string[])
                            : DOMAINS;
                        return applicable.some(domain => {
                            const e = kamishibai[domain];
                            return e?.status !== 'blocked' && (!e?.reviewedShiftKey || e.reviewedShiftKey !== currentShift);
                        });
                    });
                    break;
                }

                case 'discharge_next_24h':
                    rows = rows.filter(b => b.expectedDischarge === '24h' && b.patientAlias?.trim());
                    break;

                case 'pendencies_open': {
                    // v1: leitos com ≥1 pendência aberta
                    rows = rows.filter(b =>
                        Array.isArray(b.pendencies) && b.pendencies.some(p => p.status === 'open')
                    );
                    // sort: mais pendências abertas primeiro
                    rows.sort((a, b) => {
                        const aOpen = (a.pendencies ?? []).filter(p => p.status === 'open').length;
                        const bOpen = (b.pendencies ?? []).filter(p => p.status === 'open').length;
                        return bOpen - aOpen;
                    });
                    break;
                }

                case 'pendencies_overdue': {
                    // v1: leitos com ≥1 pendência vencida
                    const nowMs = now;
                    rows = rows.filter(b =>
                        Array.isArray(b.pendencies) && b.pendencies.some(p => {
                            if (p.status !== 'open' || !p.dueAt) return false;
                            const ms = typeof p.dueAt === 'string'
                                ? new Date(p.dueAt).getTime()
                                : 0;
                            return ms > 0 && ms < nowMs;
                        })
                    );
                    rows.sort((a, b) => {
                        const overdue = (pArr: typeof a.pendencies) => (pArr ?? []).filter(p => {
                            if (p.status !== 'open' || !p.dueAt) return false;
                            const ms = typeof p.dueAt === 'string' ? new Date(p.dueAt).getTime() : 0;
                            return ms > 0 && ms < now;
                        }).length;
                        return overdue(b.pendencies) - overdue(a.pendencies);
                    });
                    break;
                }

                case 'escalations_overdue': {
                    const esc = computeEscalations(rows, DEFAULT_ESCALATION_THRESHOLDS, new Date(now));
                    rows = rows.filter(b => esc.overdueCriticalBedIds.includes(b.id));
                    break;
                }

                case 'escalations_blocker': {
                    const esc = computeEscalations(rows, DEFAULT_ESCALATION_THRESHOLDS, new Date(now));
                    rows = rows.filter(b => esc.blockerCriticalBedIds.includes(b.id));
                    break;
                }

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

    const showAgeCol = ['blocked_now', 'blocking_aging', 'stale_24h', 'blocked_aging'].includes(filter);

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
                            {showAgeCol && (
                                <th>{filter === 'blocked_aging' ? 'Tempo bloqueado' : 'Tempo sem atualização'}</th>
                            )}
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
                                {showAgeCol && (
                                    <td>
                                        <span className={`analytics-list-age${(bed._ageHours ?? 0) > 48 ? ' analytics-list-age--critical' : (bed._ageHours ?? 0) > 24 ? ' analytics-list-age--warning' : ''}`}>
                                            {formatAge(bed._ageHours)}
                                        </span>
                                        {/* v1: indicador de proxy para blocked_aging */}
                                        {filter === 'blocked_aging' && bed._agingProxied && (
                                            <span
                                                title="mainBlockerBlockedAt ausente — aging calculado via updatedAt (proxy)"
                                                style={{ marginLeft: '0.3rem', opacity: 0.6, cursor: 'help', fontSize: '0.75em' }}
                                            >
                                                *
                                            </span>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default AnalyticsListScreen;
