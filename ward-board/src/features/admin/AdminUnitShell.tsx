import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UnitsRepository } from '../../repositories/UnitsRepository';
import type { Unit, AdminTab } from '../../domain/types';

const TvSettingsScreen = lazy(() => import('./screens/TvSettingsScreen'));
const BedsAdminScreen = lazy(() => import('./screens/BedsAdminScreen'));
const UsersAdminScreen = lazy(() => import('./screens/UsersAdminScreen'));
const OpsScreen = lazy(() => import('./screens/OpsScreen'));
const AuditScreen = lazy(() => import('./screens/AuditScreen'));
const AnalyticsScreen = lazy(() => import('./screens/AnalyticsScreen'));

const TABS: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'tv', label: 'TV', icon: '📺' },
    { key: 'beds', label: 'Leitos', icon: '🛏️' },
    { key: 'users', label: 'Usuários', icon: '👥' },
    { key: 'ops', label: 'Operações', icon: '⚙️' },
    { key: 'audit', label: 'Auditoria', icon: '🕵️' },
    { key: 'analytics', label: 'Analytics', icon: '📊' },
];

const AdminUnitShell: React.FC = () => {
    const { unitId } = useParams<{ unitId: string }>();
    const navigate = useNavigate();
    const [unit, setUnit] = useState<Unit | null>(null);
    const [activeTab, setActiveTab] = useState<AdminTab>('tv');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!unitId) return;

        const fetchUnit = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await UnitsRepository.getUnit(unitId);
                if (data) {
                    setUnit(data);
                } else {
                    setError('Unidade não encontrada.');
                }
            } catch (err) {
                console.error('Error fetching unit:', err);
                setError('Erro ao carregar os dados da unidade. Verifique sua conexão e permissões.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUnit();
    }, [unitId]);

    if (!unitId) {
        navigate('/admin');
        return null;
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-app">
                <div className="text-xl font-serif animate-pulse text-muted">Carregando unidade...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-app p-6 text-center">
                <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
                <h2 className="text-2xl font-serif mb-2 text-primary">Ops! Algo deu errado</h2>
                <p className="text-muted mb-6 max-w-md">{error}</p>
                <button
                    onClick={() => navigate('/admin')}
                    className="btn btn-outline"
                >
                    Voltar para Lista de Unidades
                </button>
            </div>
        );
    }

    return (
        <div className="admin-shell">
            {/* Topbar */}
            <header className="admin-header">
                <div className="admin-header-top">
                    {/* Left: Back + Unit name */}
                    <div className="admin-header-left">
                        <button
                            onClick={() => navigate('/admin')}
                            className="admin-back-btn"
                            aria-label="Voltar para lista de unidades"
                        >
                            ← Voltar
                        </button>
                        <div className="admin-divider" aria-hidden="true" />
                        <div className="admin-unit-name-group">
                            <span className="admin-unit-name">
                                {unit?.name ?? unitId}
                            </span>
                            <span className="admin-badge">Admin</span>
                        </div>
                    </div>

                    {/* Right: quick-access links */}
                    <div className="admin-header-right">
                        <button
                            onClick={() => window.open(`/tv?unit=${unitId}`, '_blank')}
                            title="Abrir exibição TV"
                            className="btn btn-outline flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                            <span aria-hidden="true">📺</span> TV
                        </button>
                        <button
                            onClick={() => window.open(`/mobile?unit=${unitId}`, '_blank')}
                            title="Abrir edição mobile"
                            className="btn btn-outline flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                            <span aria-hidden="true">📱</span> Mobile
                        </button>
                    </div>
                </div>

                {/* TabBar */}
                <nav className="admin-tabs" role="tablist" aria-label="Painéis de administração">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            role="tab"
                            aria-selected={activeTab === tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`admin-tab${activeTab === tab.key ? ' admin-tab--active' : ''}`}
                        >
                            <span aria-hidden="true" className="admin-tab-icon">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </header>

            {/* Content */}
            <main className="admin-main">
                <Suspense fallback={<div className="p-8 text-center animate-pulse text-muted">Carregando painel...</div>}>
                    {activeTab === 'tv' && <TvSettingsScreen unitId={unitId} />}
                    {activeTab === 'beds' && <BedsAdminScreen unitId={unitId} />}
                    {activeTab === 'users' && <UsersAdminScreen unitId={unitId} />}
                    {activeTab === 'ops' && <OpsScreen unitId={unitId} />}
                    {activeTab === 'audit' && <AuditScreen unitId={unitId} />}
                    {activeTab === 'analytics' && <AnalyticsScreen />}
                </Suspense>
            </main>
        </div>
    );
};

export default AdminUnitShell;
