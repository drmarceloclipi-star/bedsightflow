import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Smartphone, ShieldAlert } from 'lucide-react';
import type { Bed, BoardSettings, Unit, UnitOpsSettings } from '../../../domain/types';
import { BedsRepository } from '../../../repositories/BedsRepository';
import { BoardSettingsRepository } from '../../../repositories/BoardSettingsRepository';
import { UnitsRepository } from '../../../repositories/UnitsRepository';
import { UnitSettingsRepository } from '../../../repositories/UnitSettingsRepository';
import TvRotationContainer from '../components/TvRotationContainer';
import ThemeToggle from '../../../shared/theme/ThemeToggle';
import { useAuthStatus } from '../../../hooks/useAuthStatus';
import { currentShiftKey, DEFAULT_SHIFT_SCHEDULE } from '../../../domain/shiftKey';

const TvDashboard: React.FC = () => {
    const [searchParams] = useSearchParams();
    const unitId = searchParams.get('unit') || 'A';
    const navigate = useNavigate();
    const { isAdmin } = useAuthStatus();

    const [beds, setBeds] = useState<Bed[]>([]);
    const [settings, setSettings] = useState<BoardSettings | null>(null);
    const [unit, setUnit] = useState<Unit | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [opsSettings, setOpsSettings] = useState<UnitOpsSettings | null>(null);

    // Relógio atualizado a cada 30 segundos
    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(tick);
    }, []);

    // ── v1: Huddle pendente ──────────────────────────────────────────────────
    // Computa UMA VEZ por ciclo de render. Usa 'now' (state) — nunca Date.now() direto no JSX.
    const { huddlePending, huddleSubtext } = useMemo(() => {
        if (!opsSettings) return { huddlePending: false, huddleSubtext: '' };
        const schedule = opsSettings.huddleSchedule ?? DEFAULT_SHIFT_SCHEDULE;
        const shiftKey = currentShiftKey(schedule);
        const pending = !opsSettings.lastHuddleShiftKey || opsSettings.lastHuddleShiftKey !== shiftKey;
        let subtext = 'Nenhum huddle registrado neste turno';
        if (opsSettings.lastHuddleAt) {
            const raw = opsSettings.lastHuddleAt;
            const lastAt: Date | null =
                raw instanceof Date ? raw :
                    typeof raw === 'string' ? new Date(raw) :
                        (raw as { toDate?: () => Date }).toDate?.() ?? null;
            if (lastAt) {
                const diffH = Math.round((now.getTime() - lastAt.getTime()) / 3600000);
                subtext = `Último: ${opsSettings.lastHuddleType ?? ''} há ${diffH}h`;
            }
        }
        return { huddlePending: pending, huddleSubtext: subtext };
    }, [opsSettings, now]);


    useEffect(() => {
        const handleError = (err: Error) => {
            console.error('TV Dashboard Error:', err);
            setError('Perda de conexão com o banco de dados. Tentando reconectar...');
        };

        // Listen to beds
        const unsubscribeBeds = BedsRepository.listenToBeds(unitId, (data) => {
            setBeds(data);
            setLastUpdated(new Date());
            setError(null); // Clear error on success
        }, handleError);

        // Listen to settings
        const unsubscribeSettings = BoardSettingsRepository.listenToSettings(unitId, (data: BoardSettings) => {
            setSettings(data);
            setLastUpdated(new Date());
            setError(null); // Clear error on success
        }, handleError);

        // Get unit info
        UnitsRepository.getUnit(unitId).then(setUnit).catch(handleError).finally(() => {
            setLoading(false);
        });

        const unsubscribeOps = UnitSettingsRepository.subscribeUnitOpsSettings(unitId, setOpsSettings);

        return () => {
            unsubscribeBeds();
            unsubscribeSettings();
            unsubscribeOps();
        };
    }, [unitId]);

    if (loading) {
        return (
            <div className="h-screen flex flex-col bg-app overflow-hidden p-8">
                <header className="flex justify-between items-center mb-12">
                    <div className="flex items-center gap-6">
                        <div className="skeleton h-16 w-64" />
                        <div className="skeleton h-10 w-24" />
                    </div>
                    <div className="skeleton h-16 w-80" />
                </header>
                <main className="flex-1 flex gap-8">
                    <div className="flex-1 skeleton h-full rounded-2xl" />
                </main>
            </div>
        );
    }

    if (error && beds.length === 0) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-app p-8 text-center">
                <div className="text-6xl mb-6">📡</div>
                <h1 className="text-3xl font-serif mb-4">Problema de Conexão</h1>
                <p className="text-muted max-w-lg mb-8">
                    Não foi possível estabelecer uma conexão em tempo real com o servidor.
                    O painel tentará se reconectar automaticamente assim que a rede estiver disponível.
                </p>
                <div className="text-sm font-mono bg-surface-2 p-3 rounded border border-danger/20 text-danger">
                    {error}
                </div>
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
            <header className="tv-header flex justify-between items-center relative">
                <div className="tv-header-left">
                    <span className="unit-badge text-lg px-4 py-1">{unit.name}</span>
                </div>
                <h1 className="tv-title absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
                    <img
                        src="/bedsight-flow-logo.png"
                        alt="BedSight Flow"
                        className="w-auto object-contain"
                        style={{ height: '40px', maxWidth: 'calc(100vw - 250px)' }}
                    />
                </h1>
                <div className="tv-header-controls flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        {isAdmin && (
                            <button
                                className="theme-toggle !text-primary hover:!bg-primary/10"
                                onClick={() => navigate('/admin')}
                                aria-label="Voltar para Admin"
                                title="Voltar para Admin"
                            >
                                <ShieldAlert size={20} />
                            </button>
                        )}
                        <button
                            className="theme-toggle"
                            onClick={() => navigate(`/editor?unit=${unitId}`)}
                            aria-label="Abrir versão Mobile"
                            title="Abrir versão Mobile"
                        >
                            <Smartphone size={20} />
                        </button>
                        <ThemeToggle />
                    </div>
                    <div className="tv-date-wrapper text-right hidden md:flex flex-col items-end">
                        <div className="tv-date text-2xl font-serif mt-1">
                            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        <div className="tv-time text-muted font-bold tracking-widest text-xl">
                            {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {opsSettings && (
                            <div className="tv-mode text-[10px] text-muted-more uppercase tracking-tighter mt-0.5 opacity-60">
                                Modo: {opsSettings.kanbanMode}
                            </div>
                        )}
                        {lastUpdated && (
                            <div className="tv-last-updated text-[10px] text-muted-more uppercase tracking-tighter mt-0.5 opacity-60">
                                Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Badge HUDDLE PENDENTE (v1) ─────────────────────────────────────
                Aparece no topo quando lastHuddleShiftKey !== currentShiftKey.
                Desaparece em realtime após registerHuddle() ser chamado. */}
            {huddlePending && (
                <div
                    className="huddle-pending-badge"
                    role="alert"
                    aria-live="polite"
                    style={{
                        background: 'var(--state-warning-bg)',
                        borderBottom: '2px solid var(--state-warning)',
                        color: 'var(--state-warning)',
                        padding: '0.4rem 2rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                    }}
                >
                    <span>⚠ HUDDLE PENDENTE</span>
                    <span style={{ fontWeight: 400, opacity: 0.75, textTransform: 'none', letterSpacing: 0 }}>
                        {huddleSubtext}
                    </span>
                </div>
            )}

            <main className="tv-main flex-1 overflow-hidden">
                {settings && (
                    <TvRotationContainer
                        beds={beds}
                        settings={settings}
                        unitName={unit.name}
                        opsSettings={opsSettings}
                        now={now}
                    />
                )}
            </main>
        </div>
    );
};

export default TvDashboard;
