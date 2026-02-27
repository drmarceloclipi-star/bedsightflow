import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UnitsRepository } from '../../repositories/UnitsRepository';
import type { Unit } from '../../domain/types';

const MobileTvSettingsScreen = lazy(() => import('./screens/MobileTvSettingsScreen'));
const MobileBedsAdminScreen = lazy(() => import('./screens/MobileBedsAdminScreen'));
const MobileUsersAdminScreen = lazy(() => import('./screens/MobileUsersAdminScreen'));
const MobileOpsScreen = lazy(() => import('./screens/MobileOpsScreen'));
const MobileAuditScreen = lazy(() => import('./screens/MobileAuditScreen'));
const MobileAnalyticsScreen = lazy(() => import('./screens/MobileAnalyticsScreen'));

type MobileAdminTab = 'tv' | 'beds' | 'users' | 'ops' | 'audit' | 'analytics';

const TABS: { key: MobileAdminTab; label: string; icon: string }[] = [
    { key: 'tv', label: 'TV', icon: '📺' },
    { key: 'beds', label: 'Leitos', icon: '🛏️' },
    { key: 'users', label: 'Equipe', icon: '👥' },
    { key: 'ops', label: 'Ops', icon: '⚙️' },
    { key: 'audit', label: 'Audit', icon: '🕵️' },
    { key: 'analytics', label: 'Stats', icon: '📊' },
];

const MobileAdminUnitShell: React.FC = () => {
    const { unitId } = useParams<{ unitId: string }>();
    const navigate = useNavigate();
    const [unit, setUnit] = useState<Unit | null>(null);
    const [activeTab, setActiveTab] = useState<MobileAdminTab>('tv');
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
                setError('Erro ao carregar os dados da unidade.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUnit();
    }, [unitId]);

    if (!unitId) {
        navigate('/mobile-admin');
        return null;
    }

    if (isLoading) {
        return (
            <div className="madmin-shell madmin-center-fill">
                <div className="animate-pulse text-muted">Carregando unidade...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="madmin-shell madmin-center-fill madmin-error-state">
                <div className="madmin-error-icon" aria-hidden="true">⚠️</div>
                <h2 className="madmin-error-title">Algo deu errado</h2>
                <p className="madmin-error-msg">{error}</p>
                <button
                    onClick={() => navigate('/mobile-admin')}
                    className="madmin-btn madmin-btn-outline"
                >
                    Voltar
                </button>
            </div>
        );
    }

    return (
        <div className="madmin-shell">
            {/* Sticky top header */}
            <header className="madmin-header">
                <div className="madmin-header-inner">
                    <div className="madmin-header-left">
                        <button
                            onClick={() => navigate('/mobile-admin')}
                            className="madmin-back-btn"
                            aria-label="Voltar para lista de unidades"
                        >
                            ←
                        </button>
                        <div className="madmin-unit-name-group">
                            <span className="madmin-unit-name">{unit?.name ?? unitId}</span>
                            <span className="madmin-badge">Admin</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Scrollable content area — padded above bottom-nav */}
            <main className="madmin-content">
                <Suspense fallback={
                    <div className="madmin-loading-tab">
                        <div className="animate-pulse text-muted">Carregando...</div>
                    </div>
                }>
                    {activeTab === 'tv' && <MobileTvSettingsScreen unitId={unitId} />}
                    {activeTab === 'beds' && <MobileBedsAdminScreen unitId={unitId} />}
                    {activeTab === 'users' && <MobileUsersAdminScreen unitId={unitId} />}
                    {activeTab === 'ops' && <MobileOpsScreen unitId={unitId} />}
                    {activeTab === 'audit' && <MobileAuditScreen unitId={unitId} />}
                    {activeTab === 'analytics' && <MobileAnalyticsScreen unitId={unitId} />}
                </Suspense>
            </main>

            {/* Fixed bottom navigation bar */}
            <nav className="madmin-bottom-nav" role="tablist" aria-label="Painéis de administração">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`madmin-bottom-tab${activeTab === tab.key ? ' madmin-bottom-tab--active' : ''}`}
                    >
                        <span className="madmin-bottom-tab-icon" aria-hidden="true">{tab.icon}</span>
                        <span className="madmin-bottom-tab-label">{tab.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default MobileAdminUnitShell;
