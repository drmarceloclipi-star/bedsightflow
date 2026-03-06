import React, { useState, useEffect, useMemo } from 'react';
import { HuddleRepository } from '../../../../repositories/HuddleRepository';
import { currentShiftKey, DEFAULT_SHIFT_SCHEDULE } from '../../../../domain/shiftKey';
import type { HuddleDoc, HuddleItemStatus, ActionStatus } from '../../../../domain/huddle';
import type { UnitOpsSettings, ActorRef } from '../../../../domain/types';
import { computeHuddleCadence } from '../../../../domain/lswCadence';

interface Props {
    unitId: string;
    opsSettings: UnitOpsSettings | null;
    user: { uid: string; email: string | null; displayName: string | null } | null;
    flash: (msg: string, type: 'success' | 'error') => void;
}

const HuddleConsole: React.FC<Props> = ({ unitId, opsSettings, user, flash }) => {
    const [huddle, setHuddle] = useState<HuddleDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [shiftKey, setShiftKey] = useState('');

    // Form states
    const [isStarting, setIsStarting] = useState(false);
    const [newActionTitle, setNewActionTitle] = useState('');
    const [newActionOwner, setNewActionOwner] = useState('');

    const schedule = opsSettings?.huddleSchedule ?? DEFAULT_SHIFT_SCHEDULE;

    // P1-05: cadência LSW para detectar huddle OVERDUE (em andamento mas não encerrado há muito tempo)
    const cadenceState = useMemo(() => {
        if (!opsSettings) return null;
        return computeHuddleCadence(new Date(), opsSettings, schedule);
    }, [opsSettings, schedule]);

    useEffect(() => {
        const interval = setInterval(() => {
            const current = currentShiftKey(schedule);
            if (current !== shiftKey) {
                setShiftKey(current);
            }
        }, 60000); // Check every minute

        const initial = currentShiftKey(schedule);
        setShiftKey(initial);

        return () => clearInterval(interval);
    }, [schedule, shiftKey]);

    useEffect(() => {
        if (!unitId || !shiftKey) return;
        setLoading(true);
        const unsub = HuddleRepository.listenToHuddle(unitId, shiftKey, (data) => {
            setHuddle(data);
            setLoading(false);
        });
        return () => unsub();
    }, [unitId, shiftKey]);

    const handleStartHuddle = async (type: 'AM' | 'PM') => {
        if (!user) return;
        setIsStarting(true);
        try {
            const actor: ActorRef = { id: user.uid, name: user.displayName || user.email || user.uid };
            await HuddleRepository.upsertHuddleStart(unitId, type, actor, schedule);
            flash(`Huddle ${type} iniciado com sucesso.`, 'success');
        } catch (err) {
            console.error('Erro ao iniciar huddle:', err);
            flash('Erro ao iniciar huddle', 'error');
        } finally {
            setIsStarting(false);
        }
    };

    const handleEndHuddle = async () => {
        if (!huddle) return;
        try {
            await HuddleRepository.setHuddleEnded(unitId, huddle.id);
            flash('Huddle encerrado.', 'success');
        } catch (err) {
            console.error('Erro ao encerrar', err);
            flash('Erro ao encerrar', 'error');
        }
    };

    const handleToggleChecklist = async (key: string, currentStatus: HuddleItemStatus) => {
        if (!huddle) return;
        const nextStatus = currentStatus === 'done' ? 'skipped' : 'done';
        try {
            await HuddleRepository.updateChecklistItem(unitId, huddle.id, key, nextStatus);
        } catch (err) {
            console.error('Erro ao atualizar item', err);
            flash('Erro ao atualizar item', 'error');
        }
    };

    const handleAddAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!huddle || !user || !newActionTitle.trim()) return;
        try {
            const actor: ActorRef = { id: user.uid, name: user.displayName || user.email || user.uid };
            await HuddleRepository.addTopAction(unitId, huddle.id, {
                title: newActionTitle.trim(),
                ownerName: newActionOwner.trim() || undefined
            }, actor);
            setNewActionTitle('');
            setNewActionOwner('');
            flash('Ação adicionada', 'success');
        } catch (err) {
            const error = err as Error;
            flash(error.message || 'Erro ao adicionar ação', 'error');
        }
    };

    const handleUpdateActionStatus = async (actionId: string, status: ActionStatus) => {
        if (!huddle || !user) return;
        try {
            const actor: ActorRef = { id: user.uid, name: user.displayName || user.email || user.uid };
            await HuddleRepository.updateTopActionStatus(unitId, huddle.id, actionId, status, actor);
        } catch (err) {
            console.error('Erro ao atualizar ação', err);
            flash('Erro ao atualizar ação', 'error');
        }
    };

    if (loading) {
        return <div className="skeleton h-32 w-full rounded-lg" />;
    }

    const currentType = shiftKey.split('-').pop() as 'AM' | 'PM';
    const isEnded = !!huddle?.endedAt;

    return (
        <div className="bg-surface-1 border rounded-lg p-6 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-serif text-primary mb-1">Leader Standard Work (Huddle)</h3>
                    <p className="text-sm text-muted">
                        Gerencie a cadência operacional, revise escalonamentos e defina o Top 3 do turno.
                    </p>
                    <div className="mt-3 flex gap-4 text-sm bg-surface-2 p-3 rounded-lg border inline-flex flex-wrap">
                        <span><strong>Turno atual:</strong> <code className="font-mono text-primary-600">{shiftKey}</code></span>
                        <span><strong>Revisão de:</strong> <code className="font-mono text-muted">{huddle?.reviewOfShiftKey || '—'}</code></span>
                        {isEnded && (
                            <span className="text-success-600 font-semibold">✓ Encerrado</span>
                        )}
                    </div>
                </div>

                {!huddle ? (
                    <div className="flex gap-2">
                        <button
                            className="btn btn-primary"
                            disabled={isStarting}
                            onClick={() => handleStartHuddle(currentType)}
                        >
                            {isStarting ? 'Iniciando...' : `Iniciar Huddle ${currentType}`}
                        </button>
                    </div>
                ) : (
                    !isEnded && (
                        // P1-05: destaque vermelho quando OVERDUE para urgir encerramento
                        <button
                            className={`btn whitespace-nowrap ${cadenceState?.status === 'OVERDUE' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={handleEndHuddle}
                        >
                            {cadenceState?.status === 'OVERDUE' ? '⚠ Encerrar Turno (em atraso)' : 'Encerrar Turno'}
                        </button>
                    )
                )}
            </div>

            {/* P1-05: banner de atraso — visível quando huddle está em andamento (não encerrado) e OVERDUE */}
            {huddle && !isEnded && cadenceState?.status === 'OVERDUE' && (
                <div className="bg-state-danger-bg border border-state-danger text-state-danger px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2" role="alert">
                    <span aria-hidden="true">⚠</span>
                    <span>
                        Huddle em andamento há <strong>{cadenceState.minutesSinceShiftStart} min</strong> — encerre o turno para registrar a conclusão e remover o alerta na TV.
                    </span>
                </div>
            )}

            {huddle && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Checklist */}
                    <div>
                        <h4 className="text-md font-semibold text-primary mb-3">Checklist do Huddle</h4>
                        <div className="flex flex-col gap-2">
                            {huddle.checklist.map((item) => (
                                <label key={item.key} className="flex items-center gap-3 p-2 hover:bg-surface-2 rounded-md border border-transparent hover:border-border cursor-pointer transition-colors -ml-2">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={item.status === 'done'}
                                        onChange={() => handleToggleChecklist(item.key, item.status)}
                                    />
                                    <span className={`text-sm ${item.status === 'done' ? 'line-through text-muted' : 'text-primary'}`}>
                                        {item.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Top 3 Ações */}
                    <div className="flex flex-col gap-4">
                        <h4 className="text-md font-semibold text-primary mb-1">Top 3 Ações do Turno</h4>

                        <div className="flex flex-col gap-3">
                            {huddle.topActions.length === 0 ? (
                                <p className="text-sm text-muted italic">Nenhuma ação registrada para este turno.</p>
                            ) : (
                                huddle.topActions.map(action => (
                                    <div key={action.id} className="border p-3 rounded-md bg-surface-2 flex flex-col gap-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <p className={`text-sm font-semibold ${action.status !== 'open' ? 'line-through text-muted' : ''}`}>{action.title}</p>
                                                {action.ownerName && <p className="text-xs text-muted mt-0.5">Resp: {action.ownerName}</p>}
                                            </div>
                                            <div className="flex gap-1">
                                                {action.status === 'open' ? (
                                                    <>
                                                        <button
                                                            className="text-xs px-2 py-1 bg-success-100 text-success-800 hover:bg-success-200 rounded"
                                                            onClick={() => handleUpdateActionStatus(action.id, 'done')}
                                                        >
                                                            Concluir
                                                        </button>
                                                        <button
                                                            className="text-xs px-2 py-1 bg-surface-3 text-muted hover:bg-surface-4 rounded"
                                                            onClick={() => handleUpdateActionStatus(action.id, 'canceled')}
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className={`text-xs px-2 py-1 rounded font-semibold ${action.status === 'done' ? 'bg-success-100 text-success-800' : 'bg-surface-3 text-muted'}`}>
                                                        {action.status === 'done' ? 'Concluída' : 'Cancelada'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {huddle.topActions.filter(a => a.status === 'open').length < 3 && !isEnded ? (
                            <form onSubmit={handleAddAction} className="bg-surface-2 border border-dashed border-border-strong rounded-lg p-4 mt-2">
                                <h5 className="text-sm font-semibold mb-3">Adicionar nova ação</h5>
                                <div className="flex flex-col gap-3">
                                    <input
                                        type="text"
                                        placeholder="O que precisa ser feito?"
                                        className="input py-1.5 px-3 text-sm h-auto"
                                        value={newActionTitle}
                                        onChange={e => setNewActionTitle(e.target.value)}
                                        required
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Dono (opcional)"
                                            className="input py-1.5 px-3 text-sm h-auto flex-1"
                                            value={newActionOwner}
                                            onChange={e => setNewActionOwner(e.target.value)}
                                        />
                                        <button type="submit" className="btn btn-primary text-sm py-1.5 px-4 h-auto min-h-0" disabled={!newActionTitle.trim()}>
                                            Adicionar
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            !isEnded && <p className="text-xs text-danger font-semibold mt-2 px-2">
                                Máximo de 3 ações abertas atingido. Conclua ou cancele algo para incluir mais.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {huddle && (huddle.startSummary || huddle.snapshotSummary) && (
                <div className="mt-4 pt-6 border-t border-border-strong">
                    <h4 className="text-md font-semibold text-primary mb-4 flex items-center justify-between">
                        <span>Snapshot Operacional</span>
                        {huddle.endSummary && <span className="text-xs font-normal text-muted bg-surface-2 px-2 py-0.5 rounded border">Concluído</span>}
                    </h4>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        <MetricDeltaCard label="Leitos c/ Bloqueio"
                            start={huddle.startSummary?.blockedBedsCount ?? huddle.snapshotSummary?.blockedBedsCount}
                            end={huddle.endSummary?.blockedBedsCount}
                            invertColors={true} />
                        <MetricDeltaCard label="Max Aging (h)"
                            start={huddle.startSummary?.maxBlockedAgingHours ?? huddle.snapshotSummary?.maxBlockedAgingHours}
                            end={huddle.endSummary?.maxBlockedAgingHours}
                            invertColors={true} />
                        <MetricDeltaCard label="🔥 Escalonamentos (Críticos)"
                            start={huddle.startSummary?.escalationsOverdueCritical ?? huddle.snapshotSummary?.escalationsOverdueCritical}
                            end={huddle.endSummary?.escalationsOverdueCritical}
                            invertColors={true} />
                        <MetricDeltaCard label="Pendências Vencidas"
                            start={huddle.startSummary?.overduePendenciesCount ?? huddle.snapshotSummary?.overduePendenciesCount}
                            end={huddle.endSummary?.overduePendenciesCount}
                            invertColors={true} />
                        <MetricDeltaCard label="Não Revisados"
                            start={huddle.startSummary?.unreviewedBedsCount ?? huddle.snapshotSummary?.unreviewedBedsCount}
                            end={huddle.endSummary?.unreviewedBedsCount}
                            invertColors={true} />
                        <MetricDeltaCard label="Altas (24h)"
                            start={huddle.startSummary?.dischargeNext24hCount ?? huddle.snapshotSummary?.dischargeNext24hCount}
                            end={huddle.endSummary?.dischargeNext24hCount}
                            invertColors={false} />
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper components
const MetricDeltaCard = ({ label, start, end, invertColors = false }: { label: string, start?: number, end?: number, invertColors?: boolean }) => {
    if (start === undefined) return null;

    const hasEnd = end !== undefined;
    const diff = hasEnd ? end - start! : 0;

    let colorClass = "text-muted";
    let deltaText = "";

    if (hasEnd && diff !== 0) {
        // Se invertColors (ex: bad se aumentar), diff positivo = vermelho, negativo = verde
        const isGood = invertColors ? diff < 0 : diff > 0;
        colorClass = isGood ? "text-success-600" : "text-danger-600";
        deltaText = diff > 0 ? `+${diff}` : `${diff}`;
    }

    return (
        <div className="bg-surface-2 p-3 rounded-md border flex flex-col gap-1">
            <span className="text-xs text-muted font-medium line-clamp-1" title={label}>{label}</span>
            <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-semibold text-primary">{start}</span>
                {hasEnd && (
                    <>
                        <span className="text-xs text-muted">→</span>
                        <span className="text-lg font-semibold text-primary">{end}</span>
                        {diff !== 0 && (
                            <span className={`text-xs font-bold ml-auto ${colorClass}`}>{deltaText}</span>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default HuddleConsole;
