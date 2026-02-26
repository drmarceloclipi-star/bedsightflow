import { Outlet, useSearchParams } from 'react-router-dom';
import ThemeToggle from '../shared/theme/ThemeToggle';

export default function MobileLayout() {
    const [searchParams] = useSearchParams();
    const unitId = searchParams.get('unit') || 'A';

    return (
        <div className="mobile-layout">
            <header className="mobile-header">
                <div className="header-content">
                    <div className="flex items-center gap-2">
                        <h1>Ward Board</h1>
                        <span className="unit-badge">Unidade {unitId}</span>
                    </div>
                    <ThemeToggle />
                </div>
            </header>

            <main className="mobile-main">
                <Outlet />
            </main>
        </div>
    );
}
