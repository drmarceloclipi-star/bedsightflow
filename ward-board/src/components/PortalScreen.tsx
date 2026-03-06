import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStatus } from '../hooks/useAuthStatus';
import { useHighestRole } from '../hooks/useHighestRole';
import { Shield, Monitor, LayoutDashboard, Building } from 'lucide-react';
import { isMobileDevice } from '../utils/device';
import type { PortalLevel } from '../domain/types';

/**
 * PortalScreen — Role-based entry point for the institutional portal.
 *
 * Rules:
 *   1. Super Admin → auto-redirect to /super-admin (never sees this portal)
 *   2. Global Admin → sees: Global Admin + Unit Admin + Editor + Viewer
 *   3. Unit Admin   → sees: Unit Admin + Editor + Viewer
 *   4. Editor       → sees: Editor + Viewer
 *   5. Viewer       → sees: Viewer only
 */
const PortalScreen: React.FC = () => {
    const { user, isSuperAdmin } = useAuthStatus();
    const { visiblePortalLevels, loadingRoles } = useHighestRole();
    const navigate = useNavigate();

    // Super Admin must NEVER see the institutional portal — redirect immediately
    useEffect(() => {
        if (!loadingRoles && isSuperAdmin) {
            navigate('/super-admin', { replace: true });
        }
    }, [isSuperAdmin, loadingRoles, navigate]);

    // The component might briefly render while loading is finishing in App.tsx
    if (!user || loadingRoles || isSuperAdmin) {
        return (
            <div className="min-h-screen bg-[#F7F3EE] flex items-center justify-center p-6">
                <div className="animate-pulse text-[#a66b3a] font-bold tracking-widest text-xs">CARREGANDO...</div>
            </div>
        );
    }

    const canSee = (level: PortalLevel) => visiblePortalLevels.includes(level);

    const handleNavigateAdmin = () => {
        if (isMobileDevice()) {
            navigate('/mobile-admin');
        } else {
            navigate('/admin');
        }
    };

    const handleNavigateUnitAdmin = () => navigate('/unit-admin');
    const handleNavigateEditor = () => navigate('/editor');
    const handleNavigateTv = () => navigate('/tv');

    // Count visible cards for grid layout
    const visibleCount = [
        canSee('global_admin'),
        canSee('unit_admin'),
        canSee('editor'),
        canSee('viewer'),
    ].filter(Boolean).length;

    return (
        <div className="min-h-screen bg-[#F7F3EE] flex flex-col items-center justify-center p-6">
            <header className="mb-12 text-center w-full max-w-4xl">
                <h1 className="text-3xl font-semibold text-[#2B2622] mb-2 tracking-tight">
                    Bem-vindo ao BedSight Flow
                </h1>
                <p className="text-[#a66b3a] text-lg font-medium opacity-90">
                    Selecione o seu ambiente de trabalho
                </p>
            </header>

            <div className={`grid gap-6 w-full max-w-5xl ${visibleCount >= 4 ? 'md:grid-cols-4' : visibleCount === 3 ? 'md:grid-cols-3 max-w-4xl' : visibleCount === 2 ? 'md:grid-cols-2 max-w-3xl' : 'max-w-md'} justify-center`}>

                {/* Global Admin Card — only visible to Global Admin */}
                {canSee('global_admin') && (
                    <div className="card flex flex-col bg-white border border-[#D8CBBE] rounded-xl p-8 hover:shadow-md transition-shadow cursor-pointer group" onClick={handleNavigateAdmin}>
                        <div className="h-14 w-14 rounded-full bg-[#fcf9f5] flex items-center justify-center text-[#a66b3a] mb-6 border border-[#f0e6da] group-hover:scale-105 transition-transform duration-300">
                            <Shield size={28} />
                        </div>
                        <h2 className="text-xl font-semibold text-[#2B2622] mb-1">Global Admin</h2>
                        <h3 className="text-sm font-medium text-[#a66b3a] mb-3">Gestão da Instituição</h3>
                        <p className="text-[#756A5F] text-sm leading-relaxed mb-8 flex-grow">
                            Administração da instituição, gestão de todas as unidades e parâmetros operacionais.
                        </p>
                        <button className="btn btn-outline w-full text-sm font-medium border-[#D8CBBE] text-[#2B2622] hover:bg-[#F7F3EE] group-hover:border-[#a66b3a] group-hover:text-[#a66b3a]">
                            Acessar Instituição
                        </button>
                    </div>
                )}

                {/* Unit Admin Card — visible to Global Admin and Unit Admin */}
                {canSee('unit_admin') && (
                    <div className="card flex flex-col bg-white border border-[#D8CBBE] rounded-xl p-8 hover:shadow-md transition-shadow cursor-pointer group" onClick={handleNavigateUnitAdmin}>
                        <div className="h-14 w-14 rounded-full bg-[#fcf9f5] flex items-center justify-center text-[#a66b3a] mb-6 border border-[#f0e6da] group-hover:scale-105 transition-transform duration-300">
                            <Building size={28} />
                        </div>
                        <h2 className="text-xl font-semibold text-[#2B2622] mb-1">Líder Admin</h2>
                        <h3 className="text-sm font-medium text-[#a66b3a] mb-3">Gestão da Unidade</h3>
                        <p className="text-[#756A5F] text-sm leading-relaxed mb-8 flex-grow">
                            Gerenciamento administrativo local, configurações da unidade, TVs e permissões de usuários locais.
                        </p>
                        <button className="btn btn-outline w-full text-sm font-medium border-[#D8CBBE] text-[#2B2622] hover:bg-[#F7F3EE] group-hover:border-[#a66b3a] group-hover:text-[#a66b3a]">
                            Acessar Unidade
                        </button>
                    </div>
                )}

                {/* Editor Card — visible to Global Admin, Unit Admin, and Editor */}
                {canSee('editor') && (
                    <div className="card flex flex-col bg-white border border-[#D8CBBE] rounded-xl p-8 hover:shadow-md transition-shadow cursor-pointer group" onClick={handleNavigateEditor}>
                        <div className="h-14 w-14 rounded-full bg-[#fcf9f5] flex items-center justify-center text-[#a66b3a] mb-6 border border-[#f0e6da] group-hover:scale-105 transition-transform duration-300">
                            <LayoutDashboard size={28} />
                        </div>
                        <h2 className="text-xl font-semibold text-[#2B2622] mb-1">Editor</h2>
                        <h3 className="text-sm font-medium text-[#a66b3a] mb-3">Gestão de Leitos</h3>
                        <p className="text-[#756A5F] text-sm leading-relaxed mb-8 flex-grow">
                            Gerenciamento operacional da unidade, status dos leitos no Kanban, pendências e atualizações diárias.
                        </p>
                        <button className="btn btn-primary w-full text-sm font-medium bg-[#a66b3a] hover:bg-[#8f5a2f] border-none shadow-sm">
                            Acessar Kanban
                        </button>
                    </div>
                )}

                {/* TV / Viewer Card — visible to all roles */}
                {canSee('viewer') && (
                    <div className="card flex flex-col bg-white border border-[#D8CBBE] rounded-xl p-8 hover:shadow-md transition-shadow cursor-pointer group" onClick={handleNavigateTv}>
                        <div className="h-14 w-14 rounded-full bg-[#fcf9f5] flex items-center justify-center text-[#a66b3a] mb-6 border border-[#f0e6da] group-hover:scale-105 transition-transform duration-300">
                            <Monitor size={28} />
                        </div>
                        <h2 className="text-xl font-semibold text-[#2B2622] mb-1">Viewer</h2>
                        <h3 className="text-sm font-medium text-[#a66b3a] mb-3">Painel TV</h3>
                        <p className="text-[#756A5F] text-sm leading-relaxed mb-8 flex-grow">
                            Modo visualização passivo do Quadro Kanban para displays em estações de enfermagem.
                        </p>
                        <button className="btn btn-outline w-full text-sm font-medium border-[#D8CBBE] text-[#2B2622] hover:bg-[#F7F3EE] group-hover:border-[#a66b3a] group-hover:text-[#a66b3a]">
                            Acessar Painel
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default PortalScreen;
