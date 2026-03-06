import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStatus } from '../hooks/useAuthStatus';
import { Shield, Monitor, LayoutDashboard } from 'lucide-react';
import { isMobileDevice } from '../utils/device';

const PortalScreen: React.FC = () => {
    const { user, isAdmin } = useAuthStatus();
    const navigate = useNavigate();

    // The component might briefly render while loading is finishing in App.tsx
    if (!user) return null;

    const handleNavigateAdmin = () => {
        if (isMobileDevice()) {
            navigate('/mobile-admin');
        } else {
            navigate('/admin');
        }
    };

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

            <div className={`grid gap-6 w-full max-w-5xl ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2 justify-center max-w-3xl'}`}>

                {/* Admin Card */}
                {isAdmin && (
                    <div className="card flex flex-col bg-white border border-[#D8CBBE] rounded-xl p-8 hover:shadow-md transition-shadow cursor-pointer group" onClick={handleNavigateAdmin}>
                        <div className="h-14 w-14 rounded-full bg-[#fcf9f5] flex items-center justify-center text-[#a66b3a] mb-6 border border-[#f0e6da] group-hover:scale-105 transition-transform duration-300">
                            <Shield size={28} />
                        </div>
                        <h2 className="text-xl font-semibold text-[#2B2622] mb-3">Centro de Comando</h2>
                        <p className="text-[#756A5F] text-sm leading-relaxed mb-8 flex-grow">
                            Administração global do sistema, gestão de acessos, unidades e parâmetros operacionais.
                        </p>
                        <button className="btn btn-outline w-full text-sm font-medium border-[#D8CBBE] text-[#2B2622] hover:bg-[#F7F3EE] group-hover:border-[#a66b3a] group-hover:text-[#a66b3a]">
                            Acessar Administração
                        </button>
                    </div>
                )}

                {/* Editor Card */}
                <div className="card flex flex-col bg-white border border-[#D8CBBE] rounded-xl p-8 hover:shadow-md transition-shadow cursor-pointer group" onClick={handleNavigateEditor}>
                    <div className="h-14 w-14 rounded-full bg-[#fcf9f5] flex items-center justify-center text-[#a66b3a] mb-6 border border-[#f0e6da] group-hover:scale-105 transition-transform duration-300">
                        <LayoutDashboard size={28} />
                    </div>
                    <h2 className="text-xl font-semibold text-[#2B2622] mb-3">Gestão de Leitos</h2>
                    <p className="text-[#756A5F] text-sm leading-relaxed mb-8 flex-grow">
                        Gerenciamento operacional das unidades, status dos leitos, pendências e atualizações clínicas diárias.
                    </p>
                    <button className="btn btn-primary w-full text-sm font-medium bg-[#a66b3a] hover:bg-[#8f5a2f] border-none shadow-sm">
                        Acessar Gestão
                    </button>
                </div>

                {/* TV / Viewer Card */}
                <div className="card flex flex-col bg-white border border-[#D8CBBE] rounded-xl p-8 hover:shadow-md transition-shadow cursor-pointer group" onClick={handleNavigateTv}>
                    <div className="h-14 w-14 rounded-full bg-[#fcf9f5] flex items-center justify-center text-[#a66b3a] mb-6 border border-[#f0e6da] group-hover:scale-105 transition-transform duration-300">
                        <Monitor size={28} />
                    </div>
                    <h2 className="text-xl font-semibold text-[#2B2622] mb-3">Modo Visualização</h2>
                    <p className="text-[#756A5F] text-sm leading-relaxed mb-8 flex-grow">
                        Quadro Kanban passivo para displays em estações de enfermagem e monitores de parede.
                    </p>
                    <button className="btn btn-outline w-full text-sm font-medium border-[#D8CBBE] text-[#2B2622] hover:bg-[#F7F3EE] group-hover:border-[#a66b3a] group-hover:text-[#a66b3a]">
                        Abrir Dashboard TV
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PortalScreen;
