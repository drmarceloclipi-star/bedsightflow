import React, { useState, useEffect } from 'react';
import { BedsRepository } from '../../../repositories/BedsRepository';
import { BoardSettingsRepository } from '../../../repositories/BoardSettingsRepository';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../infra/firebase/config';
import { CLOUD_FUNCTIONS } from '../../../constants/functionNames';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { UnitSettingsRepository } from '../../../repositories/UnitSettingsRepository';
import { useAuthStatus } from '../../../hooks/useAuthStatus';
import type { UnitOpsSettings, KanbanMode } from '../../../domain/types';

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
    const { user } = useAuthStatus();
    const [msg, setMsg] = useState('');
    const [msgType, setMsgType] = useState<'success' | 'error'>('success');
    const [savingMode, setSavingMode] = useState(false);
    const [runningAction, setRunningAction] = useState(false);
    const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
    const [opsSettings, setOpsSettings] = useState<UnitOpsSettings | null>(null);
    const flashTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const unsub = UnitSettingsRepository.subscribeUnitOpsSettings(unitId, setOpsSettings);
        return () => unsub();
    }, [unitId]);

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
        setRunningAction(true);
        try {
            await modalConfig.action(reason);
        } catch (err: unknown) {
            console.error(err);
            flash('Erro durante a operação. Verifique os logs.', 'error');
        } finally {
            setRunningAction(false);
        }
    };

    const handleModeChange = async (newMode: KanbanMode) => {
        if (!user || opsSettings?.kanbanMode === newMode) return;
        setSavingMode(true);
        try {
            await UnitSettingsRepository.setUnitKanbanMode(unitId, newMode, {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
            });
            flash('Modo operacional salvo com sucesso.', 'success');
        } catch (err) {
            console.error('Falha ao alterar modo:', err);
            flash('Falha ao salvar modo. Alteração revertida.', 'error');
        } finally {
            setSavingMode(false);
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
        setRunningAction(true);
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
            setRunningAction(false);
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

            {/* Modo Operacional */}
            <div className="madmin-card mb-4">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-primary mb-1">Modo Operacional</h3>
                            <p className="text-xs text-muted leading-tight">
                                Define o nível de governança para a unidade.
                            </p>
                        </div>
                        {opsSettings ? (
                            <div className="flex items-center gap-1 bg-surface-2 p-1 border rounded-lg">
                                {(['PASSIVE', 'ACTIVE_LITE'] as KanbanMode[]).map((m) => (
                                    <button
                                        key={m}
                                        disabled={savingMode}
                                        onClick={() => handleModeChange(m)}
                                        className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${opsSettings.kanbanMode === m
                                            ? 'bg-white text-primary shadow-sm ring-1 ring-border'
                                            : 'text-muted-more hover:text-primary-800 hover:bg-surface-3'
                                            }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <span className="skeleton h-8 w-32 rounded" />
                        )}
                    </div>
                    <div className="bg-surface-2 border p-3 rounded-md text-[11px] leading-snug">
                        {opsSettings?.kanbanMode === 'PASSIVE' ? (
                            <p className="text-muted"><strong className="text-primary font-semibold">PASSIVE:</strong> Sem obrigatoriedades, sem cobrança operacional.</p>
                        ) : opsSettings?.kanbanMode === 'ACTIVE_LITE' ? (
                            <p className="text-muted"><strong className="text-primary font-semibold">ACTIVE LITE:</strong> Habilita regras mínimas de governança.</p>
                        ) : (
                            <p className="text-muted">Carregando...</p>
                        )}
                    </div>
                </div>
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
                    buttonLabel={runningAction ? 'Executando...' : 'Executar Reset'}
                    danger
                    disabled={runningAction}
                    onClick={handleSoftReset}
                />
                <MobileOpsCard
                    title="Reaplicar leitos padrão (36)"
                    description="Cria ou atualiza os 36 leitos canônicos. Leitos existentes são preservados."
                    buttonLabel={runningAction ? 'Executando...' : 'Reaplicar Leitos'}
                    warning
                    disabled={runningAction}
                    onClick={handleReapplyCanonical}
                />
                <MobileOpsCard
                    title="Exportar snapshot JSON"
                    description="Baixa um JSON com unit settings + estado atual de todos os leitos."
                    buttonLabel={runningAction ? 'Exportando...' : 'Exportar snapshot'}
                    disabled={runningAction}
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
