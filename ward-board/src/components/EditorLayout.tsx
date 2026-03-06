import { Outlet, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Tv, ShieldAlert, ChevronLeft } from 'lucide-react';

import { useAuthStatus } from '../hooks/useAuthStatus';

export default function EditorLayout() {
    const [searchParams] = useSearchParams();
    const unitId = searchParams.get('unit') || '';
    const navigate = useNavigate();
    const location = useLocation();
    const { isAdmin } = useAuthStatus();

    // Determinar se estamos numa página "interna" (como /editor/bed/:id)
    const isRoot = location.pathname === '/editor' || location.pathname === '/editor/';

    return (
        <div className="mobile-layout">
            <header className="mobile-header">
                <div className="header-content relative py-2">
                    <div className="flex items-center gap-2 min-w-[60px] z-10">
                        {!isRoot && (
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center text-secondary hover:text-primary p-1 -ml-2 rounded-full hover:bg-surface-2 transition-colors mt-1"
                                aria-label="Voltar para a lista de leitos"
                            >
                                <ChevronLeft size={24} />
                            </button>
                        )}
                    </div>

                    <h1 className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none" aria-hidden="true">
                        <img src="/bedsight-flow-logo.png" alt="BedSight Flow" style={{ height: '24px', width: 'auto', maxWidth: 'calc(100vw - 160px)' }} />
                    </h1>

                    <div className="flex items-center gap-1 sm:gap-2 z-10 justify-end flex-1">
                        {isAdmin && (
                            <button
                                className="theme-toggle !text-primary hover:!bg-primary/10"
                                onClick={() => navigate('/mobile-admin')}
                                aria-label="Acessar painel de administração"
                                title="Acessar Admin"
                            >
                                <ShieldAlert size={20} />
                            </button>
                        )}
                        <button
                            className="theme-toggle"
                            onClick={() => navigate(`/tv?unit=${unitId}`)}
                            aria-label="Abrir modo TV da unidade"
                            title="Abrir TV"
                        >
                            <Tv size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="mobile-main pb-safe">
                <Outlet />
            </main>
        </div>
    );
}
