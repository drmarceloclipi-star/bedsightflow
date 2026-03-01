import React, { useState, useEffect } from 'react';
import { authorizedUsersRepository, type AuthorizedUser } from '../../repositories/authorizedUsersRepository';
import { signOut } from 'firebase/auth';
import { auth } from '../../infra/firebase/config';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../shared/components/ConfirmModal';

const AdminScreen: React.FC = () => {
    const [users, setUsers] = useState<AuthorizedUser[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [userToDelete, setUserToDelete] = useState<AuthorizedUser | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await authorizedUsersRepository.getAll();
            setUsers(data.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()));
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail) return;

        setSubmitting(true);
        try {
            await authorizedUsersRepository.add(newEmail);
            setNewEmail('');
            await loadUsers();
        } catch (error) {
            console.error('Error adding user:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete?.id) return;
        try {
            await authorizedUsersRepository.remove(userToDelete.id);
            await loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
        } finally {
            setUserToDelete(null);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    return (
        <div className="admin-shell">
            <ConfirmModal
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                onConfirm={() => handleDeleteUser()}
                title="Remover Acesso"
                description={`Você está prestes a remover o acesso do usuário ${userToDelete?.email}.`}
                consequences={['Este usuário não poderá mais acessar o painel administrativo.']}
                confirmLabel="Remover Usuário"
                isDangerous
            />

            <header className="admin-header">
                <div className="admin-header-top relative">
                    <div className="admin-header-left">
                        <span className="unit-badge">Admin</span>
                    </div>
                    <span className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
                        <img
                            src="/bedsight-flow-logo.png"
                            alt="BedSight Flow"
                            className="w-auto object-contain"
                            style={{ height: '24px', maxWidth: 'calc(100vw - 160px)' }}
                        />
                    </span>
                    <button onClick={handleLogout} className="admin-back-btn">
                        Sair
                    </button>
                </div>
            </header>

            <main className="admin-main">
                <div className="admin-home-header-group">
                    <h1 className="text-2xl font-serif text-primary mb-1">Painel Administrativo</h1>
                    <p className="text-sm text-muted">Gerenciamento de Usuários Autorizados</p>
                </div>

                {/* Add user form */}
                <div className="admin-card mb-4">
                    <h2 className="text-sm font-semibold mb-4 text-primary uppercase tracking-wider">
                        Autorizar Novo E-mail
                    </h2>
                    <form onSubmit={handleAddUser} className="admin-form-group">
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="E-mail do Google (ex: usuario@gmail.com)"
                            required
                            className="admin-input"
                        />
                        <button
                            type="submit"
                            className={`btn ${submitting ? 'btn-disabled' : 'btn-primary'}`}
                            disabled={submitting}
                        >
                            {submitting ? 'Adicionando...' : 'Autorizar'}
                        </button>
                    </form>
                </div>

                {/* Users table */}
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="text-sm font-semibold text-primary">
                            Usuários Autorizados ({users.length})
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-muted text-sm">
                            Carregando...
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-muted text-sm">
                            Nenhum usuário cadastrado.
                        </div>
                    ) : (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>E-mail</th>
                                    <th>Adicionado em</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td>{user.email}</td>
                                        <td className="text-sm text-muted">
                                            {user.addedAt.toLocaleDateString()}
                                        </td>
                                        <td className="text-right">
                                            <button
                                                onClick={() => setUserToDelete(user)}
                                                className="btn-link text-sm font-semibold tracking-wide text-danger"
                                            >
                                                Remover
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminScreen;
