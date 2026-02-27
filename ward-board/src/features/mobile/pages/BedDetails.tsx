import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import type { Bed, SpecialtyKey, KamishibaiStatus, DischargeEstimate } from '../../../domain/types';
import { DischargeEstimateLabel } from '../../../domain/types';
import { BedsRepository } from '../../../repositories/BedsRepository';
import { auth } from '../../../infra/firebase/config';

import { KAMISHIBAI_DOMAINS, getKamishibaiLabel } from '../../../domain/specialtyUtils';

const BedDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const unitId = searchParams.get('unit') || 'A';

    const [bed, setBed] = useState<Bed | null>(null);
    const [aliasText, setAliasText] = useState('');
    const [blockerText, setBlockerText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

        return () => unsubscribe();
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
            const newKamishibai = { ...bed.kamishibai };
            newKamishibai[specialty] = {
                ...newKamishibai[specialty],
                status,
                updatedAt: new Date().toISOString()
            };
            await BedsRepository.updateBed(unitId, id, { kamishibai: newKamishibai }, getActor());
            setIsSaving(false);
        } catch (error) {
            handleError(error);
        }
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
        <div className="p-4 bed-details flex flex-col gap-6 animate-slideIn">
            <header className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-3 -ml-3 rounded-full hover:bg-surface-2"
                    aria-label="Voltar para a página anterior"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-serif">Leito {bed.number}</h2>
                    <label htmlFor="patient-alias" className="text-[10px] uppercase font-bold text-muted block mt-1">Iniciais do Paciente</label>
                    <input
                        id="patient-alias"
                        type="text"
                        className="w-full bg-transparent border border-transparent focus:border-accent-primary rounded px-1 py-0.5 text-sm text-secondary focus:text-primary outline-none transition-colors"
                        placeholder="Iniciais do paciente"
                        value={aliasText}
                        onChange={(e) => setAliasText(e.target.value)}
                        onBlur={handleSaveAlias}
                        maxLength={50}
                    />
                </div>
                {isSaving && <div className="text-saving animate-pulse font-bold">SALVANDO...</div>}
            </header>

            {errorMsg && (
                <div className="bg-state-danger-bg border border-state-danger text-state-danger px-4 py-3 rounded-lg text-sm font-semibold shadow-sm animate-slideIn">
                    {errorMsg}
                </div>
            )}

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

                <div className="flex flex-col gap-4">
                    {KAMISHIBAI_DOMAINS.map(s => (
                        <div key={s} className="flex justify-between items-center bg-surface-2 p-2 rounded-lg gap-2">
                            <span className="text-sm font-semibold truncate flex-1">{getKamishibaiLabel(s)}</span>
                            <div className="flex gap-1 flex-shrink-0">
                                {(['ok', 'pending', 'blocked'] as KamishibaiStatus[]).map(status => (
                                    <button
                                        key={status}
                                        onClick={() => handleUpdateKamishibai(s, status)}
                                        className={`w-11 h-11 flex items-center justify-center kami-btn ${bed.kamishibai[s]?.status === status ? 'selected' : ''}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full kamishibai-dot ${status}`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default BedDetails;
