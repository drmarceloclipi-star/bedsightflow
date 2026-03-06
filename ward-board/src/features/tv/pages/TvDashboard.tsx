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
import { getReviewOfShiftKey } from '../../../domain/huddle';
import type { HuddleDoc } from '../../../domain/huddle';
import { HuddleRepository } from '../../../repositories/HuddleRepository';
import { computeEscalations, DEFAULT_ESCALATION_THRESHOLDS } from '../../../domain/escalation';
import { CheckSquare, Flame } from 'lucide-react';

const TvDashboard: React.FC = () => {
    const [searchParams] = useSearchParams();
    const unitId = searchParams.get('unit') || 'A';
    const forceScreen = searchParams.get('screen') || undefined;
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

    // Huddle Docs
    const [currentHuddle, setCurrentHuddle] = useState<HuddleDoc | null>(null);
    const [previousHuddle, setPreviousHuddle] = useState<HuddleDoc | null>(null);

    // Relógio atualizado a cada 30 segundos
    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(tick);
    }, []);

    // ── v1: Huddle pendente ──────────────────────────────────────────────────
    // O ciclo LSW só é considerado encerrado quando o huddle tem endedAt definido.
    // Usar apenas lastHuddleShiftKey (que é setado ao INICIAR o huddle) causava o
    // badge desaparecer assim que o huddle era aberto — antes de ser concluído (G3).
    const { huddlePending, huddleSubtext } = useMemo(() => {
        if (!opsSettings) return { huddlePending: false, huddleSubtext: '' };
        const schedule = opsSettings.huddleSchedule ?? DEFAULT_SHIFT_SCHEDULE;
        const shiftKey = currentShiftKey(schedule);

        // Huddle completo = documento existe E tem endedAt
        const huddleCompletedThisShift = currentHuddle !== null && currentHuddle.endedAt != null;

        // Pendente se: nenhum huddle foi concluído neste turno
        const pending = !huddleCompletedThisShift;

        let subtext: string;
        if (currentHuddle && !currentHuddle.endedAt) {
            // Huddle iniciado mas não encerrado
            subtext = 'Huddle em andamento — aguardando encerramento';
        } else if (!opsSettings.lastHuddleShiftKey || opsSettings.lastHuddleShiftKey !== shiftKey) {
            subtext = 'Nenhum huddle registrado neste turno';
        } else if (opsSettings.lastHuddleAt) {
            const raw = opsSettings.lastHuddleAt;
            const lastAt: Date | null =
                raw instanceof Date ? raw :
                    typeof raw === 'string' ? new Date(raw) :
                        (raw as { toDate?: () => Date }).toDate?.() ?? null;
            if (lastAt) {
                const diffH = Math.round((now.getTime() - lastAt.getTime()) / 3600000);
                subtext = `Último: ${opsSettings.lastHuddleType ?? ''} há ${diffH}h`;
            } else {
                subtext = 'Nenhum huddle registrado neste turno';
            }
        } else {
            subtext = 'Nenhum huddle registrado neste turno';
        }

        return { huddlePending: pending, huddleSubtext: subtext };
    }, [opsSettings, currentHuddle, now]);


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

    // Huddles Listener (amarrado ao opSettings e data/hora atual)
    useEffect(() => {
        if (!opsSettings) return;
        const schedule = opsSettings.huddleSchedule ?? DEFAULT_SHIFT_SCHEDULE;
        const currentKey = currentShiftKey(schedule);
        const prevKey = getReviewOfShiftKey(currentKey);

        const unsubCurrent = HuddleRepository.listenToHuddle(unitId, currentKey, setCurrentHuddle);

        // Previous might not be changing fast, but could be updated by the current shift reviewing it
        const unsubPrev = HuddleRepository.listenToHuddle(unitId, prevKey, setPreviousHuddle);

        return () => {
            unsubCurrent();
            unsubPrev();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unitId, opsSettings, now.getHours()]);

    // ── Escalation (v1 runtime) ──────────────────────────────────────────────────
    const escalationsTotal = useMemo(() => {
        if (!beds) return 0;
        const esc = computeEscalations(beds, DEFAULT_ESCALATION_THRESHOLDS, now);
        return esc.total;
    }, [beds, now]);

    // Banners state
    const currentActionsOpen = (currentHuddle?.topActions || []).filter(a => a.status === 'open').length;
    const previousActionsOpen = (previousHuddle?.topActions || []).filter(a => a.status === 'open').length;

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
                    <span className="unit-badge">{unit.name}</span>
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

            {/* ── Banners LSW v1 ───────────────────────────────────── */}
            {(currentActionsOpen > 0 || previousActionsOpen > 0 || escalationsTotal > 0) && (
                <div className="flex bg-surface-2 border-b border-divider divide-x divide-divider">
                    {currentActionsOpen > 0 && (
                        <div className="flex-1 px-4 py-2 flex items-center justify-center gap-2 text-warning animate-pulse" style={{ fontWeight: 700 }}>
                            <CheckSquare size={18} />
                            <span className="text-sm tracking-widest uppercase">Top 3 Ações: <span className="text-foreground">{currentActionsOpen} Aberta{currentActionsOpen > 1 ? 's' : ''}</span></span>
                        </div>
                    )}
                    {previousActionsOpen > 0 && (
                        <div className="flex-1 px-4 py-2 flex items-center justify-center gap-2 text-primary" style={{ fontWeight: 700 }}>
                            <CheckSquare size={18} />
                            <span className="text-sm tracking-widest uppercase">Review Pendente: <span className="text-foreground">{previousActionsOpen} Ação{previousActionsOpen > 1 ? 'ões' : ''}</span></span>
                        </div>
                    )}
                    {escalationsTotal > 0 && (
                        <div className="flex-1 px-4 py-2 flex items-center justify-center gap-2 text-danger animate-pulse bg-danger/10" style={{ fontWeight: 700 }}>
                            <Flame size={18} />
                            <span className="text-sm tracking-widest uppercase">Escalonamentos: <span className="text-foreground">{escalationsTotal} Crítico{escalationsTotal > 1 ? 's' : ''}</span></span>
                        </div>
                    )}
                </div>
            )}

            <main className="tv-main flex-1 overflow-hidden">
                {settings && (
                    <TvRotationContainer
                        beds={beds}
                        settings={settings}
                        opsSettings={opsSettings}
                        unitName={unit?.name}
                        now={now}
                        forceScreen={forceScreen}
                    />
                )}
            </main>
        </div>
    );
};

export default TvDashboard;
