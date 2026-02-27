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

const TvSettingsScreen: React.FC<Props> = ({ unitId }) => {
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
            console.error('Failed to save settings:', error);
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
            <div className="p-8 text-center text-muted">
                Carregando configurações...
            </div>
        );
    }

    return (
        <div>
            <ConfirmModal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                onConfirm={handleSave}
                title="Salvar Configurações de TV"
                description="Você está prestes a alterar as configurações de exibição da TV. As mudanças serão aplicadas em tempo real."
                consequences={['As telas da TV serão atualizadas imediatamente.']}
                confirmLabel="Salvar Alterações"
            />

            <div className="settings-page-header">
                <div>
                    <h2 className="settings-page-title">
                        Configurações de TV
                    </h2>
                    <p className="settings-page-subtitle">
                        Alterações são refletidas na TV em tempo real.
                    </p>
                </div>
                <button
                    onClick={() => setShowSaveModal(true)}
                    disabled={saving}
                    className={`btn-save${saved ? ' btn-save--saved' : ''}`}
                >
                    {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {errorMsg && (
                <div className="settings-error-banner">
                    <strong className="text-danger">Ops!</strong>{' '}
                    <span className="text-danger">{errorMsg}</span>
                </div>
            )}

            {/* Rotation toggle */}
            <Card title="Rotação Automática" subtitle="Habilitar a troca automática de telas na TV">
                <Toggle
                    label="Rotação habilitada"
                    value={settings.rotationEnabled}
                    onChange={handleRotationToggle}
                />
            </Card>

            {/* Screens */}
            <Card title="Telas e Duração" subtitle="Configure quais telas exibir e por quanto tempo (em segundos)">
                <div className="settings-screen-list">
                    {settings.screens.map((screen: BoardScreenConfig) => (
                        <div key={screen.key} className="settings-screen-row">
                            <div className="settings-screen-row-left">
                                <Toggle
                                    label=""
                                    value={screen.enabled}
                                    onChange={() => handleScreenToggle(screen.key)}
                                    compact
                                />
                                <span className={`settings-screen-label${!screen.enabled ? ' settings-screen-label--disabled' : ''}`}>
                                    {SCREEN_LABELS[screen.key]}
                                </span>
                            </div>
                            <div className="settings-screen-row-right">
                                <input
                                    type="number"
                                    min={5}
                                    max={120}
                                    value={screen.durationSeconds}
                                    onChange={e => handleDurationChange(screen.key, Number(e.target.value))}
                                    disabled={!screen.enabled}
                                    className="settings-duration-input"
                                />
                                <span className="settings-duration-unit">seg</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Pagination */}
            <Card title="Paginação" subtitle="Número de leitos e layout exibidos por página">
                <div className="settings-grid-2col">
                    <div className="settings-grid-row">
                        <div className="settings-grid-cell">
                            <NumberField
                                label="Kanban — leitos"
                                value={(settings as BoardSettings & { kanbanBedsPerPage?: number }).kanbanBedsPerPage ?? 18}
                                onChange={v => handleBedsPerPageChange('kanbanBedsPerPage', v)}
                                min={1} max={72}
                            />
                        </div>
                        <div className="settings-grid-cell">
                            <NumberField
                                label="Kanban — colunas"
                                value={(settings as BoardSettings & { kanbanColumnsPerPage?: number }).kanbanColumnsPerPage ?? 1}
                                onChange={v => handleBedsPerPageChange('kanbanColumnsPerPage' as 'kanbanBedsPerPage', v)}
                                min={1} max={2}
                            />
                        </div>
                    </div>
                    <div className="settings-grid-row">
                        <div className="settings-grid-cell">
                            <NumberField
                                label="Kamishibai — leitos"
                                value={(settings as BoardSettings & { kamishibaiBedsPerPage?: number }).kamishibaiBedsPerPage ?? 18}
                                onChange={v => handleBedsPerPageChange('kamishibaiBedsPerPage', v)}
                                min={1} max={72}
                            />
                        </div>
                        <div className="settings-grid-cell">
                            <NumberField
                                label="Kamishibai — colunas"
                                value={(settings as BoardSettings & { kamishibaiColumnsPerPage?: number }).kamishibaiColumnsPerPage ?? 1}
                                onChange={v => handleBedsPerPageChange('kamishibaiColumnsPerPage' as 'kamishibaiBedsPerPage', v)}
                                min={1} max={2}
                            />
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="settings-card">
        <div className="settings-card-header">
            <div className="settings-card-title">{title}</div>
            {subtitle && <div className="settings-card-subtitle">{subtitle}</div>}
        </div>
        <div className="settings-card-body">
            {children}
        </div>
    </div>
);

const Toggle: React.FC<{ label: string; value: boolean; onChange: () => void; compact?: boolean }> = ({
    label, value, onChange, compact = false
}) => (
    <div className={`toggle-row${compact ? ' toggle-row--compact' : ''}`}>
        <button
            role="switch"
            aria-checked={value}
            onClick={onChange}
            className={`toggle-switch${value ? ' toggle-switch--on' : ''}`}
        >
            <span className="toggle-switch-knob" />
        </button>
        {label && <span className="toggle-label">{label}</span>}
    </div>
);

const NumberField: React.FC<{ label: string; value: number; onChange: (v: number) => void; min: number; max: number }> = ({
    label, value, onChange, min, max
}) => {
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
        if (!isNaN(parsed)) {
            onChange(parsed);
        }
    };

    return (
        <div className="number-field">
            <span className="number-field-label">{label}</span>
            <div className="number-field-input-group">
                <input
                    type="number"
                    min={min}
                    max={max}
                    value={localValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onFocus={(e) => e.target.select()}
                    className="number-field-input"
                />
            </div>
        </div>
    );
};

export default TvSettingsScreen;
