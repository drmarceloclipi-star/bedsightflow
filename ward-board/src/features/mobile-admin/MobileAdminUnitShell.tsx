import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { UnitsRepository } from '../../repositories/UnitsRepository';
import type { Unit } from '../../domain/types';

const MobileTvSettingsScreen = lazy(() => import('./screens/MobileTvSettingsScreen'));
const MobileBedsAdminScreen = lazy(() => import('./screens/MobileBedsAdminScreen'));
const MobileUsersAdminScreen = lazy(() => import('./screens/MobileUsersAdminScreen'));
const MobileOpsScreen = lazy(() => import('./screens/MobileOpsScreen'));
const MobileAuditScreen = lazy(() => import('./screens/MobileAuditScreen'));
const MobileMissionControlScreen = lazy(() => import('./screens/MobileMissionControlScreen'));
const MobileAnalyticsScreen = lazy(() => import('./screens/MobileAnalyticsScreen'));

import {
    IconTv,
    IconBeds,
    IconUsers,
    IconOps,
    IconAudit,
    IconMissionControl,
    IconStats,
    type NavIconProps
} from '../../components/icons/MobileBottomNavIcons';

// ... other imports

type MobileAdminTab = 'tv' | 'beds' | 'users' | 'ops' | 'audit' | 'mission-control' | 'analytics';

const TABS: { key: MobileAdminTab; label: string; Icon: React.FC<NavIconProps> }[] = [
    { key: 'tv', label: 'TV', Icon: IconTv },
    { key: 'beds', label: 'Leitos', Icon: IconBeds },
    { key: 'users', label: 'Equipe', Icon: IconUsers },
    { key: 'ops', label: 'Ops', Icon: IconOps },
    { key: 'audit', label: 'Audit', Icon: IconAudit },
    { key: 'mission-control', label: 'M. Control', Icon: IconMissionControl },
    { key: 'analytics', label: 'Analytics', Icon: IconStats },
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

    useEffect(() => {
        if (!unitId) {
            navigate('/mobile-admin');
        }
    }, [unitId, navigate]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [activeTab]);

    if (!unitId) return null;

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
                <div className="madmin-header-inner relative">
                    <div className="madmin-header-left">
                        <button
                            onClick={() => navigate('/mobile-admin')}
                            className="madmin-back-btn"
                            aria-label="Voltar para lista de unidades"
                        >
                            <ChevronLeft size={22} />
                        </button>
                        <span className="unit-badge">
                            {(unit?.name || unitId).replace(/^Unidade\s/i, 'Unid. ')}
                        </span>
                    </div>
                    <span className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
                        <img src="/bedsight-flow-logo.png" alt="BedSight Flow" style={{ height: '24px', width: 'auto', maxWidth: 'calc(100vw - 160px)' }} />
                    </span>
                    <div className="madmin-header-right flex items-center gap-2">
                        <button
                            onClick={() => navigate(`/tv?unit=${unitId}`)}
                            title="Abrir exibição TV"
                            className="madmin-header-btn"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tv" aria-hidden="true"><path d="m17 2-5 5-5-5"></path><rect width="20" height="15" x="2" y="7" rx="2"></rect></svg>
                        </button>
                        <button
                            onClick={() => navigate(`/editor?unit=${unitId}`)}
                            title="Abrir edição mobile"
                            className="madmin-header-btn"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-smartphone" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg>
                        </button>
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
                    {activeTab === 'mission-control' && <MobileMissionControlScreen unitId={unitId} />}
                    {activeTab === 'analytics' && <MobileAnalyticsScreen unitId={unitId} />}
                </Suspense>
            </main>

            {/* Fixed bottom navigation bar */}
            <nav className="madmin-bottom-nav" role="tablist" aria-label="Painéis de administração">
                {TABS.map(tab => {
                    const IconComponent = tab.Icon;
                    return (
                        <button
                            key={tab.key}
                            role="tab"
                            aria-selected={activeTab === tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`madmin-bottom-tab${activeTab === tab.key ? ' madmin-bottom-tab--active' : ''}`}
                        >
                            <span className="madmin-bottom-tab-icon" aria-hidden="true">
                                <IconComponent
                                    className={activeTab === tab.key ? "text-primary-600" : "text-muted"}
                                />
                            </span>
                            <span className="madmin-bottom-tab-label">{tab.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default MobileAdminUnitShell;
