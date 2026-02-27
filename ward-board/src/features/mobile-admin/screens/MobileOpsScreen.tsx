import React, { useState, useEffect } from 'react';
import { BedsRepository } from '../../../repositories/BedsRepository';
import { BoardSettingsRepository } from '../../../repositories/BoardSettingsRepository';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../infra/firebase/config';
import { CLOUD_FUNCTIONS } from '../../../constants/functionNames';
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

const MobileOpsScreen: React.FC<Props> = ({ unitId }) => {
    const [msg, setMsg] = useState('');
    const [msgType, setMsgType] = useState<'success' | 'error'>('success');
    const [running, setRunning] = useState(false);
    const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
    const flashTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        };
    }, []);

    const flash = (text: string, type: 'success' | 'error' = 'success') => {
        setMsg(text);
        setMsgType(type);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setMsg(''), 4000);
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
            description: `Limpar todos os dados operacionais da unidade ${unitId}.`,
            consequences: [
                'Todos os campos Kanban serão apagados',
                'Todos os cards Kamishibai serão reiniciados',
                'A lista de leitos é mantida intacta',
                'Esta ação NÃO pode ser desfeita',
            ],
            confirmLabel: 'Executar Reset',
            action: async (reason) => {
                const resetFn = httpsCallable(functions, CLOUD_FUNCTIONS.SOFT_RESET_UNIT);
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
                const applyFn = httpsCallable(functions, CLOUD_FUNCTIONS.APPLY_CANONICAL_BEDS);
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
        <div className="madmin-screen-pad">
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

            <div className="madmin-screen-header-stack">
                <h2 className="madmin-screen-title">Operações</h2>
                <p className="madmin-screen-subtitle">
                    Ações destrutivas exigem motivo para fins de auditoria.
                </p>
            </div>

            {msg && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`madmin-flash ${msgType === 'success' ? 'state-success-bg' : 'state-danger-bg'}`}
                >
                    {msg}
                </div>
            )}

            <div className="madmin-list">
                <MobileOpsCard
                    title="Resetar dados da unidade"
                    description="Limpa kanban + kamishibai de todos os leitos. A lista de leitos é mantida."
                    buttonLabel={running ? 'Executando...' : 'Executar Reset'}
                    danger
                    disabled={running}
                    onClick={handleSoftReset}
                />
                <MobileOpsCard
                    title="Reaplicar leitos padrão (36)"
                    description="Cria ou atualiza os 36 leitos canônicos. Leitos existentes são preservados."
                    buttonLabel={running ? 'Executando...' : 'Reaplicar Leitos'}
                    warning
                    disabled={running}
                    onClick={handleReapplyCanonical}
                />
                <MobileOpsCard
                    title="Exportar snapshot JSON"
                    description="Baixa um JSON com unit settings + estado atual de todos os leitos."
                    buttonLabel={running ? 'Exportando...' : 'Exportar snapshot'}
                    disabled={running}
                    onClick={handleExportJSON}
                />
            </div>
        </div>
    );
};

const MobileOpsCard: React.FC<{
    title: string;
    description: string;
    buttonLabel: string;
    disabled: boolean;
    onClick: () => void;
    danger?: boolean;
    warning?: boolean;
}> = ({ title, description, buttonLabel, disabled, onClick, danger, warning }) => (
    <div className="madmin-card madmin-ops-card">
        <div className="madmin-ops-card-info">
            <div className="madmin-ops-card-title">{title}</div>
            <div className="madmin-ops-card-desc">{description}</div>
        </div>
        <button
            onClick={onClick}
            disabled={disabled}
            className={`madmin-btn madmin-btn-full ${disabled ? 'madmin-btn-disabled' : danger ? 'madmin-btn-danger' : warning ? 'madmin-btn-warning' : 'madmin-btn-primary'}`}
            aria-busy={disabled}
        >
            {buttonLabel}
        </button>
    </div>
);

export default MobileOpsScreen;
