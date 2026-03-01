import React, { useEffect, useState } from 'react';
import { AuditRepository, type AuditLogFilters } from '../../../repositories/AuditRepository';
import type { AuditLog } from '../../../domain/audit';

interface AuditScreenProps {
    unitId: string;
}

const AuditScreen: React.FC<AuditScreenProps> = ({ unitId }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [filters, setFilters] = useState<AuditLogFilters>({});
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    useEffect(() => {
        // Reset state via a transition to avoid cascading renders inside the effect body
        let firstLoad = true;

        const unsubscribe = AuditRepository.listenToAuditLogs(unitId, filters, (fetchedLogs) => {
            if (firstLoad) {
                // Clear selection and any stale error on the first emission of the new subscription
                setSelectedLog(null);
                setErrorMsg(null);
                firstLoad = false;
            }
            setLogs(fetchedLogs);
            setLoading(false);
        }, (err) => {
            firstLoad = false;
            if (err.message.includes('FAILED_PRECONDITION') && err.message.includes('index')) {
                setErrorMsg('O Firestore exige a criação de um índice (Composite Index) para esta combinação de filtros. Por favor, crie no console do Firebase e tente novamente mais tarde.');
            } else {
                setErrorMsg(`Erro ao carregar logs: ${err.message}`);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [unitId, filters]);

    const formatDate = (timestamp: unknown) => {
        if (!timestamp) return 'N/A';
        const ts = timestamp as { toDate?: () => Date };
        const d = ts.toDate ? ts.toDate() : new Date(timestamp as string | number);
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(d);
    };

    const clearFilters = () => setFilters({});

    return (
        <div className="audit-page">
            <div>
                <h2 className="audit-page-title">Logs de Auditoria</h2>
                <p className="audit-page-subtitle">Trilha de auditoria (append-only) de operações críticas.</p>
            </div>

            {/* Action Bar / Filters */}
            <div className="audit-filters">
                <div className="audit-filter-group">
                    <label className="audit-filter-label">Ação</label>
                    <select
                        value={filters.action || ''}
                        onChange={(e) => setFilters(f => ({ ...f, action: e.target.value || undefined }))}
                        className="audit-filter-select"
                    >
                        <option value="">Todas as Ações</option>
                        <option value="CREATE_BED">Criar Leito</option>
                        <option value="UPDATE_BED">Atualizar Leito</option>
                        <option value="MARK_BED_CLEAN">Leito Limpo</option>
                        <option value="PATIENT_ADMIT">Admitir Paciente</option>
                        <option value="PATIENT_DISCHARGE">Alta de Paciente</option>
                        <option value="PATIENT_TRANSFER">Transferência</option>
                        <option value="TV_SETTINGS_UPDATE">Config. TV</option>
                        <option value="UPDATE_UNIT_USERS">Config. Usuários</option>
                        <option value="CLEAR_UNIT_BEDS">Limpeza Batch</option>
                    </select>
                </div>

                <div className="audit-filter-group">
                    <label className="audit-filter-label">Entidade</label>
                    <select
                        value={filters.entityType || ''}
                        onChange={(e) => setFilters(f => ({ ...f, entityType: (e.target.value as 'bed' | 'unit' | 'unit_user' | 'board_settings' | 'system') || undefined }))}
                        className="audit-filter-select"
                    >
                        <option value="">Todas Entidades</option>
                        <option value="bed">Leito (bed)</option>
                        <option value="unit">Unidade (unit)</option>
                        <option value="unit_user">Usuário da Unidade</option>
                        <option value="board_settings">Configurações (board_settings)</option>
                        <option value="system">Sistema (system)</option>
                    </select>
                </div>

                <div className="audit-filter-group">
                    <label className="audit-filter-label">UID do Usuário</label>
                    <input
                        type="text"
                        placeholder="Ex: 8Xf...qA2"
                        value={filters.actorUid || ''}
                        onChange={(e) => setFilters(f => ({ ...f, actorUid: e.target.value || undefined }))}
                        className="audit-filter-input"
                    />
                </div>

                {Object.keys(filters).length > 0 && (
                    <button onClick={clearFilters} className="audit-btn-clear">
                        Limpar Filtros
                    </button>
                )}
            </div>

            {errorMsg && (
                <div className="settings-error-banner">
                    <strong className="text-danger">Ops!</strong>{' '}
                    <span className="text-danger">{errorMsg}</span>
                </div>
            )}

            <div className="audit-layout">
                {/* Lista principal */}
                <div className="audit-table-wrapper">
                    {loading ? (
                        <div className="p-8 text-center text-muted">Carregando trilha de auditoria...</div>
                    ) : (
                        <div className="audit-table-container">
                            <table className="audit-table">
                                <thead>
                                    <tr>
                                        <th>Quando</th>
                                        <th>Quem</th>
                                        <th>Ação</th>
                                        <th>Alvo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr
                                            key={log.id}
                                            className={selectedLog?.id === log.id ? 'audit-row--selected' : ''}
                                            onClick={() => setSelectedLog(log)}
                                        >
                                            <td className="text-muted">{formatDate(log.createdAt)}</td>
                                            <td className="audit-td-overflow">
                                                <div className="audit-actor-name">{log.actor.displayName || 'Usuário Desconhecido'}</div>
                                                <div className="audit-actor-email">{log.actor.email}</div>
                                            </td>
                                            <td>
                                                <span className="audit-action-badge">{log.action}</span>
                                            </td>
                                            <td className="audit-td-overflow">
                                                <span className="audit-entity-type">{log.entityType}:</span> {log.entityId}
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr className="audit-empty-row">
                                            <td colSpan={4}>Nenhum log encontrado para estes filtros.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Painel lateral de detalhes */}
                {selectedLog && (
                    <div className="audit-inspector animate-slideIn">
                        <div className="audit-inspector-header">
                            <h3 className="audit-inspector-title">Log Inspector</h3>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="audit-inspector-close"
                                aria-label="Fechar painel"
                            >&times;</button>
                        </div>

                        <div className="audit-inspector-body">

                            {/* Metadados Base */}
                            <div className="audit-meta-grid">
                                <div>
                                    <span className="audit-meta-label">ID do Log</span>
                                    <span className="audit-meta-value audit-meta-value--mono">{selectedLog.id}</span>
                                </div>
                                <div>
                                    <span className="audit-meta-label">Data/Hora</span>
                                    <span className="audit-meta-value">{formatDate(selectedLog.createdAt)}</span>
                                </div>
                                <div>
                                    <span className="audit-meta-label">Plataforma Origem</span>
                                    <span className="audit-meta-value audit-meta-value--capitalize">
                                        {selectedLog.source.appArea} {selectedLog.source.feature ? `› ${selectedLog.source.feature}` : ''}
                                    </span>
                                </div>
                                <div>
                                    <span className="audit-meta-label">Alvo ({selectedLog.entityType})</span>
                                    <span className="audit-meta-value audit-meta-value--capitalize">{selectedLog.entityId}</span>
                                </div>
                            </div>

                            {/* Justificativa */}
                            {selectedLog.reason && (
                                <div>
                                    <span className="audit-reason-label">
                                        <span>⚠️</span> Reason / System Flag
                                    </span>
                                    <div className="audit-reason-box">
                                        {selectedLog.reason}
                                    </div>
                                </div>
                            )}

                            {/* Diff ou After */}
                            <div>
                                <span className="audit-diff-label">
                                    {selectedLog.diff ? 'Alterações Identificadas (Diff)' : (selectedLog.after ? 'Estado Atualizado' : 'Payload Completo')}
                                </span>
                                <div className="audit-code-block">
                                    <pre className="audit-code-pre">
                                        {JSON.stringify((selectedLog.diff || selectedLog.after || selectedLog.before || {}) as Record<string, unknown>, null, 2)}
                                    </pre>
                                </div>
                            </div>

                            {/* Ações Rápidas */}
                            <div className="audit-actions">
                                <button
                                    onClick={() => setFilters({ action: selectedLog.action })}
                                    className="audit-action-btn"
                                >
                                    Filtrar mesma Ação
                                </button>
                                <button
                                    onClick={() => setFilters({ actorUid: selectedLog.actor.uid })}
                                    className="audit-action-btn"
                                >
                                    Filtrar mesmo Ator
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default AuditScreen;
