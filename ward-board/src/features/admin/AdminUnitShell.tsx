import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { UnitsRepository } from '../../repositories/UnitsRepository';
import type { Unit, AdminTab } from '../../domain/types';
import { IconTv, IconBeds, IconUsers, IconOps, IconAudit, IconStats, IconMissionControl } from '../../components/icons/MobileBottomNavIcons';
import { EduCenterHome } from '../education/components/EduCenterHome';

const TvSettingsScreen = lazy(() => import('./screens/TvSettingsScreen'));
const BedsAdminScreen = lazy(() => import('./screens/BedsAdminScreen'));
const UsersAdminScreen = lazy(() => import('./screens/UsersAdminScreen'));
const OpsScreen = lazy(() => import('./screens/OpsScreen'));
const AuditScreen = lazy(() => import('./screens/AuditScreen'));
const MissionControlScreen = lazy(() => import('./screens/MissionControlScreen'));
const AnalyticsScreen = lazy(() => import('./screens/AnalyticsScreen'));

const TABS: { key: AdminTab; label: string; icon: React.ReactNode; category: 'control' | 'explore' }[] = [
    { key: 'mission-control', label: 'M. Control', icon: <IconMissionControl size={18} />, category: 'control' },
    { key: 'tv', label: 'TV', icon: <IconTv size={18} />, category: 'control' },
    { key: 'beds', label: 'Leitos', icon: <IconBeds size={18} />, category: 'control' },
    { key: 'users', label: 'Acesso', icon: <IconUsers size={18} />, category: 'control' },
    { key: 'ops', label: 'Operações', icon: <IconOps size={18} />, category: 'control' },
    { key: 'analytics', label: 'Analytics', icon: <IconStats size={18} />, category: 'explore' },
    { key: 'audit', label: 'Auditoria', icon: <IconAudit size={18} />, category: 'explore' },
    { key: 'education', label: 'Educativo', icon: <BookOpen size={18} />, category: 'explore' },
];

const AdminUnitShell: React.FC = () => {
    const { unitId } = useParams<{ unitId: string }>();
    const navigate = useNavigate();
    const [unit, setUnit] = useState<Unit | null>(null);
    const [activeTab, setActiveTab] = useState<AdminTab>('mission-control');
    const [activeCategory, setActiveCategory] = useState<'control' | 'explore'>('control');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const handleCategoryChange = useCallback((cat: 'control' | 'explore') => {
        setActiveCategory(cat);
        const firstInCategory = TABS.find(t => t.category === cat);
        if (firstInCategory) setActiveTab(firstInCategory.key);
    }, []);

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
                <div className="admin-header-top relative">
                    {/* Left: Unit name */}
                    <div className="admin-header-left">
                        <span className="unit-badge">
                            {unit?.name || unitId}
                        </span>
                    </div>

                    {/* Center: Brand */}
                    <span className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
                        <img
                            src="/bedsight-flow-logo.png"
                            alt="BedSight Flow"
                            className="w-auto object-contain"
                            style={{ height: '24px', maxWidth: 'calc(100vw - 160px)' }}
                        />      </span>

                    {/* Right: quick-access links & Back */}
                    <div className="admin-header-right flex items-center gap-4">
                        <button
                            onClick={() => window.open(`/tv?unit=${unitId}`, '_blank')}
                            title="Abrir exibição TV"
                            className="btn btn-outline flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                            <IconTv size={20} aria-hidden="true" /> TV
                        </button>
                        <button
                            onClick={() => window.open(`/editor?unit=${unitId}`, '_blank')}
                            title="Abrir edição mobile"
                            className="btn btn-outline flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg> Mobile
                        </button>
                        <button
                            onClick={() => navigate('/admin')}
                            className="admin-back-btn"
                            aria-label="Voltar para lista de unidades"
                        >
                            <ChevronLeft size={16} />
                            Unidades
                        </button>
                    </div>
                </div>

                {/* Category switcher (sanduíche) */}
                <div className="admin-tabs-category" role="group" aria-label="Categoria de painéis">
                    <button
                        onClick={() => handleCategoryChange('control')}
                        className={`admin-category-btn${activeCategory === 'control' ? ' admin-category-btn--active' : ''}`}
                    >
                        Controle
                    </button>
                    <button
                        onClick={() => handleCategoryChange('explore')}
                        className={`admin-category-btn${activeCategory === 'explore' ? ' admin-category-btn--active' : ''}`}
                    >
                        Explorar
                    </button>
                </div>

                {/* TabBar — filtered by active category */}
                <nav className="admin-tabs" role="tablist" aria-label="Painéis de administração">
                    {TABS.filter(tab => tab.category === activeCategory).map(tab => (
                        <button
                            key={tab.key}
                            id={`tour-tab-${tab.key}`}
                            role="tab"
                            aria-selected={activeTab === tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`admin-tab${activeTab === tab.key ? ' admin-tab--active' : ''}`}
                        >
                            <span aria-hidden="true" className="admin-tab-icon flex items-center">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </header>

            {/* Content */}
            <main className="admin-main">
                <Suspense fallback={<div className="p-8 text-center animate-pulse text-muted">Carregando painel...</div>}>
                    {activeTab === 'mission-control' && <MissionControlScreen unitId={unitId} />}
                    {activeTab === 'tv' && <TvSettingsScreen unitId={unitId} />}
                    {activeTab === 'beds' && <BedsAdminScreen unitId={unitId} />}
                    {activeTab === 'users' && <UsersAdminScreen unitId={unitId} />}
                    {activeTab === 'ops' && <OpsScreen unitId={unitId} />}
                    {activeTab === 'audit' && <AuditScreen unitId={unitId} />}
                    {activeTab === 'analytics' && <AnalyticsScreen unitId={unitId} />}
                    {activeTab === 'education' && <EduCenterHome unitId={unitId} embedded />}
                </Suspense>
            </main>
        </div>
    );
};

export default AdminUnitShell;
