import React, { useEffect, useState } from 'react';
import { AuditRepository, type AuditLogFilters } from '../../../repositories/AuditRepository';
import type { AuditLog } from '../../../domain/audit';

interface Props {
    unitId: string;
}

const MobileAuditScreen: React.FC<Props> = ({ unitId }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [filters, setFilters] = useState<AuditLogFilters>({});
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = AuditRepository.listenToAuditLogs(
            unitId,
            filters,
            (fetchedLogs) => {
                setLogs(fetchedLogs);
                setLoading(false);
                setErrorMsg(null);
            },
            (err) => {
                if (err.message.includes('FAILED_PRECONDITION') && err.message.includes('index')) {
                    setErrorMsg('O Firestore exige um índice. Crie no console do Firebase.');
                } else {
                    setErrorMsg(`Erro: ${err.message}`);
                }
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [unitId, filters]);

    const formatDate = (timestamp: unknown) => {
        if (!timestamp) return 'N/A';
        const ts = timestamp as { toDate?: () => Date };
        const d = ts.toDate ? ts.toDate() : new Date(timestamp as string | number);
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(d);
    };

    const clearFilters = () => setFilters({});
    const hasFilters = Object.keys(filters).length > 0;

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    return (
        <div className="madmin-screen-pad">
            <div className="madmin-screen-header-stack">
                <h2 className="madmin-screen-title">Logs de Auditoria</h2>
                <p className="madmin-screen-subtitle">Trilha append-only de operações críticas.</p>
            </div>

            {/* Compact filters */}
            <div className="madmin-audit-filters">
                <select
                    value={filters.action || ''}
                    onChange={e => setFilters(f => ({ ...f, action: e.target.value || undefined }))}
                    className="madmin-select"
                >
                    <option value="">Todas as Ações</option>
                    <option value="CREATE_BED">Criar Leito</option>
                    <option value="UPDATE_BED">Atualizar Leito</option>
                    <option value="MARK_BED_CLEAN">Leito Limpo</option>
                    <option value="PATIENT_ADMIT">Admitir Paciente</option>
                    <option value="PATIENT_DISCHARGE">Alta</option>
                    <option value="PATIENT_TRANSFER">Transferência</option>
                    <option value="TV_SETTINGS_UPDATE">Config. TV</option>
                    <option value="UPDATE_UNIT_USERS">Config. Usuários</option>
                    <option value="CLEAR_UNIT_BEDS">Limpeza Batch</option>
                </select>
                <select
                    value={filters.entityType || ''}
                    onChange={e => setFilters(f => ({ ...f, entityType: (e.target.value as 'bed' | 'unit' | 'unit_user' | 'board_settings' | 'system') || undefined }))}
                    className="madmin-select"
                >
                    <option value="">Todas Entidades</option>
                    <option value="bed">Leito</option>
                    <option value="unit">Unidade</option>
                    <option value="unit_user">Usuário</option>
                    <option value="board_settings">Configurações</option>
                    <option value="system">Sistema</option>
                </select>
                {hasFilters && (
                    <button onClick={clearFilters} className="madmin-btn madmin-btn-outline madmin-btn-sm">
                        Limpar Filtros
                    </button>
                )}
            </div>

            {errorMsg && (
                <div className="madmin-error-banner">
                    <strong>Ops!</strong> {errorMsg}
                </div>
            )}

            {loading ? (
                <div className="madmin-loading-area">
                    <div className="animate-pulse text-muted">Carregando logs...</div>
                </div>
            ) : logs.length === 0 ? (
                <div className="madmin-empty-state">
                    <p>Nenhum log encontrado{hasFilters ? ' para estes filtros' : ''}.</p>
                </div>
            ) : (
                <div className="madmin-list">
                    {logs.map(log => (
                        <div key={log.id} className="madmin-audit-card">
                            {/* Summary row — always visible */}
                            <button
                                className="madmin-audit-summary"
                                onClick={() => toggleExpand(log.id!)}
                                aria-expanded={expandedId === log.id}
                            >
                                <div className="madmin-audit-left">
                                    <span className="madmin-audit-action-badge">{log.action}</span>
                                    <span className="madmin-audit-actor">
                                        {log.actor.displayName || log.actor.email}
                                    </span>
                                </div>
                                <div className="madmin-audit-right">
                                    <span className="madmin-audit-date">{formatDate(log.createdAt)}</span>
                                    <span className="madmin-audit-chevron">
                                        {expandedId === log.id ? '▲' : '▼'}
                                    </span>
                                </div>
                            </button>

                            {/* Expanded detail */}
                            {expandedId === log.id && (
                                <div className="madmin-audit-detail">
                                    <div className="madmin-audit-meta-row">
                                        <span className="madmin-audit-meta-label">Alvo</span>
                                        <span className="madmin-audit-meta-value">
                                            {log.entityType}: {log.entityId}
                                        </span>
                                    </div>
                                    {log.reason && (
                                        <div className="madmin-audit-meta-row">
                                            <span className="madmin-audit-meta-label">Motivo</span>
                                            <span className="madmin-audit-meta-value">{log.reason}</span>
                                        </div>
                                    )}
                                    <div className="madmin-audit-meta-row">
                                        <span className="madmin-audit-meta-label">E-mail</span>
                                        <span className="madmin-audit-meta-value">{log.actor.email}</span>
                                    </div>
                                    <div className="madmin-audit-code-block">
                                        <pre className="madmin-audit-pre">
                                            {JSON.stringify(
                                                (log.diff || log.after || log.before || {}) as Record<string, unknown>,
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </div>
                                    <div className="madmin-audit-quick-actions">
                                        <button
                                            onClick={() => setFilters({ action: log.action })}
                                            className="madmin-btn madmin-btn-outline madmin-btn-xs"
                                        >
                                            Filtrar ação
                                        </button>
                                        <button
                                            onClick={() => setFilters({ actorUid: log.actor.uid })}
                                            className="madmin-btn madmin-btn-outline madmin-btn-xs"
                                        >
                                            Filtrar ator
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MobileAuditScreen;
