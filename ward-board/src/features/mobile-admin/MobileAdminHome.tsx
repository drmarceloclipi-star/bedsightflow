import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../infra/firebase/config';
import { UnitsRepository } from '../../repositories/UnitsRepository';
import { authorizedUsersRepository, type AuthorizedUser } from '../../repositories/authorizedUsersRepository';
import ConfirmModal from '../../shared/components/ConfirmModal';
import type { Unit } from '../../domain/types';

const MobileAdminHome: React.FC = () => {
    const navigate = useNavigate();
    const [units, setUnits] = useState<Unit[]>([]);
    const [users, setUsers] = useState<AuthorizedUser[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'units' | 'users'>('units');
    const [userToDelete, setUserToDelete] = useState<AuthorizedUser | null>(null);

    useEffect(() => {
        const unsub = UnitsRepository.listenToUnits(setUnits);
        return unsub;
    }, []);

    useEffect(() => {
        if (activeTab === 'users') {
            authorizedUsersRepository.getAll().then(data =>
                setUsers(data.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()))
            );
        }
    }, [activeTab]);

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
        const id = userToDelete.id;
        setUserToDelete(null);
        await authorizedUsersRepository.remove(id);
        const data = await authorizedUsersRepository.getAll();
        setUsers(data.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()));
    };

    return (
        <div className="madmin-shell">
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

            {/* Sticky header */}
            <header className="madmin-header">
                <div className="madmin-header-inner relative">
                    <div className="madmin-header-left" />
                    <span className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
                        <img src="/bedsight-flow-logo.png" alt="BedSight Flow" style={{ height: '24px', width: 'auto', maxWidth: 'calc(100vw - 140px)' }} />
                    </span>
                    <div className="flex items-center gap-3">
                        <button onClick={handleLogout} className="madmin-logout-btn">
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="madmin-main">
                <div className="madmin-page-title-group">
                    <h1 className="madmin-page-title">Painel Admin</h1>
                    <p className="madmin-page-subtitle">Selecione uma unidade para gerenciar.</p>
                </div>

                {/* Tab pills */}
                <div className="madmin-pill-tabs" role="tablist">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'units'}
                        onClick={() => setActiveTab('units')}
                        className={`madmin-pill-tab${activeTab === 'units' ? ' madmin-pill-tab--active' : ''}`}
                    >
                        Unidades
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'users'}
                        onClick={() => setActiveTab('users')}
                        className={`madmin-pill-tab${activeTab === 'users' ? ' madmin-pill-tab--active' : ''}`}
                    >
                        Usuários Globais
                    </button>
                </div>

                {/* Units tab */}
                {activeTab === 'units' && (
                    <div className="madmin-list">
                        {units.length === 0 ? (
                            <div className="madmin-empty-state">
                                <span className="madmin-empty-icon">🏥</span>
                                <p>Nenhuma unidade encontrada.</p>
                            </div>
                        ) : (
                            units.map(unit => (
                                <div key={unit.id} className="madmin-card madmin-unit-card">
                                    <div className="madmin-unit-info">
                                        <div className="madmin-unit-card-name">{unit.name}</div>
                                        <div className="madmin-unit-card-meta">
                                            {unit.totalBeds} leitos · ID: {unit.id}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/mobile-admin/unit/${unit.id}`)}
                                        className="madmin-btn madmin-btn-primary madmin-btn-sm"
                                    >
                                        Entrar →
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Global users tab */}
                {activeTab === 'users' && (
                    <div className="madmin-list">
                        {/* Add user form */}
                        <div className="madmin-card">
                            <h2 className="madmin-card-label">Autorizar Novo E-mail</h2>
                            <form onSubmit={handleAddUser} className="madmin-form-stack">
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    placeholder="usuario@gmail.com"
                                    required
                                    className="madmin-input"
                                />
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`madmin-btn madmin-btn-full ${submitting ? 'madmin-btn-disabled' : 'madmin-btn-primary'}`}
                                >
                                    {submitting ? 'Adicionando...' : 'Autorizar'}
                                </button>
                            </form>
                        </div>

                        {/* Users list */}
                        <div className="madmin-section-label">
                            Usuários Autorizados ({users.length})
                        </div>
                        {users.length === 0 ? (
                            <div className="madmin-empty-state">
                                <p>Nenhum usuário cadastrado.</p>
                            </div>
                        ) : (
                            users.map(user => (
                                <div key={user.id} className="madmin-card madmin-user-card">
                                    <div className="madmin-user-info">
                                        <div className="madmin-user-email">{user.email}</div>
                                        <div className="madmin-user-date">
                                            Adicionado em {user.addedAt.toLocaleDateString('pt-BR')}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setUserToDelete(user)}
                                        className="madmin-btn-danger-link"
                                    >
                                        Remover
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default MobileAdminHome;
