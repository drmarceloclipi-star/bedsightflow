import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStatus } from '../hooks/useAuthStatus';
import { useHighestRole } from '../hooks/useHighestRole';
import { Shield, Monitor, LayoutDashboard, Building } from 'lucide-react';
import { isMobileDevice } from '../utils/device';

const PortalScreen: React.FC = () => {
    const { user, isAdmin } = useAuthStatus();
    const { hasUnitAdminAccess, hasEditorAccess, hasViewerAccess, loadingRoles } = useHighestRole();
    const navigate = useNavigate();

    // The component might briefly render while loading is finishing in App.tsx
    if (!user || loadingRoles) {
        return (
            <div className="min-h-screen bg-[#F7F3EE] flex items-center justify-center p-6">
                <div className="animate-pulse text-[#a66b3a] font-bold tracking-widest text-xs">CARREGANDO...</div>
            </div>
        );
    }

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

            <div className={`grid gap-6 w-full max-w-5xl ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3 justify-center max-w-4xl'}`}>

                {/* Global Admin Card */}
                {isAdmin && (
                    <div className="card flex flex-col bg-white border border-[#D8CBBE] rounded-xl p-8 hover:shadow-md transition-shadow cursor-pointer group" onClick={handleNavigateAdmin}>
                        <div className="h-14 w-14 rounded-full bg-[#fcf9f5] flex items-center justify-center text-[#a66b3a] mb-6 border border-[#f0e6da] group-hover:scale-105 transition-transform duration-300">
                            <Shield size={28} />
                        </div>
                        <h2 className="text-xl font-semibold text-[#2B2622] mb-1">Global Admin</h2>
                        <h3 className="text-sm font-medium text-[#a66b3a] mb-3">Centro de Comando</h3>
                        <p className="text-[#756A5F] text-sm leading-relaxed mb-8 flex-grow">
                            Administração global do sistema, gestão de acessos, de todas as unidades e parâmetros operacionais.
                        </p>
                        <button className="btn btn-outline w-full text-sm font-medium border-[#D8CBBE] text-[#2B2622] hover:bg-[#F7F3EE] group-hover:border-[#a66b3a] group-hover:text-[#a66b3a]">
                            Acessar Global
                        </button>
                    </div>
                )}

                {/* Unit Admin Card */}
                {(isAdmin || hasUnitAdminAccess) && (
                    <div className="card flex flex-col bg-white border border-[#D8CBBE] rounded-xl p-8 hover:shadow-md transition-shadow cursor-pointer group" onClick={handleNavigateUnitAdmin}>
                        <div className="h-14 w-14 rounded-full bg-[#fcf9f5] flex items-center justify-center text-[#a66b3a] mb-6 border border-[#f0e6da] group-hover:scale-105 transition-transform duration-300">
                            <Building size={28} />
                        </div>
                        <h2 className="text-xl font-semibold text-[#2B2622] mb-1">Unit Admin</h2>
                        <h3 className="text-sm font-medium text-[#a66b3a] mb-3">Gestão da Unidade</h3>
                        <p className="text-[#756A5F] text-sm leading-relaxed mb-8 flex-grow">
                            Gerenciamento administrativo local, configurações da unidade, TVs e permissões de usuários locais.
                        </p>
                        <button className="btn btn-outline w-full text-sm font-medium border-[#D8CBBE] text-[#2B2622] hover:bg-[#F7F3EE] group-hover:border-[#a66b3a] group-hover:text-[#a66b3a]">
                            Acessar Unidade
                        </button>
                    </div>
                )}

                {/* Editor Card (Gestão de Leitos) */}
                {(isAdmin || hasEditorAccess) && (
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

                {/* TV / Viewer Card */}
                {(isAdmin || hasViewerAccess) && (
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
