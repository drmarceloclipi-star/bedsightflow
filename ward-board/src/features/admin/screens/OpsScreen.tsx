import React, { useState } from 'react';
import { BedsRepository } from '../../../repositories/BedsRepository';
import { BoardSettingsRepository } from '../../../repositories/BoardSettingsRepository';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../infra/firebase/config';
import ConfirmModal from '../../../shared/components/ConfirmModal';

interface Props {
    unitId: string;
}

type ModalConfig = {
    title: string;
    description: string;
    consequences: string[];
    confirmLabel: string;
    action: (reason: string) => Promise<void>;
    requireTyping?: string;
};

const OpsScreen: React.FC<Props> = ({ unitId }) => {
    const [msg, setMsg] = useState('');
    const [msgType, setMsgType] = useState<'success' | 'error'>('success');
    const [running, setRunning] = useState(false);
    const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

    const flash = (text: string, type: 'success' | 'error' = 'success') => {
        setMsg(text);
        setMsgType(type);
        setTimeout(() => setMsg(''), 4000);
    };

    const openModal = (config: ModalConfig) => setModalConfig(config);
    const closeModal = () => setModalConfig(null);

    const runAction = async (reason: string) => {
        if (!modalConfig) return;
        closeModal();
        setRunning(true);
        try {
            await modalConfig.action(reason);
        } catch (err: unknown) {
            console.error(err);
            flash('Erro durante a operação. Verifique os logs.', 'error');
        } finally {
            setRunning(false);
        }
    };

    const handleSoftReset = () => {
        openModal({
            title: 'Resetar dados da unidade',
            description: `Você está prestes a limpar todos os dados operacionais da unidade ${unitId}.`,
            consequences: [
                'Todos os campos Kanban (estado, bloqueador, alias) serão apagados',
                'Todos os cards Kamishibai serão reiniciados',
                'A lista de leitos é mantida intacta',
                'Esta ação NÃO pode ser desfeita',
            ],
            confirmLabel: 'Executar Reset',
            action: async (reason) => {
                const resetFn = httpsCallable(functions, 'softResetUnit');
                await resetFn({ unitId, reason });
                flash('✓ Reset concluído com sucesso.');
            },
            requireTyping: 'RESETAR',
        });
    };

    const handleReapplyCanonical = () => {
        openModal({
            title: 'Reaplicar leitos padrão (36)',
            description: `Cria ou atualiza os 36 leitos canônicos da unidade ${unitId}.`,
            consequences: [
                'Leitos existentes com dados serão preservados',
                'Leitos faltando serão criados com valores padrão',
                'A operação pode demorar alguns segundos',
            ],
            confirmLabel: 'Reaplicar Leitos',
            action: async (reason) => {
                const applyFn = httpsCallable(functions, 'applyCanonicalBeds');
                await applyFn({ unitId, reason });
                flash('✓ 36 leitos canônicos reaplicados.');
            },
            requireTyping: 'REAPLICAR',
        });
    };

    const handleExportJSON = async () => {
        setRunning(true);
        try {
            const [beds, settings] = await Promise.all([
                BedsRepository.listBeds(unitId),
                BoardSettingsRepository.getSettings(unitId),
            ]);

            const snapshot = {
                exportedAt: new Date().toISOString(),
                unitId,
                settings,
                beds,
            };

            const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ward-board-${unitId}-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            flash('✓ Snapshot exportado com sucesso.');
        } catch (err) {
            console.error(err);
            flash('Erro ao exportar.', 'error');
        } finally {
            setRunning(false);
        }
    };

    return (
        <>
            {/* Confirmation modal */}
            <ConfirmModal
                isOpen={!!modalConfig}
                onClose={closeModal}
                onConfirm={runAction}
                title={modalConfig?.title ?? ''}
                description={modalConfig?.description ?? ''}
                consequences={modalConfig?.consequences}
                confirmLabel={modalConfig?.confirmLabel}
                requireTyping={modalConfig?.requireTyping}
                isDangerous
            />

            <div className="p-4 flex flex-col gap-6 w-full max-w-5xl">
                <div className="mb-6">
                    <h2 className="text-2xl font-serif text-primary mb-1">Operações</h2>
                    <p className="text-sm text-muted">
                        Ações destrutivas exibem um modal de confirmação e exigem que você informe um motivo para fins de auditoria.
                    </p>
                </div>

                {/* Flash */}
                {msg && (
                    <div
                        role="status"
                        aria-live="polite"
                        className={`p-3 rounded-md mb-4 text-sm border font-semibold ${msgType === 'success' ? 'state-success-bg' : 'state-danger-bg'
                            }`}
                    >
                        {msg}
                    </div>
                )}

                {/* Action cards */}
                <div className="flex flex-col gap-3">
                    <OpsCard
                        title="Resetar dados da unidade (soft)"
                        description="Limpa kanban + kamishibai de todos os leitos. A lista de leitos é mantida."
                        buttonLabel={running ? 'Executando...' : 'Executar Reset'}
                        buttonColorClass="btn-danger"
                        disabled={running}
                        onClick={handleSoftReset}
                    />

                    <OpsCard
                        title="Reaplicar leitos padrão (36)"
                        description="Cria ou atualiza os 36 leitos canônicos. Leitos existentes são preservados."
                        buttonLabel={running ? 'Executando...' : 'Reaplicar Leitos'}
                        buttonColorClass="btn-warning"
                        disabled={running}
                        onClick={handleReapplyCanonical}
                    />

                    <OpsCard
                        title="Exportar snapshot JSON"
                        description="Baixa um arquivo JSON com unit settings + estado atual de todos os leitos."
                        buttonLabel={running ? 'Exportando...' : 'Exportar snapshot'}
                        buttonColorClass="btn-primary"
                        disabled={running}
                        onClick={handleExportJSON}
                    />
                </div>
            </div>
        </>
    );
};

const OpsCard: React.FC<{
    title: string;
    description: string;
    buttonLabel: string;
    buttonColorClass: string;
    disabled: boolean;
    onClick: () => void;
}> = ({ title, description, buttonLabel, buttonColorClass, disabled, onClick }) => (
    <div className="bg-surface-1 border rounded-lg p-6 flex items-center justify-between gap-4 shadow-sm flex-wrap">
        <div className="ops-card-content">
            <div className="text-sm font-semibold text-primary mb-1">{title}</div>
            <div className="text-sm text-muted">{description}</div>
        </div>
        <button
            onClick={onClick}
            disabled={disabled}
            className={`btn ${disabled ? 'btn-disabled' : buttonColorClass} whitespace-nowrap`}
            aria-busy={disabled}
        >
            {buttonLabel}
        </button>
    </div>
);

export default OpsScreen;
