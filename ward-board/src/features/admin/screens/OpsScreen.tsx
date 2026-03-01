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
import HuddleConsole from '../components/ops/HuddleConsole';

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

    const handleKamishibaiChange = async (enabled: boolean) => {
        if (!user || opsSettings?.kamishibaiEnabled === enabled) return;
        setSavingMode(true);
        try {
            await UnitSettingsRepository.setKamishibaiEnabled(unitId, enabled, {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
            });
            flash(`Kamishibai ${enabled ? 'ativado' : 'desativado'} com sucesso.`, 'success');
        } catch (err) {
            console.error('Falha ao alterar Kamishibai:', err);
            flash('Falha ao salvar Kamishibai. Alteração revertida.', 'error');
        } finally {
            setSavingMode(false);
        }
    };

    // ── v1: Registrar Huddle ──────────────────────────────────────────────────
    // Substituído pelo novo HuddleConsole (LSW v1)

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

                {/* Status Operacional */}
                <div className="mb-6 bg-surface-1 border rounded-lg p-6 shadow-sm">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-primary mb-1">Modo Operacional</h3>
                                <p className="text-sm text-muted">
                                    Define o nível de cobrança e governança para esta unidade.
                                </p>
                            </div>

                            {opsSettings ? (
                                <div className="flex items-center gap-1 bg-surface-2 p-1 border rounded-lg">
                                    {(['PASSIVE', 'ACTIVE_LITE'] as KanbanMode[]).map((m) => (
                                        <button
                                            key={m}
                                            disabled={savingMode}
                                            onClick={() => handleModeChange(m)}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${opsSettings.kanbanMode === m
                                                ? 'bg-white text-primary shadow-sm ring-1 ring-border'
                                                : 'text-muted-more hover:text-primary-800 hover:bg-surface-3'
                                                }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="skeleton h-10 w-48 rounded-lg" />
                            )}
                        </div>
                        <div className="bg-surface-2 border p-4 rounded-md text-sm mt-2">
                            {opsSettings?.kanbanMode === 'PASSIVE' ? (
                                <p className="text-muted"><strong className="text-primary font-semibold">PASSIVE:</strong> Sem obrigatoriedades, sem cobrança operacional. Apenas visualização de dados.</p>
                            ) : opsSettings?.kanbanMode === 'ACTIVE_LITE' ? (
                                <p className="text-muted"><strong className="text-primary font-semibold">ACTIVE LITE:</strong> Habilita regras mínimas de governança (bloqueio estruturado, ciclos, aging, pendências).</p>
                            ) : (
                                <p className="text-muted">Carregando...</p>
                            )}
                        </div>

                        {/* Kamishibai Toggle */}
                        <div className="flex items-center justify-between pt-4 border-t mt-2">
                            <div>
                                <h3 className="text-sm font-semibold text-primary mb-1">Quadro Kamishibai</h3>
                                <p className="text-sm text-muted">
                                    Habilita a gestão visual de processos diretamente nos cards e telas de TV.
                                </p>
                            </div>
                            {opsSettings ? (
                                <label className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={opsSettings.kamishibaiEnabled !== false}
                                            disabled={savingMode}
                                            onChange={(e) => handleKamishibaiChange(e.target.checked)}
                                        />
                                        <div className={`block w-10 h-6 rounded-full transition-colors ${opsSettings.kamishibaiEnabled !== false ? 'bg-primary-600' : 'bg-surface-3 border border-border-strong'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${opsSettings.kamishibaiEnabled !== false ? 'transform translate-x-4' : ''}`}></div>
                                    </div>
                                    <span className="ml-3 text-sm font-medium text-primary">
                                        {opsSettings.kamishibaiEnabled !== false ? 'Ativado' : 'Desativado'}
                                    </span>
                                </label>
                            ) : (
                                <div className="skeleton h-6 w-24 rounded-lg" />
                            )}
                        </div>
                    </div>
                </div>

                {/* ── v1: Cadência Huddle & Console LSW ────────────────────────────── */}
                <div className="mb-6">
                    <HuddleConsole
                        unitId={unitId}
                        opsSettings={opsSettings}
                        user={user}
                        flash={flash}
                    />
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
                        buttonLabel={runningAction ? 'Executando...' : 'Executar Reset'}
                        buttonColorClass="btn-danger"
                        disabled={runningAction}
                        onClick={handleSoftReset}
                    />

                    <OpsCard
                        title="Reaplicar leitos padrão (36)"
                        description="Cria ou atualiza os 36 leitos canônicos. Leitos existentes são preservados."
                        buttonLabel={runningAction ? 'Executando...' : 'Reaplicar Leitos'}
                        buttonColorClass="btn-warning"
                        disabled={runningAction}
                        onClick={handleReapplyCanonical}
                    />

                    <OpsCard
                        title="Exportar snapshot JSON"
                        description="Baixa um arquivo JSON com unit settings + estado atual de todos os leitos."
                        buttonLabel={runningAction ? 'Exportando...' : 'Exportar snapshot'}
                        buttonColorClass="btn-primary"
                        disabled={runningAction}
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
