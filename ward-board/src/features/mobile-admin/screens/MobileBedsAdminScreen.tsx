import React, { useState, useEffect } from 'react';
import { functions } from '../../../infra/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { CLOUD_FUNCTIONS } from '../../../constants/functionNames';
import { BedsRepository } from '../../../repositories/BedsRepository';
import type { Bed } from '../../../domain/types';
import ConfirmModal from '../../../shared/components/ConfirmModal';

interface Props {
    unitId: string;
}

const MobileBedsAdminScreen: React.FC<Props> = ({ unitId }) => {
    const [beds, setBeds] = useState<Bed[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState('');
    const flashTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const [modalConfig, setModalConfig] = useState<{
        title: string;
        description: string;
        confirmLabel: string;
        requireTyping?: string;
        consequences?: string[];
        onConfirm: (reason: string) => Promise<void>;
    } | null>(null);

    useEffect(() => {
        return () => {
            if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const unsub = BedsRepository.listenToBeds(unitId, (data) => {
            setBeds(data);
            setLoading(false);
        });
        return unsub;
    }, [unitId]);

    const flash = (msg: string) => {
        setActionMsg(msg);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setActionMsg(''), 3000);
    };

    const handleApplyCanonical = () => {
        setModalConfig({
            title: 'Aplicar Leitos Padrão',
            description: `Isso vai criar ou atualizar os 36 leitos canônicos na unidade ${unitId}.`,
            confirmLabel: 'Aplicar Leitos',
            consequences: [
                '36 novos documentos de leitos serão criados ou atualizados',
                'A numeração seguirá o padrão 301.1 a 313.2',
            ],
            onConfirm: async (reason) => {
                const applyFn = httpsCallable(functions, CLOUD_FUNCTIONS.APPLY_CANONICAL_BEDS);
                await applyFn({ unitId, reason });
                flash('✓ 36 leitos canônicos aplicados!');
            }
        });
    };

    const handleClearBed = (bed: Bed, mode: 'kanban' | 'kamishibai' | 'all') => {
        const labels = {
            kanban: { title: 'Limpar Kanban', msg: 'Limpar dados Kanban (paciente, pendências)' },
            kamishibai: { title: 'Limpar Kamishibai', msg: 'Limpar status Kamishibai' },
            all: { title: 'Limpar Tudo', msg: 'Limpar TODOS os dados' },
        };
        const functionNames = {
            kanban: CLOUD_FUNCTIONS.RESET_BED_KANBAN,
            kamishibai: CLOUD_FUNCTIONS.RESET_BED_KAMISHIBAI,
            all: CLOUD_FUNCTIONS.RESET_BED_ALL
        };
        const config = labels[mode];

        setModalConfig({
            title: `${config.title} — Leito ${bed.number}`,
            description: `Confirma a limpeza do leito ${bed.number}? ${config.msg}.`,
            confirmLabel: 'Limpar Dados',
            requireTyping: mode === 'all' ? 'LIMPAR' : undefined,
            onConfirm: async (reason) => {
                const resetFn = httpsCallable(functions, functionNames[mode]);
                await resetFn({ unitId, bedId: bed.id, reason });
                flash(`✓ Leito ${bed.number} atualizado!`);
            }
        });
    };

    return (
        <div className="madmin-screen-pad">
            <div className="madmin-screen-header">
                <div>
                    <h2 className="madmin-screen-title">Gestão de Leitos</h2>
                    <p className="madmin-screen-subtitle">{beds.length} leitos ativos</p>
                </div>
                <button onClick={handleApplyCanonical} className="madmin-btn madmin-btn-primary madmin-btn-sm">
                    🏥 Aplicar padrão
                </button>
            </div>

            {actionMsg && (
                <div className="madmin-flash state-success-bg" role="status" aria-live="polite">
                    {actionMsg}
                </div>
            )}

            {loading ? (
                <div className="madmin-loading-area">
                    <div className="animate-pulse text-muted">Carregando leitos...</div>
                </div>
            ) : beds.length === 0 ? (
                <div className="madmin-empty-state">
                    <span className="madmin-empty-icon">🛏️</span>
                    <h3 className="madmin-empty-title">Nenhum leito encontrado</h3>
                    <p className="madmin-empty-msg">Esta unidade ainda não possui leitos cadastrados.</p>
                    <button onClick={handleApplyCanonical} className="madmin-btn madmin-btn-primary">
                        Criar Estrutura Inicial
                    </button>
                </div>
            ) : (
                <div className="madmin-list">
                    {beds.map(bed => (
                        <div key={bed.id} className="madmin-card madmin-bed-card">
                            <div className="madmin-bed-header">
                                <span className="madmin-bed-number">Leito {bed.number}</span>
                                {bed.patientAlias && (
                                    <span className="madmin-bed-patient">{bed.patientAlias}</span>
                                )}
                            </div>
                            {(bed.expectedDischarge || bed.mainBlocker) && (
                                <div className="madmin-bed-meta">
                                    {bed.expectedDischarge && (
                                        <span className="madmin-bed-discharge">Alta: {bed.expectedDischarge}</span>
                                    )}
                                    {bed.mainBlocker && (
                                        <span className="madmin-bed-blocker" title={bed.mainBlocker}>
                                            🚧 {bed.mainBlocker}
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="madmin-bed-actions">
                                <button
                                    onClick={() => handleClearBed(bed, 'kanban')}
                                    className="madmin-btn-pill madmin-btn-pill-warning"
                                    title="Limpar Kanban"
                                >
                                    K
                                </button>
                                <button
                                    onClick={() => handleClearBed(bed, 'kamishibai')}
                                    className="madmin-btn-pill madmin-btn-pill-primary"
                                    title="Limpar Kamishibai"
                                >
                                    S
                                </button>
                                <button
                                    onClick={() => handleClearBed(bed, 'all')}
                                    className="madmin-btn-pill madmin-btn-pill-danger"
                                    title="Limpar Tudo"
                                >
                                    T
                                </button>
                                <span className="madmin-bed-action-legend">K · S · Tudo</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalConfig && (
                <ConfirmModal
                    isOpen={true}
                    title={modalConfig.title}
                    description={modalConfig.description}
                    confirmLabel={modalConfig.confirmLabel}
                    requireTyping={modalConfig.requireTyping}
                    consequences={modalConfig.consequences}
                    onConfirm={async (reason) => {
                        await modalConfig.onConfirm(reason);
                        setModalConfig(null);
                    }}
                    onClose={() => setModalConfig(null)}
                />
            )}
        </div>
    );
};

export default MobileBedsAdminScreen;
