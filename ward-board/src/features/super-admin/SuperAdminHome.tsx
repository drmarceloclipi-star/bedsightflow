import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../infra/firebase/config';
import { UnitsRepository } from '../../repositories/UnitsRepository';
import { authorizedUsersRepository, type AuthorizedUser } from '../../repositories/authorizedUsersRepository';
import ConfirmModal from '../../shared/components/ConfirmModal';
import type { Unit, SpecialtyKey } from '../../domain/types';
import { SpecialtyLabel } from '../../domain/types';

/**
 * SuperAdminHome — Platform-level administration panel.
 *
 * This is the exclusive panel for the Super Admin (SaaS owner).
 * Responsibilities:
 *   - Manage institution clients (units/hospitals)
 *   - Manage global authorized users
 *   - Multi-institution overview
 *
 * Super Admin does NOT participate in the institutional hierarchy.
 * Super Admin does NOT see the institutional portal.
 */
const SuperAdminHome: React.FC = () => {
    const navigate = useNavigate();
    const [units, setUnits] = useState<Unit[]>([]);
    const [users, setUsers] = useState<AuthorizedUser[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [activeSection, setActiveSection] = useState<'institutions' | 'users'>('institutions');
    const [userToDelete, setUserToDelete] = useState<AuthorizedUser | null>(null);

    // New Unit state
    const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);
    const [newUnitName, setNewUnitName] = useState('');
    const [newUnitSpecialties, setNewUnitSpecialties] = useState<SpecialtyKey[]>([]);
    const [creatingUnit, setCreatingUnit] = useState(false);
    const [unitCreationError, setUnitCreationError] = useState<string | null>(null);

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

    const handleCreateUnit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUnitName.trim()) return;

        setCreatingUnit(true);
        setUnitCreationError(null);
        try {
            await UnitsRepository.addUnit({
                name: newUnitName.trim(),
                totalBeds: 0,
                specialties: newUnitSpecialties,
            });
            setIsAddUnitModalOpen(false);
            setNewUnitName('');
            setNewUnitSpecialties([]);
        } catch (error) {
            console.error('Error creating unit:', error);
            setUnitCreationError('Não foi possível criar a unidade. Verifique sua conexão e tente novamente.');
        } finally {
            setCreatingUnit(false);
        }
    };

    const closeAddUnitModal = () => {
        if (creatingUnit) return;
        setIsAddUnitModalOpen(false);
        setNewUnitName('');
        setNewUnitSpecialties([]);
        setUnitCreationError(null);
    };

    const toggleSpecialty = (sp: SpecialtyKey) => {
        setNewUnitSpecialties(prev =>
            prev.includes(sp) ? prev.filter(k => k !== sp) : [...prev, sp]
        );
    };

    return (
        <div className="admin-shell">
            <ConfirmModal
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                onConfirm={() => handleDeleteUser()}
                title="Remover Acesso"
                description={`Você está prestes a remover o acesso do usuário ${userToDelete?.email}.`}
                consequences={['Este usuário não poderá mais acessar o sistema.']}
                confirmLabel="Remover Usuário"
                isDangerous
            />

            {/* Header */}
            <header className="admin-header">
                <div className="admin-header-top relative">
                    <div className="admin-header-left">
                        <span className="unit-badge">Super Admin</span>
                    </div>
                    <span className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
                        <img
                            src="/bedsight-flow-logo.png"
                            alt="BedSight Flow"
                            className="w-auto object-contain"
                            style={{ height: '24px', maxWidth: 'calc(100vw - 160px)' }}
                        />
                    </span>
                    <div className="admin-header-right flex items-center gap-4">
                        <button
                            onClick={handleLogout}
                            className="admin-back-btn"
                        >Sair</button>
                    </div>
                </div>
            </header>

            <main className="admin-main">
                <div className="admin-home-header-group">
                    <h1 className="text-2xl font-serif text-primary mb-1">Painel da Plataforma</h1>
                    <p className="text-sm text-muted">
                        Administração da plataforma BedSight Flow — gestão de instituições e usuários globais.
                    </p>
                </div>

                {/* Section Tabs */}
                <nav className="admin-tabs mb-6" role="tablist">
                    {(['institutions', 'users'] as const).map(section => (
                        <button
                            key={section}
                            role="tab"
                            aria-selected={activeSection === section}
                            onClick={() => setActiveSection(section)}
                            className={`admin-tab${activeSection === section ? ' admin-tab--active' : ''}`}
                        >
                            {section === 'institutions' ? 'Instituições' : 'Usuários Globais'}
                        </button>
                    ))}
                </nav>

                {/* Institutions Section */}
                {activeSection === 'institutions' && (
                    <div className="admin-section-grid">
                        <div className="flex justify-between items-center mb-4 col-span-full">
                            <h2 className="text-lg font-semibold text-primary">Instituições Clientes ({units.length})</h2>
                            <button
                                onClick={() => setIsAddUnitModalOpen(true)}
                                className="btn btn-primary"
                            >
                                + Nova Instituição
                            </button>
                        </div>
                        {units.length === 0 ? (
                            <div className="p-8 text-center text-muted">
                                Nenhuma instituição encontrada no banco de dados.
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

            {/* Add Unit Modal */}
            {isAddUnitModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={closeAddUnitModal}
                    onKeyDown={e => e.key === 'Escape' && closeAddUnitModal()}
                    role="presentation"
                >
                    <div
                        className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 relative border border-surface-3"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-unit-title"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-6 py-5 border-b border-surface-2 bg-surface-1">
                            <h2 id="add-unit-title" className="text-xl font-serif font-bold text-primary">Nova Instituição</h2>
                            <p className="text-sm text-muted mt-1">
                                Cadastre uma nova instituição cliente na plataforma.
                            </p>
                        </div>

                        <form onSubmit={handleCreateUnit} className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="unitName" className="block text-sm font-semibold text-primary">
                                    Nome da Unidade
                                </label>
                                <input
                                    id="unitName"
                                    type="text"
                                    value={newUnitName}
                                    onChange={e => setNewUnitName(e.target.value)}
                                    placeholder="Ex: UTI Adulto"
                                    required
                                    className="admin-input"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-primary">
                                    Especialidades Atendidas
                                </label>
                                <div className="max-h-48 overflow-y-auto p-2 border border-surface-3 rounded-xl bg-surface-1/50 grid grid-cols-2 gap-2">
                                    {(Object.entries(SpecialtyLabel) as [SpecialtyKey, string][])
                                        .sort((a, b) => a[1].localeCompare(b[1]))
                                        .map(([key, label]) => (
                                            <label key={key} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-surface cursor-pointer text-sm transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={newUnitSpecialties.includes(key)}
                                                    onChange={() => toggleSpecialty(key)}
                                                    className="rounded border-surface-3 text-brand focus:ring-brand bg-surface"
                                                />
                                                <span className="text-primary truncate" title={label}>{label}</span>
                                            </label>
                                        ))}
                                </div>
                                <p className="text-xs text-muted mt-1">
                                    Selecione as especialidades que acompanharão leitos nesta unidade.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-surface-2">
                                <button
                                    type="button"
                                    onClick={() => closeAddUnitModal()}
                                    disabled={creatingUnit}
                                    className="px-4 py-2 text-sm font-medium text-muted hover:text-primary transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingUnit || !newUnitName.trim()}
                                    className={`btn ${creatingUnit || !newUnitName.trim() ? 'btn-disabled' : 'btn-primary'}`}
                                >
                                    {creatingUnit ? 'Criando...' : 'Criar Instituição'}
                                </button>
                            </div>

                            {unitCreationError && (
                                <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
                                    {unitCreationError}
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminHome;
