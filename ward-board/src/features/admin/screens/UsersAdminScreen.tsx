import React, { useState, useEffect } from 'react';
import { functions } from '../../../infra/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { CLOUD_FUNCTIONS } from '../../../constants/functionNames';
import { UnitUsersRepository } from '../../../repositories/UnitUsersRepository';
import type { UnitUserRole, UnitRole } from '../../../domain/types';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { useAuthStatus } from '../../../hooks/useAuthStatus';

interface Props {
    unitId: string;
}

const ROLE_LABELS: Record<UnitRole, string> = {
    admin: 'Líder Admin',
    editor: 'Editor',
    viewer: 'Visualizador',
};

const UsersAdminScreen: React.FC<Props> = ({ unitId }) => {
    const [users, setUsers] = useState<UnitUserRole[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<UnitRole>('editor');
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [msgType, setMsgType] = useState<"success" | "error">('success');

    const { isAdmin } = useAuthStatus();
    const availableRoles = (Object.keys(ROLE_LABELS) as UnitRole[]).filter(role => isAdmin ? true : role !== 'admin');

    const [modalConfig, setModalConfig] = useState<{
        title: string;
        description: string;
        confirmLabel: string;
        onConfirm: (reason: string) => Promise<void>;
    } | null>(null);

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
        setTimeout(() => setMsg(''), 4000);
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail) return;

        setModalConfig({
            title: 'Adicionar Usuário',
            description: `Autorizar o e-mail ${newEmail} como ${ROLE_LABELS[newRole]} nesta unidade?`,
            confirmLabel: 'Adicionar Usuário',
            onConfirm: async (reason) => {
                setSubmitting(true);
                try {
                    const setRoleFn = httpsCallable(functions, CLOUD_FUNCTIONS.SET_UNIT_USER_ROLE);
                    await setRoleFn({
                        unitId,
                        email: newEmail.toLowerCase().trim(),
                        role: newRole,
                        reason,
                    });
                    setNewEmail('');
                    flash(`✓ ${newEmail} adicionado com sucesso.`);
                } catch (err: unknown) {
                    console.error(err);
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
            description: `Tem certeza que deseja remover o acesso de ${email} nesta unidade?`,
            confirmLabel: 'Remover Acesso',
            onConfirm: async (reason) => {
                const removeFn = httpsCallable(functions, CLOUD_FUNCTIONS.REMOVE_UNIT_USER);
                await removeFn({ unitId, userUid: userId, reason });
                flash(`${email} removido da unidade.`);
            }
        });
    };

    return (
        <div className="admin-screen">
            <header className="admin-screen-header">
                <div>
                    <h2 className="admin-screen-title">Acesso na Unidade</h2>
                    <p className="admin-screen-subtitle">Controle quem pode editar e visualizar este painel</p>
                </div>
            </header>

            {msg && (
                <div className={`flash-message ${msgType === 'success' ? 'state-success-bg' : 'state-danger-bg'}`}>
                    {msg}
                </div>
            )}

            <div className="admin-card p-6">
                <h3 className="text-sm font-bold mb-4 uppercase tracking-wider text-muted">Novo Usuário</h3>
                <form onSubmit={handleAddUser} className="flex gap-4 flex-wrap">
                    <input
                        type="email"
                        className="admin-input flex-1 min-w-[300px]"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="usuario@instituicao.com.br"
                        required
                    />
                    <select
                        className="admin-select min-w-[150px]"
                        value={newRole}
                        onChange={e => setNewRole(e.target.value as UnitRole)}
                    >
                        {availableRoles.map(role => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="btn btn-primary"
                    >
                        {submitting ? 'Adicionando...' : 'Adicionar'}
                    </button>
                </form>
            </div>

            <div className="admin-card">
                <div className="p-4 border-b">
                    <span className="font-bold">Acesso na Unidade ({users.length})</span>
                </div>
                {loading ? (
                    <div className="p-12 text-center text-muted">Carregando lista de usuários...</div>
                ) : users.length === 0 ? (
                    <div className="p-12 text-center text-muted italic">Nenhum usuário cadastrado.</div>
                ) : (
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>E-mail</th>
                                    <th>Nível de Acesso</th>
                                    <th className="text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td className="font-medium">{user.email}</td>
                                        <td>
                                            <select
                                                className="admin-select py-1 text-sm bg-surface-2"
                                                value={user.role}
                                                onChange={e => user.id && handleRoleChange(user.id, user.email, e.target.value as UnitRole)}
                                                disabled={!isAdmin && user.role === 'admin'}
                                            >
                                                {availableRoles.map(role => (
                                                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                                                ))}
                                                {!isAdmin && user.role === 'admin' && (
                                                    <option value="admin">Admin</option>
                                                )}
                                            </select>
                                        </td>
                                        <td className="text-right">
                                            <button
                                                onClick={() => user.id && handleRemove(user.id, user.email)}
                                                className="text-danger hover:underline text-sm font-medium"
                                            >Remover</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

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

export default UsersAdminScreen;
