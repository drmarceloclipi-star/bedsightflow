import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../infra/firebase/config';
import { UnitsRepository } from '../../repositories/UnitsRepository';
import type { Unit } from '../../domain/types';

/**
 * MobileAdminHome — Mobile-optimised Global Admin home panel.
 *
 * Same scope as AdminHome (institution-level) but optimised for mobile.
 * Global users management has been moved to the Super Admin panel.
 */
const MobileAdminHome: React.FC = () => {
    const navigate = useNavigate();
    const [units, setUnits] = useState<Unit[]>([]);

    useEffect(() => {
        const unsub = UnitsRepository.listenToUnits(setUnits);
        return unsub;
    }, []);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    return (
        <div className="madmin-shell">
            {/* Sticky header */}
            <header className="madmin-header">
                <div className="madmin-header-inner relative">
                    <div className="madmin-header-left" />
                    <span className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
                        <img src="/bedsight-flow-logo.png" alt="BedSight Flow" style={{ height: '24px', width: 'auto', maxWidth: 'calc(100vw - 140px)' }} />
                    </span>
                    <div className="flex items-center gap-3">
                        <button onClick={handleLogout} className="madmin-logout-btn">
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="madmin-main">
                <div className="madmin-page-title-group">
                    <h1 className="madmin-page-title">Painel da Instituição</h1>
                    <p className="madmin-page-subtitle">Selecione uma unidade para gerenciar.</p>
                </div>

                {/* Units list */}
                <div className="madmin-list">
                    {units.length === 0 ? (
                        <div className="madmin-empty-state">
                            <span className="madmin-empty-icon">🏥</span>
                            <p>Nenhuma unidade encontrada.</p>
                        </div>
                    ) : (
                        units.map(unit => (
                            <div key={unit.id} className="madmin-card madmin-unit-card">
                                <div className="madmin-unit-info">
                                    <div className="madmin-unit-card-name">{unit.name}</div>
                                    <div className="madmin-unit-card-meta">
                                        {unit.totalBeds} leitos · ID: {unit.id}
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate(`/mobile-admin/unit/${unit.id}`)}
                                    className="madmin-btn madmin-btn-primary madmin-btn-sm"
                                >
                                    Entrar →
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default MobileAdminHome;
