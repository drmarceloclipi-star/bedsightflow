import React, { useState, useEffect } from 'react';
import { functions } from '../../../infra/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { CLOUD_FUNCTIONS } from '../../../constants/functionNames';
import { UnitUsersRepository } from '../../../repositories/UnitUsersRepository';
import type { UnitUserRole, UnitRole } from '../../../domain/types';
import ConfirmModal from '../../../shared/components/ConfirmModal';

interface Props {
    unitId: string;
}

const ROLE_LABELS: Record<UnitRole, string> = {
    admin: 'Líder Admin',
    editor: 'Editor',
    viewer: 'Visualizador',
};

const MobileUsersAdminScreen: React.FC<Props> = ({ unitId }) => {
    const [users, setUsers] = useState<UnitUserRole[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<UnitRole>('editor');
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [msgType, setMsgType] = useState<'success' | 'error'>('success');
    const flashTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const [modalConfig, setModalConfig] = useState<{
        title: string;
        description: string;
        confirmLabel: string;
        onConfirm: (reason: string) => Promise<void>;
    } | null>(null);

    useEffect(() => {
        return () => {
            if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const unsub = UnitUsersRepository.listenToUsers(unitId, (data) => {
            setUsers(data);
            setLoading(false);
        });
        return unsub;
    }, [unitId]);

    const flash = (text: string, type: 'success' | 'error' = 'success') => {
        setMsg(text);
        setMsgType(type);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setMsg(''), 4000);
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail) return;

        setModalConfig({
            title: 'Adicionar Usuário',
            description: `Autorizar ${newEmail} como ${ROLE_LABELS[newRole]} nesta unidade?`,
            confirmLabel: 'Adicionar Usuário',
            onConfirm: async (reason) => {
                setSubmitting(true);
                try {
                    const setRoleFn = httpsCallable(functions, CLOUD_FUNCTIONS.SET_UNIT_USER_ROLE);
                    await setRoleFn({ unitId, email: newEmail.toLowerCase().trim(), role: newRole, reason });
                    setNewEmail('');
                    flash(`✓ ${newEmail} adicionado com sucesso.`);
                } catch (err: unknown) {
                    const errorMsg = (err as { message?: string })?.message || 'Erro ao adicionar usuário.';
                    flash(errorMsg, 'error');
                } finally {
                    setSubmitting(false);
                }
            }
        });
    };

    const handleRoleChange = (userId: string, email: string, role: UnitRole) => {
        setModalConfig({
            title: 'Alterar Nível de Acesso',
            description: `Mudar o acesso de ${email} para ${ROLE_LABELS[role]}?`,
            confirmLabel: 'Confirmar Alteração',
            onConfirm: async (reason) => {
                const setRoleFn = httpsCallable(functions, CLOUD_FUNCTIONS.SET_UNIT_USER_ROLE);
                await setRoleFn({ unitId, userUid: userId, email, role, reason });
                flash('Role atualizado com sucesso.');
            }
        });
    };

    const handleRemove = (userId: string, email: string) => {
        setModalConfig({
            title: 'Remover Usuário',
            description: `Remover o acesso de ${email} nesta unidade?`,
            confirmLabel: 'Remover Acesso',
            onConfirm: async (reason) => {
                const removeFn = httpsCallable(functions, CLOUD_FUNCTIONS.REMOVE_UNIT_USER);
                await removeFn({ unitId, userUid: userId, reason });
                flash(`${email} removido da unidade.`);
            }
        });
    };

    return (
        <div className="madmin-screen-pad">
            <div className="madmin-screen-header-stack">
                <h2 className="madmin-screen-title">Acesso na Unidade</h2>
                <p className="madmin-screen-subtitle">Controle quem pode editar e visualizar</p>
            </div>

            {msg && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`madmin-flash ${msgType === 'error' ? 'state-danger-bg' : 'state-success-bg'}`}
                >
                    {msg}
                </div>
            )}

            {/* Add user form */}
            <div className="madmin-card">
                <div className="madmin-card-label">Novo Usuário</div>
                <form onSubmit={handleAddUser} className="madmin-form-stack">
                    <input
                        type="email"
                        className="madmin-input"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="usuario@instituicao.com.br"
                        required
                    />
                    <select
                        className="madmin-select"
                        value={newRole}
                        onChange={e => setNewRole(e.target.value as UnitRole)}
                    >
                        {(Object.keys(ROLE_LABELS) as UnitRole[]).map(role => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        disabled={submitting}
                        className={`madmin-btn madmin-btn-full ${submitting ? 'madmin-btn-disabled' : 'madmin-btn-primary'}`}
                    >
                        {submitting ? 'Adicionando...' : 'Adicionar'}
                    </button>
                </form>
            </div>

            {/* Users list */}
            <div className="madmin-section-label">
                Acesso na Unidade ({users.length})
            </div>

            {loading ? (
                <div className="madmin-loading-area">
                    <div className="animate-pulse text-muted">Carregando usuários...</div>
                </div>
            ) : users.length === 0 ? (
                <div className="madmin-empty-state">
                    <p>Nenhum usuário cadastrado.</p>
                </div>
            ) : (
                <div className="madmin-list">
                    {users.map(user => (
                        <div key={user.id} className="madmin-card madmin-user-manage-card">
                            <div className="madmin-user-email">{user.email}</div>
                            <div className="madmin-user-card-actions">
                                <select
                                    className="madmin-select madmin-select-sm"
                                    value={user.role}
                                    onChange={e => user.id && handleRoleChange(user.id, user.email, e.target.value as UnitRole)}
                                >
                                    {(Object.keys(ROLE_LABELS) as UnitRole[]).map(role => (
                                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => user.id && handleRemove(user.id, user.email)}
                                    className="madmin-btn-danger-link"
                                >
                                    Remover
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalConfig && (
                <ConfirmModal
                    isOpen={true}
                    title={modalConfig.title}
                    description={modalConfig.description}
                    confirmLabel={modalConfig.confirmLabel}
                    onConfirm={async (reason) => {
                        await modalConfig.onConfirm(reason);
                        setModalConfig(null);
                    }}
                    onClose={() => setModalConfig(null)}
                />
            )}
        </div>
    );
};

export default MobileUsersAdminScreen;
