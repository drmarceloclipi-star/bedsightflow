import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import type { Bed, SpecialtyKey, KamishibaiStatus, DischargeEstimate } from '../../../domain/types';
import { DischargeEstimateLabel, SpecialtyLabel } from '../../../domain/types';
import { BedsRepository } from '../../../repositories/BedsRepository';

import { CLINICAL_SPECIALTIES, KAMISHIBAI_DOMAINS, getKamishibaiLabel } from '../../../domain/specialtyUtils';

const BedDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const unitId = searchParams.get('unit') || 'A';

    const [bed, setBed] = useState<Bed | null>(null);
    const [blockerText, setBlockerText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!id) return;

        const unsubscribe = BedsRepository.listenToBed(unitId, id, (currentBed) => {
            setBed(currentBed);
            if (currentBed) {
                setBlockerText(prev => prev || currentBed.mainBlocker || '');
            }
        });

        return () => unsubscribe();
    }, [id, unitId]);

    const handleUpdateDischarge = async (value: DischargeEstimate) => {
        if (!bed || !id) return;
        setIsSaving(true);
        await BedsRepository.updateBed(unitId, id, { expectedDischarge: value });
        setIsSaving(false);
    };

    const handleSaveBlocker = async () => {
        if (!bed || !id) return;
        await BedsRepository.updateBed(unitId, id, { mainBlocker: blockerText });
    };

    const handleUpdateKamishibai = async (specialty: SpecialtyKey, status: KamishibaiStatus) => {
        if (!bed || !id) return;
        setIsSaving(true);
        const newKamishibai = { ...bed.kamishibai };
        newKamishibai[specialty] = {
            ...newKamishibai[specialty],
            status,
            updatedAt: new Date().toISOString()
        };
        await BedsRepository.updateBed(unitId, id, { kamishibai: newKamishibai });
        setIsSaving(false);
    };
    const renderSpecialtyChip = (s: SpecialtyKey) => {
        const isSelected = bed?.involvedSpecialties?.includes(s);
        return (
            <button
                key={s}
                onClick={async () => {
                    if (!bed || !id) return;
                    const current = bed.involvedSpecialties || [];
                    const next = isSelected
                        ? current.filter(x => x !== s)
                        : [...current, s];

                    setIsSaving(true);
                    await BedsRepository.updateBed(unitId, id, { involvedSpecialties: next });
                    setIsSaving(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isSelected
                    ? 'bg-primary text-primary-fg border-primary shadow-sm'
                    : 'bg-surface-2 text-secondary border-transparent hover:border-muted'
                    }`}
            >
                {SpecialtyLabel[s]}
            </button>
        );
    };



    if (!bed) return <div className="p-8 text-center animate-pulse">Carregando dados do leito...</div>;

    return (
        <div className="p-4 bed-details flex flex-col gap-6 animate-slideIn">
            <header className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 rounded-full hover:bg-surface-2"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
                <div className="flex-1">
                    <h2 className="text-2xl font-serif">Leito {bed.number}</h2>
                    <div className="text-sm text-secondary">{bed.patientAlias || 'Paciente não identificado'}</div>
                </div>
                {isSaving && <div className="text-saving animate-pulse font-bold">SALVANDO...</div>}
            </header>

            {/* Kanban Section */}
            <section className="bg-surface-1 p-4 rounded-xl border shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-4">Quadro Kanban</h3>

                <div className="mb-6">
                    <label className="text-sm font-semibold block mb-2">Previsão de Alta</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(DischargeEstimateLabel) as DischargeEstimate[]).map(key => (
                            <button
                                key={key}
                                onClick={() => handleUpdateDischarge(key)}
                                className={`btn text-sm p-3 ${bed.expectedDischarge === key ? 'btn-primary' : 'btn-outline'}`}
                            >
                                {DischargeEstimateLabel[key]}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-sm font-semibold block mb-2">Bloqueador Principal</label>
                    <textarea
                        className="w-full bg-surface-2 border rounded-lg p-3 text-sm text-primary focus-input"
                        rows={3}
                        maxLength={200}
                        placeholder="Descreva o que está impedindo a alta..."
                        value={blockerText}
                        onChange={(e) => setBlockerText(e.target.value)}
                        onBlur={handleSaveBlocker}
                    />
                </div>

                <div className="mt-6 flex flex-col gap-6">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-3">ESPECIALIDADE</label>
                        <div className="flex flex-wrap gap-2">
                            {CLINICAL_SPECIALTIES.filter(s => s === 'medical').map(s => renderSpecialtyChip(s))}
                        </div>
                    </div>

                    {/* Provisoriamente ocultando outras especialidades médicas para evitar indução ao erro */}
                    {/* 
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-3">Cirúrgicas</label>
                        <div className="flex flex-wrap gap-2">
                            {SURGICAL_SPECIALTIES.map(s => renderSpecialtyChip(s))}
                        </div>
                    </div>
                    */}

                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-3">Equipe Multi / Apoio</label>
                        <div className="flex flex-wrap gap-2">
                            {KAMISHIBAI_DOMAINS.filter(s => s !== 'medical').map(s => renderSpecialtyChip(s))}
                        </div>
                    </div>
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
                                        className={`w-8 h-8 kami-btn ${bed.kamishibai[s]?.status === status ? 'selected' : ''}`}
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
