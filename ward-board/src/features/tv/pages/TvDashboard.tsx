import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Bed, BoardSettings, Unit } from '../../../domain/types';
import { BedsRepository } from '../../../repositories/BedsRepository';
import { BoardSettingsRepository } from '../../../repositories/BoardSettingsRepository';
import { UnitsRepository } from '../../../repositories/UnitsRepository';
import TvRotationContainer from '../components/TvRotationContainer';
import ThemeToggle from '../../../shared/theme/ThemeToggle';

const TvDashboard: React.FC = () => {
    const [searchParams] = useSearchParams();
    const unitId = searchParams.get('unit') || 'A';

    const [beds, setBeds] = useState<Bed[]>([]);
    const [settings, setSettings] = useState<BoardSettings | null>(null);
    const [unit, setUnit] = useState<Unit | null>(null);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Relógio atualizado a cada 30 segundos
    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(tick);
    }, []);

    useEffect(() => {
        // Listen to beds
        const unsubscribeBeds = BedsRepository.listenToBeds(unitId, (data) => {
            setBeds(data);
            setLastUpdated(new Date());
        });

        // Listen to settings
        const unsubscribeSettings = BoardSettingsRepository.listenToSettings(unitId, (data: BoardSettings) => {
            setSettings(data);
            setLastUpdated(new Date());
        });

        // Get unit info
        UnitsRepository.getUnit(unitId).then(setUnit).finally(() => {
            setLoading(false);
        });

        return () => {
            unsubscribeBeds();
            unsubscribeSettings();
        };
    }, [unitId]);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-app">
                <div className="text-2xl font-serif animate-pulse">Carregando painel...</div>
            </div>
        );
    }

    if (!unit) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-app gap-4">
                <div className="text-3xl font-serif">Unidade não encontrada</div>
                <div className="text-muted">Verifique o parâmetro ?unit={unitId} na URL.</div>
            </div>
        );
    }

    return (
        <div className="tv-dashboard h-screen flex flex-col">
            <header className="tv-header flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h1 className="text-4xl">Ward Board</h1>
                    <span className="unit-badge text-lg px-4 py-1">{unit.name}</span>
                </div>
                <div className="flex items-center gap-6">
                    <ThemeToggle />
                    <div className="text-right">
                        <div className="text-2xl font-serif mt-1">
                            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="text-muted font-bold tracking-widest text-xl">
                                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {lastUpdated && (
                                <div className="text-[10px] text-muted-more uppercase tracking-tighter mt-0.5 opacity-60">
                                    Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-hidden">
                {settings && (
                    <TvRotationContainer
                        beds={beds}
                        settings={settings}
                        unitName={unit.name}
                    />
                )}
            </main>
        </div>
    );
};

export default TvDashboard;
