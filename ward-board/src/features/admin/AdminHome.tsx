import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../infra/firebase/config';
import { UnitsRepository } from '../../repositories/UnitsRepository';
import { authorizedUsersRepository, type AuthorizedUser } from '../../repositories/authorizedUsersRepository';
import ConfirmModal from '../../shared/components/ConfirmModal';
import type { Unit } from '../../domain/types';

const AdminHome: React.FC = () => {
    const navigate = useNavigate();
    const [units, setUnits] = useState<Unit[]>([]);
    const [users, setUsers] = useState<AuthorizedUser[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [activeSection, setActiveSection] = useState<'units' | 'users'>('units');
    const [userToDelete, setUserToDelete] = useState<AuthorizedUser | null>(null);

    useEffect(() => {
        const unsub = UnitsRepository.listenToUnits(setUnits);
        return unsub;
    }, []);

    useEffect(() => {
        if (activeSection === 'users') {
            authorizedUsersRepository.getAll().then(data =>
                setUsers(data.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()))
            );
        }
    }, [activeSection]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail) return;
        setSubmitting(true);
        try {
            await authorizedUsersRepository.add(newEmail);
            setNewEmail('');
            const data = await authorizedUsersRepository.getAll();
            setUsers(data.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        const id = userToDelete.id!;
        setUserToDelete(null);
        await authorizedUsersRepository.remove(id);
        const data = await authorizedUsersRepository.getAll();
        setUsers(data.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()));
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

            {/* Header */}
            <header className="admin-header">
                <div className="admin-header-top">
                    <div className="admin-header-left">
                        <span className="admin-unit-name">Ward Board</span>
                        <span className="admin-badge">Admin</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="admin-back-btn"
                    >Sair</button>
                </div>
            </header>

            <main className="admin-main">
                <div className="admin-home-header-group">
                    <h1 className="text-2xl font-serif text-primary mb-1">Painel Administrativo</h1>
                    <p className="text-sm text-muted">
                        Selecione uma unidade para gerenciar ou administre usuários globais.
                    </p>
                </div>

                {/* Section Tabs */}
                <nav className="admin-tabs mb-6" role="tablist">
                    {(['units', 'users'] as const).map(section => (
                        <button
                            key={section}
                            role="tab"
                            aria-selected={activeSection === section}
                            onClick={() => setActiveSection(section)}
                            className={`admin-tab${activeSection === section ? ' admin-tab--active' : ''}`}
                        >
                            {section === 'units' ? 'Unidades' : 'Usuários Globais'}
                        </button>
                    ))}
                </nav>

                {/* Units Section */}
                {activeSection === 'units' && (
                    <div className="admin-section-grid">
                        {units.length === 0 ? (
                            <div className="p-8 text-center text-muted">
                                Nenhuma unidade encontrada no banco de dados.
                            </div>
                        ) : (
                            units.map(unit => (
                                <div
                                    key={unit.id}
                                    className="admin-card admin-card--interactive flex justify-between items-center"
                                >
                                    <div>
                                        <div className="text-lg font-semibold text-primary mb-1">{unit.name}</div>
                                        <div className="text-sm text-muted">
                                            {unit.totalBeds} leitos · ID: {unit.id}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/admin/unit/${unit.id}`)}
                                        className="btn btn-primary"
                                    >
                                        Entrar →
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Global Users Section */}
                {activeSection === 'users' && (
                    <div className="admin-section-grid">
                        {/* Add user form */}
                        <div className="admin-card">
                            <h2 className="text-sm font-semibold mb-4 text-primary uppercase tracking-wider">
                                Autorizar Novo E-mail
                            </h2>
                            <form onSubmit={handleAddUser} className="admin-form-group">
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    placeholder="usuario@gmail.com"
                                    required
                                    className="admin-input"
                                />
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`btn ${submitting ? 'btn-disabled' : 'btn-primary'}`}
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
                            {users.length === 0 ? (
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
                                                    >Remover</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminHome;
