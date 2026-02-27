import { Outlet, useSearchParams, useNavigate } from 'react-router-dom';
import { Tv } from 'lucide-react';
import ThemeToggle from '../shared/theme/ThemeToggle';

export default function MobileLayout() {
    const [searchParams] = useSearchParams();
    const unitId = searchParams.get('unit') || 'A';
    const navigate = useNavigate();

    return (
        <div className="mobile-layout">
            <header className="mobile-header">
                <div className="header-content">
                    <div className="flex items-center gap-2">
                        <h1>BedSight</h1>
                        <span className="unit-badge">Unidade {unitId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="theme-toggle"
                            onClick={() => navigate(`/tv?unit=${unitId}`)}
                            aria-label="Abrir versão TV"
                            title="Abrir versão TV"
                        >
                            <Tv size={20} />
                        </button>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="mobile-main">
                <Outlet />
            </main>
        </div>
    );
}
