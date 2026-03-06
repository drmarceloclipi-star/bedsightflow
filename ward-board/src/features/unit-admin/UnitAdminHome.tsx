import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../infra/firebase/config';
import { UnitsRepository } from '../../repositories/UnitsRepository';
import type { Unit } from '../../domain/types';

const UnitAdminHome: React.FC = () => {
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
        <div className="admin-shell">
            <header className="admin-header">
                <div className="admin-header-top relative">
                    <div className="admin-header-left">
                        <span className="unit-badge">Unit Admin</span>
                    </div>
                    <span className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
                        <img
                            src="/bedsight-flow-logo.png"
                            alt="BedSight Flow"
                            className="w-auto object-contain"
                            style={{ height: '24px', maxWidth: 'calc(100vw - 160px)' }}
                        />
                    </span>
                    <div className="admin-header-right flex items-center gap-4">
                        <button onClick={handleLogout} className="admin-back-btn">Sair</button>
                    </div>
                </div>
            </header>

            <main className="admin-main">
                <div className="admin-home-header-group">
                    <h1 className="text-2xl font-serif text-primary mb-1">Gestão da Unidade</h1>
                    <p className="text-sm text-muted">
                        Selecione a sua unidade para gerenciar.
                    </p>
                </div>

                <div className="admin-section-grid">
                    <div className="flex justify-between items-center mb-4 col-span-full">
                        <h2 className="text-lg font-semibold text-primary">Unidades Disponíveis</h2>
                    </div>
                    {units.length === 0 ? (
                        <div className="p-8 text-center text-muted">
                            Nenhuma unidade encontrada.
                        </div>
                    ) : (
                        units.map(unit => (
                            <div key={unit.id} className="admin-card admin-card--interactive flex justify-between items-center">
                                <div>
                                    <div className="text-lg font-semibold text-primary mb-1">{unit.name}</div>
                                    <div className="text-sm text-muted">{unit.totalBeds} leitos</div>
                                </div>
                                <button
                                    onClick={() => navigate(`/unit-admin/${unit.id}`)}
                                    className="btn btn-primary"
                                >
                                    Gerenciar →
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default UnitAdminHome;
