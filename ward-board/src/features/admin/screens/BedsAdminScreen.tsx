import React, { useState, useEffect } from 'react';
import { functions } from '../../../infra/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { CLOUD_FUNCTIONS } from '../../../constants/functionNames';
import { BedsRepository } from '../../../repositories/BedsRepository';
import type { Bed } from '../../../domain/types';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { useAuthStatus } from '../../../hooks/useAuthStatus';

interface Props {
    unitId: string;
}

const BedsAdminScreen: React.FC<Props> = ({ unitId }) => {
    const { isAdmin } = useAuthStatus();
    const [beds, setBeds] = useState<Bed[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState('');
    const [modalConfig, setModalConfig] = useState<{
        title: string;
        description: string;
        confirmLabel: string;
        requireTyping?: string;
        consequences?: string[];
        onConfirm: (reason: string) => Promise<void>;
    } | null>(null);

    useEffect(() => {
        const unsub = BedsRepository.listenToBeds(unitId, (data) => {
            setBeds(data);
            setLoading(false);
        });
        return unsub;
    }, [unitId]);

    const flash = (msg: string) => {
        setActionMsg(msg);
        setTimeout(() => setActionMsg(''), 3000);
    };

    const handleApplyCanonical = () => {
        setModalConfig({
            title: 'Aplicar Leitos Padrão',
            description: `Isso vai criar ou atualizar os 36 leitos canônicos na unidade ${unitId}. Dados existentes de pacientes nestes leitos podem ser afetados.`,
            confirmLabel: 'Aplicar Leitos',
            consequences: ['36 novos documentos de leitos serão criados ou atualizados', 'A numeração seguirá o padrão 301.1 a 313.2'],
            onConfirm: async (reason) => {
                const applyFn = httpsCallable(functions, CLOUD_FUNCTIONS.APPLY_CANONICAL_BEDS);
                await applyFn({ unitId, reason });
                flash('✓ 36 leitos canônicos aplicados!');
            }
        });
    };

    const handleClearBed = (bed: Bed, mode: 'kanban' | 'kamishibai' | 'all') => {
        const labels = {
            kanban: { title: 'Limpar Kanban', msg: 'Limpar apenas os dados do Kanban (paciente, pendências, etc)' },
            kamishibai: { title: 'Limpar Kamishibai', msg: 'Limpar apenas o status do Kamishibai' },
            all: { title: 'Limpar Tudo', msg: 'Limpar TOTALMENTE os dados (Kanban e Kamishibai)' }
        };

        const config = labels[mode];
        const functionNames = {
            kanban: CLOUD_FUNCTIONS.RESET_BED_KANBAN,
            kamishibai: CLOUD_FUNCTIONS.RESET_BED_KAMISHIBAI,
            all: CLOUD_FUNCTIONS.RESET_BED_ALL
        };

        setModalConfig({
            title: `${config.title} - Leito ${bed.number}`,
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
        <div className="admin-screen">
            <header className="admin-screen-header">
                <div>
                    <h2 className="admin-screen-title">Gestão de Leitos</h2>
                    <p className="admin-screen-subtitle">{beds.length} leitos ativos na unidade</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={handleApplyCanonical}
                        className="btn btn-primary"
                    >
                        🏥 Aplicar 36 leitos padrão
                    </button>
                )}
            </header>

            {actionMsg && (
                <div className="flash-message state-success-bg">
                    {actionMsg}
                </div>
            )}

            <div className="admin-card">
                {loading ? (
                    <div className="p-12 text-center text-muted">
                        <div className="skeleton h-8 w-48 mx-auto mb-4" />
                        Carregando base de leitos...
                    </div>
                ) : beds.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="text-4xl mb-4">🛏️</div>
                        <h3 className="text-lg font-bold mb-2">Nenhum leito encontrado</h3>
                        <p className="text-muted mb-6">Esta unidade ainda não possui leitos cadastrados.</p>
                        {isAdmin && (
                            <button onClick={handleApplyCanonical} className="btn btn-primary">
                                Criar Estrutura Inicial
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Leito</th>
                                    <th>Paciente</th>
                                    <th>Alta</th>
                                    <th>Bloqueador</th>
                                    {isAdmin && <th className="text-right">Ações de Limpeza</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {beds.map(bed => (
                                    <tr key={bed.id}>
                                        <td className="font-bold">{bed.number}</td>
                                        <td className={bed.patientAlias ? '' : 'text-muted'}>
                                            {bed.patientAlias || '—'}
                                        </td>
                                        <td className="text-sm text-secondary">{bed.expectedDischarge || '—'}</td>
                                        <td className="text-sm text-secondary truncate max-w-200">
                                            {bed.mainBlocker || '—'}
                                        </td>
                                        {isAdmin && (
                                            <td className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleClearBed(bed, 'kanban')}
                                                        className="btn-pill btn-pill-warning"
                                                        title="Limpar Kanban"
                                                    >K</button>
                                                    <button
                                                        onClick={() => handleClearBed(bed, 'kamishibai')}
                                                        className="btn-pill btn-pill-primary"
                                                        title="Limpar Kamishibai"
                                                    >S</button>
                                                    <button
                                                        onClick={() => handleClearBed(bed, 'all')}
                                                        className="btn-pill btn-pill-danger"
                                                        title="Limpar Tudo"
                                                    >T</button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

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

export default BedsAdminScreen;
