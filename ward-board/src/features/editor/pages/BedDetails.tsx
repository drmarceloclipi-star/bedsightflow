import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { Bed, SpecialtyKey, KamishibaiStatus, DischargeEstimate, UnitOpsSettings } from '../../../domain/types';
import { DischargeEstimateLabel } from '../../../domain/types';
import { BedsRepository } from '../../../repositories/BedsRepository';
import { UnitSettingsRepository } from '../../../repositories/UnitSettingsRepository';
import { auth } from '../../../infra/firebase/config';
import { KAMISHIBAI_DOMAINS, getKamishibaiLabel } from '../../../domain/specialtyUtils';
import { resolveKamishibaiVisualState, visualStateLabel } from '../../../domain/kamishibaiVisualState';
import { currentShiftKey, DEFAULT_SHIFT_SCHEDULE } from '../../../domain/shiftKey';
import { useAuthStatus } from '../../../hooks/useAuthStatus';

const BedDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const unitId = searchParams.get('unit') || 'A';
    const { isAdmin } = useAuthStatus();

    const [bed, setBed] = useState<Bed | null>(null);
    const [aliasText, setAliasText] = useState('');
    const [blockerText, setBlockerText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [opsSettings, setOpsSettings] = useState<UnitOpsSettings | null>(null);

    // Pendências v1
    const [showDonePendencies, setShowDonePendencies] = useState(false);
    const [showCanceledPendencies, setShowCanceledPendencies] = useState(false);
    const [newPendencyTitle, setNewPendencyTitle] = useState('');
    const [newPendencyDomain, setNewPendencyDomain] = useState<SpecialtyKey | ''>('');
    const [newPendencyDueAt, setNewPendencyDueAt] = useState('');
    const [pendencySaving, setPendencySaving] = useState(false);

    // Build actor payload from currently logged-in user for audit trail
    const getActor = () => {
        const u = auth.currentUser;
        if (!u) return undefined;
        return {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || u.email || '',
            role: 'editor' as const,
        };
    };

    useEffect(() => {
        if (!id) return;

        const unsubscribe = BedsRepository.listenToBed(unitId, id, (currentBed) => {
            setBed(currentBed);
            if (currentBed) {
                setBlockerText(prev => prev || currentBed.mainBlocker || '');
                setAliasText(prev => prev || currentBed.patientAlias || '');
            }
        });

        const unsubscribeOps = UnitSettingsRepository.subscribeUnitOpsSettings(unitId, setOpsSettings);

        return () => {
            unsubscribe();
            unsubscribeOps();
        };
    }, [id, unitId]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleError = (error: any) => {
        setIsSaving(false);
        console.error('Action failed:', error);
        if (error?.code === 'permission-denied') {
            setErrorMsg('Permissão negada. Apenas editores podem fazer alterações.');
        } else {
            setErrorMsg('Erro inesperado ocorreu.');
        }
        setTimeout(() => setErrorMsg(null), 4000);
    };

    const handleSaveAlias = async () => {
        if (!bed || !id) return;
        const textToSave = aliasText.trim();
        if (!textToSave) {
            setErrorMsg('As iniciais do paciente são obrigatórias.');
            setAliasText(bed.patientAlias || '');
            setTimeout(() => setErrorMsg(null), 3000);
            return;
        }
        if (textToSave === bed.patientAlias) return;
        setIsSaving(true);
        try {
            await BedsRepository.updateBed(unitId, id, { patientAlias: textToSave.substring(0, 50) }, getActor());
            setIsSaving(false);
        } catch (error) {
            handleError(error);
        }
    };

    const handleUpdateDischarge = async (value: DischargeEstimate) => {
        if (!bed || !id) return;
        if (bed.expectedDischarge === value) {
            setErrorMsg('A previsão de alta é obrigatória e não pode ser removida.');
            setTimeout(() => setErrorMsg(null), 3000);
            return;
        }
        setIsSaving(true);
        try {
            await BedsRepository.updateBed(unitId, id, { expectedDischarge: value }, getActor());
            setIsSaving(false);
        } catch (error) {
            handleError(error);
        }
    };

    const handleSaveBlocker = async () => {
        if (!bed || !id) return;
        let textToSave = blockerText.trim();
        if (textToSave.length > 200) {
            textToSave = textToSave.substring(0, 200);
            setBlockerText(textToSave);
            setErrorMsg('O texto foi truncado para o limite de 200 caracteres.');
            setTimeout(() => setErrorMsg(null), 3000);
        }
        if (textToSave === bed.mainBlocker) return;
        setIsSaving(true);
        try {
            await BedsRepository.updateBed(unitId, id, { mainBlocker: textToSave }, getActor());
            setIsSaving(false);
        } catch (error) {
            handleError(error);
        }
    };

    const handleUpdateKamishibai = async (specialty: SpecialtyKey, status: KamishibaiStatus) => {
        if (!bed || !id) return;
        setIsSaving(true);
        try {
            const now = new Date().toISOString();
            const schedule = opsSettings?.huddleSchedule ?? DEFAULT_SHIFT_SCHEDULE;
            const shiftKey = currentShiftKey(schedule);

            const existing = bed.kamishibai?.[specialty];
            const newEntry = {
                ...existing,
                status,
                updatedAt: now,
                // ── v1: campos de turno ──────────────────────────────────
                reviewedShiftKey: shiftKey,
                reviewedAt: now,
                // ── v1: histórico de bloqueio ─────────────────────────────
                // blockedAt: gravado apenas na PRIMEIRA vez que vira blocked
                blockedAt:
                    status === 'blocked'
                        ? (existing?.blockedAt ?? now)  // preserva blockedAt original se já existia
                        : existing?.blockedAt,           // mantém para histórico mesmo após resolver
                // resolvedAt: gravado quando sai de blocked para ok
                resolvedAt:
                    status === 'ok' && existing?.status === 'blocked'
                        ? now
                        : existing?.resolvedAt,
            };

            const newKamishibai = { ...bed.kamishibai, [specialty]: newEntry };
            await BedsRepository.updateBed(unitId, id, { kamishibai: newKamishibai }, getActor());
            setIsSaving(false);
        } catch (error) {
            handleError(error);
        }
    };

    const handleToggleSpecialty = async (specialty: SpecialtyKey) => {
        if (!bed || !id) return;
        setIsSaving(true);
        try {
            const currentSpecialties = bed.involvedSpecialties || [];
            let newSpecialties: SpecialtyKey[];

            if (currentSpecialties.includes(specialty)) {
                newSpecialties = currentSpecialties.filter(s => s !== specialty);
            } else {
                newSpecialties = [...currentSpecialties, specialty];
            }

            await BedsRepository.updateBed(unitId, id, { involvedSpecialties: newSpecialties }, getActor());
            setIsSaving(false);
        } catch (error) {
            handleError(error);
        }
    };

    // ── Pendências v1 ────────────────────────────────────────────
    // nowMs calculado fora do render (evita impure Date.now() dentro de JSX)
    const nowMs = useMemo(() => Date.now(), []);

    const buildActorRef = (): import('../../../domain/types').ActorRef => {
        const u = auth.currentUser;
        return { id: u?.uid ?? 'anon', name: u?.displayName || u?.email || 'Usuário' };
    };

    const handleAddPendency = async () => {
        if (!newPendencyTitle.trim() || !id) return;
        setPendencySaving(true);
        try {
            const pendency: import('../../../domain/types').Pendency = {
                id: crypto.randomUUID(),
                title: newPendencyTitle.trim(),
                ...(newPendencyDomain ? { domain: newPendencyDomain as SpecialtyKey } : {}),
                ...(newPendencyDueAt ? { dueAt: new Date(newPendencyDueAt).toISOString() } : {}),
                createdAt: new Date().toISOString(),
                createdBy: buildActorRef(),
                status: 'open',
            };
            await BedsRepository.addPendency(unitId, id, pendency);
            setNewPendencyTitle('');
            setNewPendencyDomain('');
            setNewPendencyDueAt('');
        } catch (e) { console.error('addPendency error:', e); }
        finally { setPendencySaving(false); }
    };

    const handleMarkDone = async (pendencyId: string) => {
        if (!id) return;
        try { await BedsRepository.markPendencyDone(unitId, id, pendencyId, buildActorRef()); }
        catch (e) { console.error('markDone error:', e); }
    };

    const handleCancelPendency = async (pendencyId: string) => {
        if (!id) return;
        try { await BedsRepository.cancelPendency(unitId, id, pendencyId, buildActorRef()); }
        catch (e) { console.error('cancelPendency error:', e); }
    };

    // Admin-only: remove fisicamente do array
    const handleDeletePendency = async (pendencyId: string) => {
        if (!id || !isAdmin) return;
        try { await BedsRepository.deletePendency(unitId, id, pendencyId, buildActorRef()); }
        catch (e) { console.error('deletePendency error:', e); }
    };

    if (!bed) {
        return (
            <div className="p-4 flex flex-col gap-6">
                <header className="flex items-center gap-4">
                    <div className="skeleton skeleton-circle" />
                    <div className="flex-1">
                        <div className="skeleton h-6 w-32 mb-2" />
                        <div className="skeleton h-4 w-20" />
                    </div>
                </header>
                <div className="skeleton h-48 w-full rounded-xl" />
                <div className="skeleton h-64 w-full rounded-xl" />
            </div>
        );
    }

    return (
        <div className="p-4 bed-details flex flex-col gap-5 md:gap-6 animate-slideIn">
            <header className="flex flex-col gap-1">
                <div className="flex-1 min-w-0 flex items-baseline justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-serif">Leito {bed.number}</h2>
                        {opsSettings && (
                            <span className="text-[10px] text-muted-more uppercase opacity-50 font-mono tracking-wider">
                                Modo: {opsSettings.kanbanMode}
                            </span>
                        )}
                    </div>
                    {isSaving && <div className="text-saving animate-pulse font-bold text-xs uppercase tracking-wider text-accent-primary">SALVANDO...</div>}
                </div>

                <div className="mt-1">
                    <label htmlFor="patient-alias" className="text-[10px] uppercase font-bold text-muted block mb-0.5">Iniciais do Paciente</label>
                    <input
                        id="patient-alias"
                        type="text"
                        className="w-full bg-surface-1 border border-soft focus:border-accent-primary rounded-md px-3 py-2 text-sm text-primary outline-none transition-colors shadow-sm"
                        placeholder="Ex: M.A.S"
                        value={aliasText}
                        onChange={(e) => setAliasText(e.target.value)}
                        onBlur={handleSaveAlias}
                        maxLength={50}
                    />
                </div>
            </header>

            {errorMsg && (
                <div className="bg-state-danger-bg border border-state-danger text-state-danger px-4 py-3 rounded-lg text-sm font-semibold shadow-sm animate-slideIn">
                    {errorMsg}
                </div>
            )}

            {/* Especialidades Section */}
            <section className="bg-surface-1 p-4 rounded-xl border shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Especialidades</h3>

                <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg cursor-pointer hover:bg-surface-2/80 transition-colors border border-transparent">
                        <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-soft text-accent-primary focus:ring-accent-primary/20 bg-surface-1"
                            checked={(bed.involvedSpecialties || []).includes('medical')}
                            onChange={() => handleToggleSpecialty('medical')}
                        />
                        <span className="text-sm font-semibold">Clínica Médica (CM)</span>
                    </label>
                </div>
            </section>

            {/* Kanban Section */}
            <section className="bg-surface-1 p-4 rounded-xl border shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Quadro Kanban</h3>

                <fieldset className="mb-6 border-none p-0 m-0">
                    <legend className="text-sm font-semibold block mb-2">Previsão de Alta</legend>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Previsão de Alta">
                        {(Object.keys(DischargeEstimateLabel) as DischargeEstimate[]).map(key => (
                            <button
                                key={key}
                                onClick={() => handleUpdateDischarge(key)}
                                role="radio"
                                aria-checked={bed.expectedDischarge === key}
                                className={`btn text-sm p-4 ${bed.expectedDischarge === key ? 'btn-primary' : 'btn-outline'}`}
                            >
                                {DischargeEstimateLabel[key]}
                            </button>
                        ))}
                    </div>
                </fieldset>

                <div>
                    <div className="flex justify-between items-baseline mb-2">
                        <label className="text-sm font-semibold" htmlFor="blocker-textarea">Bloqueador Principal</label>
                        <span className={`text-xs font-mono tabular-nums ${blockerText.length >= 180 ? 'text-state-danger' : 'text-muted'}`}>
                            {blockerText.length}/200
                        </span>
                    </div>
                    <textarea
                        id="blocker-textarea"
                        className="w-full bg-surface-2 border rounded-lg p-3 text-sm text-primary focus-input"
                        rows={3}
                        maxLength={200}
                        placeholder="Descreva o que está impedindo a alta..."
                        value={blockerText}
                        onChange={(e) => setBlockerText(e.target.value)}
                        onBlur={handleSaveBlocker}
                    />
                </div>

            </section>

            {/* Kamishibai Section */}
            <section className="bg-surface-1 p-4 rounded-xl border shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Quadro Kamishibai</h3>

                <div className="flex flex-col gap-3">
                    {KAMISHIBAI_DOMAINS.map(s => {
                        // ── v1: calcular estado visual para display ──────────────
                        const visualState = resolveKamishibaiVisualState(bed, s, {
                            kamishibaiEnabled: opsSettings?.kamishibaiEnabled ?? true,
                            schedule: opsSettings?.huddleSchedule ?? DEFAULT_SHIFT_SCHEDULE,
                        });
                        const currentStatus = bed.kamishibai[s]?.status;

                        return (
                            <div key={s} className="flex justify-between items-center bg-surface-2 p-3 rounded-lg gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-sm font-semibold truncate">{getKamishibaiLabel(s)}</span>
                                    {/* Badge de estado visual v1 — só mostra quando relevante */}
                                    {(visualState === 'UNREVIEWED_THIS_SHIFT' || visualState === 'INACTIVE' || visualState === 'NOT_APPLICABLE') && (
                                        <span
                                            className="text-[9px] font-bold uppercase tracking-widest opacity-50"
                                            title={visualStateLabel(visualState)}
                                        >
                                            {visualState === 'NOT_APPLICABLE' ? 'N/A' :
                                                visualState === 'INACTIVE' ? 'Inativo' :
                                                    'Não revisado'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    {/* v1: apenas ok e blocked — 'na' removido dos controles */}
                                    {(['ok', 'blocked'] as KamishibaiStatus[]).map(status => (
                                        <button
                                            key={status}
                                            onClick={() => handleUpdateKamishibai(s, status)}
                                            className={`w-10 h-10 flex items-center justify-center rounded-full kami-btn border border-transparent transition-all ${currentStatus === status ? 'selected bg-surface-1 shadow-sm border-soft ring-1 ring-accent-primary/20' : 'hover:bg-surface-1/50'}`}
                                            aria-label={`Definir status ${status} para ${getKamishibaiLabel(s)}`}
                                            aria-pressed={currentStatus === status}
                                        >
                                            <div className={`w-3.5 h-3.5 rounded-full kamishibai-dot ${status}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Pendências Section — v1 Lean */}
            <section className="bg-surface-1 p-4 rounded-xl border shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">
                    Pendências
                    {(bed.pendencies ?? []).filter(p => p.status === 'open').length > 0 && (
                        <span className="ml-2 text-xs font-mono text-accent-primary">
                            {(bed.pendencies ?? []).filter(p => p.status === 'open').length} abertas
                        </span>
                    )}
                </h3>

                {/* Lista OPEN */}
                {(bed.pendencies ?? []).filter(p => p.status === 'open').length === 0 && (
                    <p className="text-sm text-muted italic mb-3">Nenhuma pendência aberta.</p>
                )}
                <div className="flex flex-col gap-2 mb-4">
                    {(bed.pendencies ?? [])
                        .filter(p => p.status === 'open')
                        .map(p => {
                            const isOverdue = !!p.dueAt && new Date(p.dueAt as string).getTime() < nowMs;
                            return (
                                <div
                                    key={p.id}
                                    data-status={isOverdue ? 'overdue' : 'open'}
                                    className="flex items-start gap-2 bg-surface-2 rounded-lg p-3"
                                >
                                    {/* Marcar done */}
                                    <button
                                        onClick={() => handleMarkDone(p.id)}
                                        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border border-soft hover:border-accent-primary transition-colors"
                                        aria-label={`Marcar como feito: ${p.title}`}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium leading-snug">{p.title}</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {p.domain && (
                                                <span className="text-[10px] font-bold uppercase tracking-widest bg-accent-primary/10 text-accent-primary px-1.5 py-0.5 rounded">
                                                    {p.domain}
                                                </span>
                                            )}
                                            {p.dueAt && (
                                                <span className={`text-[10px] ${isOverdue ? 'text-red-500 font-bold' : 'text-muted'}`}>
                                                    {isOverdue ? '⚠ Vencida: ' : 'Prazo: '}
                                                    {new Date(p.dueAt as string).toLocaleDateString('pt-BR')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Cancelar — disponível para qualquer editor */}
                                    <button
                                        onClick={() => handleCancelPendency(p.id)}
                                        className="flex-shrink-0 text-muted hover:text-orange-500 transition-colors text-xs px-1"
                                        aria-label={`Cancelar pendência: ${p.title}`}
                                        title="Cancelar (preserva histórico)"
                                    >✕</button>
                                    {/* Excluir — somente admin */}
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleDeletePendency(p.id)}
                                            className="flex-shrink-0 text-muted hover:text-red-600 transition-colors text-xs px-1"
                                            aria-label={`Excluir permanentemente: ${p.title}`}
                                            title="Excluir permanentemente (admin)"
                                        >🗑️</button>
                                    )}
                                </div>
                            );
                        })}
                </div>

                {/* Form nova pendência */}
                <div className="flex flex-col gap-2 mb-4">
                    <input
                        type="text"
                        className="input w-full text-sm"
                        placeholder="Nova pendência (obrigatório)"
                        value={newPendencyTitle}
                        onChange={e => setNewPendencyTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddPendency(); }}
                        aria-label="Título da nova pendência"
                        maxLength={120}
                    />
                    <div className="flex gap-2">
                        <select
                            className="input flex-1 text-sm"
                            value={newPendencyDomain}
                            onChange={e => setNewPendencyDomain(e.target.value as SpecialtyKey | '')}
                            aria-label="Domínio da pendência (opcional)"
                        >
                            <option value="">Domínio (opcional)</option>
                            {(['medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social'] as SpecialtyKey[]).map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            className="input flex-1 text-sm"
                            value={newPendencyDueAt}
                            onChange={e => setNewPendencyDueAt(e.target.value)}
                            aria-label="Prazo da pendência (opcional)"
                        />
                    </div>
                    <button
                        onClick={handleAddPendency}
                        disabled={!newPendencyTitle.trim() || pendencySaving}
                        className="btn btn-primary w-full text-sm disabled:opacity-40"
                    >
                        {pendencySaving ? 'Salvando...' : '+ Adicionar pendência'}
                    </button>
                </div>

                {/* Lista DONE — colapsada (histórico) */}
                {(bed.pendencies ?? []).filter(p => p.status === 'done').length > 0 && (
                    <div className="mb-2">
                        <button
                            onClick={() => setShowDonePendencies(v => !v)}
                            className="text-xs text-muted underline mb-2"
                            aria-expanded={showDonePendencies}
                            aria-controls="done-pendencies-list"
                        >
                            {showDonePendencies ? 'Ocultar' : 'Ver'} concluídas ({(bed.pendencies ?? []).filter(p => p.status === 'done').length})
                        </button>
                        {showDonePendencies && (
                            <div id="done-pendencies-list" className="flex flex-col gap-2">
                                {(bed.pendencies ?? []).filter(p => p.status === 'done').map(p => (
                                    <div key={p.id} data-status="done" className="flex items-start gap-2 bg-surface-2/50 rounded-lg p-3 opacity-60">
                                        <span className="flex-shrink-0 text-green-500 mt-0.5" aria-hidden="true">✓</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm line-through">{p.title}</p>
                                            {p.doneAt && (
                                                <span className="text-[10px] text-muted">
                                                    Concluído {new Date(p.doneAt as string).toLocaleDateString('pt-BR')}
                                                    {p.doneBy && ` por ${p.doneBy.name}`}
                                                </span>
                                            )}
                                        </div>
                                        {/* Delete admin-only mesmo em done */}
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleDeletePendency(p.id)}
                                                className="flex-shrink-0 text-muted hover:text-red-600 transition-colors text-xs px-1"
                                                aria-label={`Excluir permanentemente: ${p.title}`}
                                                title="Excluir permanentemente (admin)"
                                            >🗑️</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Lista CANCELADAS — colapsada (histórico) */}
                {(bed.pendencies ?? []).filter(p => p.status === 'canceled').length > 0 && (
                    <div>
                        <button
                            onClick={() => setShowCanceledPendencies(v => !v)}
                            className="text-xs text-muted underline mb-2"
                            aria-expanded={showCanceledPendencies}
                            aria-controls="canceled-pendencies-list"
                        >
                            {showCanceledPendencies ? 'Ocultar' : 'Ver'} canceladas ({(bed.pendencies ?? []).filter(p => p.status === 'canceled').length})
                        </button>
                        {showCanceledPendencies && (
                            <div id="canceled-pendencies-list" className="flex flex-col gap-2">
                                {(bed.pendencies ?? []).filter(p => p.status === 'canceled').map(p => (
                                    <div key={p.id} data-status="canceled" className="flex items-start gap-2 bg-surface-2/30 rounded-lg p-3 opacity-50">
                                        <span className="flex-shrink-0 text-orange-400 mt-0.5" aria-hidden="true">✕</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm line-through text-muted">{p.title}</p>
                                            {p.canceledAt && (
                                                <span className="text-[10px] text-muted">
                                                    Cancelado {new Date(p.canceledAt as string).toLocaleDateString('pt-BR')}
                                                    {p.canceledBy && ` por ${p.canceledBy.name}`}
                                                </span>
                                            )}
                                        </div>
                                        {/* Delete admin-only */}
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleDeletePendency(p.id)}
                                                className="flex-shrink-0 text-muted hover:text-red-600 transition-colors text-xs px-1"
                                                aria-label={`Excluir permanentemente: ${p.title}`}
                                                title="Excluir permanentemente (admin)"
                                            >🗑️</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

export default BedDetails;
