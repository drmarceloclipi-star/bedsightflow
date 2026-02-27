import React, { useState, useEffect } from 'react';
import { BoardSettingsRepository } from '../../../repositories/BoardSettingsRepository';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import type { BoardSettings, BoardScreenConfig, BoardScreenKey } from '../../../domain/types';

interface Props {
    unitId: string;
}

const SCREEN_LABELS: Record<BoardScreenKey, string> = {
    kanban: 'Quadro Kanban',
    kamishibai: 'Quadro Kamishibai',
    summary: 'Resumo da Unidade',
};

const MobileTvSettingsScreen: React.FC<Props> = ({ unitId }) => {
    const [settings, setSettings] = useState<BoardSettings | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const unsub = BoardSettingsRepository.listenToSettings(unitId, setSettings);
        return unsub;
    }, [unitId]);

    const handleScreenToggle = (key: BoardScreenKey) => {
        if (!settings) return;
        setSettings(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                screens: prev.screens.map(s =>
                    s.key === key ? { ...s, enabled: !s.enabled } : s
                )
            };
        });
    };

    const handleDurationChange = (key: BoardScreenKey, value: number) => {
        if (!settings) return;
        setSettings(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                screens: prev.screens.map(s =>
                    s.key === key ? { ...s, durationSeconds: value } : s
                )
            };
        });
    };

    const handleRotationToggle = () => {
        if (!settings) return;
        setSettings(prev => prev ? { ...prev, rotationEnabled: !prev.rotationEnabled } : prev);
    };

    const handleBedsPerPageChange = (field: string, value: number) => {
        if (!settings) return;
        setSettings(prev => prev ? { ...prev, [field]: value } : prev);
    };

    const handleSave = async (reason: string) => {
        if (!settings) return;
        setShowSaveModal(false);
        setSaving(true);
        setErrorMsg('');
        try {
            await BoardSettingsRepository.updateSettings(unitId, settings, reason);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error: unknown) {
            if (error instanceof Error) {
                setErrorMsg(error.message);
            } else {
                setErrorMsg('Erro desconhecido ao salvar.');
            }
        } finally {
            setSaving(false);
        }
    };

    if (!settings) {
        return (
            <div className="madmin-screen-pad madmin-center-fill">
                <div className="animate-pulse text-muted">Carregando configurações...</div>
            </div>
        );
    }

    return (
        <div className="madmin-screen-pad">
            <ConfirmModal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                onConfirm={handleSave}
                title="Salvar Configurações de TV"
                description="Você está prestes a alterar as configurações de exibição da TV. As mudanças serão aplicadas em tempo real."
                consequences={['As telas da TV serão atualizadas imediatamente.']}
                confirmLabel="Salvar Alterações"
            />

            <div className="madmin-screen-header">
                <div>
                    <h2 className="madmin-screen-title">Configurações de TV</h2>
                    <p className="madmin-screen-subtitle">Alterações refletidas em tempo real.</p>
                </div>
                <button
                    onClick={() => setShowSaveModal(true)}
                    disabled={saving}
                    className={`madmin-btn madmin-btn-primary${saved ? ' madmin-btn-saved' : ''}`}
                >
                    {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {errorMsg && (
                <div className="madmin-error-banner">
                    <strong>Ops!</strong> {errorMsg}
                </div>
            )}

            {/* Rotation toggle card */}
            <div className="madmin-card">
                <div className="madmin-card-section-title">Rotação Automática</div>
                <p className="madmin-card-desc">Habilitar a troca automática de telas na TV</p>
                <div className="madmin-toggle-row">
                    <button
                        role="switch"
                        aria-checked={settings.rotationEnabled}
                        onClick={handleRotationToggle}
                        className={`madmin-toggle${settings.rotationEnabled ? ' madmin-toggle--on' : ''}`}
                    >
                        <span className="madmin-toggle-knob" />
                    </button>
                    <span className="madmin-toggle-label">
                        {settings.rotationEnabled ? 'Habilitada' : 'Desabilitada'}
                    </span>
                </div>
            </div>

            {/* Screens card */}
            <div className="madmin-card">
                <div className="madmin-card-section-title">Telas e Duração</div>
                <p className="madmin-card-desc">Configure quais telas exibir</p>
                <div className="madmin-screen-list">
                    {settings.screens.map((screen: BoardScreenConfig) => (
                        <div key={screen.key} className="madmin-screen-row">
                            <div className="madmin-screen-row-left">
                                <button
                                    role="switch"
                                    aria-checked={screen.enabled}
                                    onClick={() => handleScreenToggle(screen.key)}
                                    className={`madmin-toggle madmin-toggle--sm${screen.enabled ? ' madmin-toggle--on' : ''}`}
                                >
                                    <span className="madmin-toggle-knob" />
                                </button>
                                <span className={`madmin-screen-label${!screen.enabled ? ' madmin-screen-label--dim' : ''}`}>
                                    {SCREEN_LABELS[screen.key]}
                                </span>
                            </div>
                            <div className="madmin-screen-row-right">
                                <input
                                    type="number"
                                    min={5}
                                    max={120}
                                    value={screen.durationSeconds}
                                    onChange={e => handleDurationChange(screen.key, Number(e.target.value))}
                                    disabled={!screen.enabled}
                                    className="madmin-duration-input"
                                />
                                <span className="madmin-duration-unit">seg</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pagination card */}
            <div className="madmin-card">
                <div className="madmin-card-section-title">Paginação</div>
                <p className="madmin-card-desc">Leitos por página</p>
                <div className="madmin-number-grid">
                    <MobileNumberField
                        label="Kanban — leitos"
                        value={(settings as BoardSettings & { kanbanBedsPerPage?: number }).kanbanBedsPerPage ?? 18}
                        onChange={v => handleBedsPerPageChange('kanbanBedsPerPage', v)}
                        min={1} max={72}
                    />
                    <MobileNumberField
                        label="Kanban — colunas"
                        value={(settings as BoardSettings & { kanbanColumnsPerPage?: number }).kanbanColumnsPerPage ?? 1}
                        onChange={v => handleBedsPerPageChange('kanbanColumnsPerPage', v)}
                        min={1} max={2}
                    />
                    <MobileNumberField
                        label="Kamishibai — leitos"
                        value={(settings as BoardSettings & { kamishibaiBedsPerPage?: number }).kamishibaiBedsPerPage ?? 18}
                        onChange={v => handleBedsPerPageChange('kamishibaiBedsPerPage', v)}
                        min={1} max={72}
                    />
                    <MobileNumberField
                        label="Kamishibai — colunas"
                        value={(settings as BoardSettings & { kamishibaiColumnsPerPage?: number }).kamishibaiColumnsPerPage ?? 1}
                        onChange={v => handleBedsPerPageChange('kamishibaiColumnsPerPage', v)}
                        min={1} max={2}
                    />
                </div>
            </div>
        </div>
    );
};

const MobileNumberField: React.FC<{
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
}> = ({ label, value, onChange, min, max }) => {
    const [localValue, setLocalValue] = useState<string>(String(value));

    useEffect(() => {
        setLocalValue(String(value));
    }, [value]);

    const handleBlur = () => {
        let val = parseInt(localValue, 10);
        if (isNaN(val)) val = min;
        if (val < min) val = min;
        if (val > max) val = max;
        setLocalValue(String(val));
        onChange(val);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
        const parsed = parseInt(e.target.value, 10);
        if (!isNaN(parsed)) onChange(parsed);
    };

    return (
        <div className="madmin-number-field">
            <span className="madmin-number-label">{label}</span>
            <input
                type="number"
                min={min}
                max={max}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className="madmin-number-input"
            />
        </div>
    );
};

export default MobileTvSettingsScreen;
