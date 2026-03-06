/**
 * ThresholdsEditor.tsx
 *
 * P2-05 — Editor de thresholds do Mission Control.
 *
 * Permite ao admin configurar os limites (warning/critical) de cada KPI monitorado
 * no Mission Control, sem editar código.
 *
 * Dados lidos/salvos em:  units/{unitId}/settings/mission_control
 * Defaults:               DEFAULT_MISSION_CONTROL_THRESHOLDS (missionControl.ts)
 *
 * Grupos de configuração:
 *   1. Bloqueios (% leitos e aging em horas)
 *   2. Kamishibai (% impedimentos)
 *   3. Freshness / Não revisados
 *   4. Escalonamento v1 (horas overdue / bloqueio)
 *
 * Validações por campo:
 *   - Valor > 0
 *   - Em pares warning/critical: warning < critical
 */

import React, { useEffect, useReducer, useState } from 'react';
import { UnitSettingsRepository } from '../../../../repositories/UnitSettingsRepository';
import {
    DEFAULT_MISSION_CONTROL_THRESHOLDS,
    type MissionControlThresholds,
} from '../../../../domain/missionControl';
import { useAuthStatus } from '../../../../hooks/useAuthStatus';

// ── Types ─────────────────────────────────────────────────────────────────────

type FormValues = Record<keyof MissionControlThresholds, string>;

interface Props {
    unitId: string;
    /** Callback chamado após salvar com sucesso */
    onSaved?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFormValues(t: MissionControlThresholds): FormValues {
    return Object.fromEntries(
        Object.entries(t).map(([k, v]) => [k, String(v)])
    ) as FormValues;
}

function parseFormValues(form: FormValues): MissionControlThresholds | null {
    const result: Partial<MissionControlThresholds> = {};
    for (const [k, v] of Object.entries(form)) {
        const n = parseFloat(v);
        if (!isFinite(n) || n <= 0) return null;
        (result as Record<string, number>)[k] = n;
    }
    return result as MissionControlThresholds;
}

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidationResult {
    errors: Partial<Record<keyof MissionControlThresholds, string>>;
    valid: boolean;
}

const PAIRS: [keyof MissionControlThresholds, keyof MissionControlThresholds][] = [
    ['blockedPctWarning', 'blockedPctCritical'],
    ['blockedAgingWarningHours', 'blockedAgingCriticalHours'],
    ['kamishibaiImpedimentPctWarning', 'kamishibaiImpedimentPctCritical'],
    ['unreviewedShiftWarningCount', 'unreviewedShiftCriticalCount'],
    ['escalationOverdueHoursWarning', 'escalationOverdueHoursCritical'],
    ['escalationMainBlockerHoursWarning', 'escalationMainBlockerHoursCritical'],
];

function validate(form: FormValues): ValidationResult {
    const errors: Partial<Record<keyof MissionControlThresholds, string>> = {};

    // Verificar que todos os campos são números positivos
    for (const [k, v] of Object.entries(form) as [keyof MissionControlThresholds, string][]) {
        const n = parseFloat(v);
        if (v.trim() === '' || !isFinite(n) || n <= 0) {
            errors[k] = 'Deve ser > 0';
        }
    }

    // Verificar pares warning < critical
    for (const [warnKey, critKey] of PAIRS) {
        if (errors[warnKey] || errors[critKey]) continue;
        const warn = parseFloat(form[warnKey]);
        const crit = parseFloat(form[critKey]);
        if (warn >= crit) {
            errors[warnKey] = `Aviso deve ser < Crítico (${crit})`;
        }
    }

    return { errors, valid: Object.keys(errors).length === 0 };
}

// ── Form state management (useReducer) ────────────────────────────────────────

type Action =
    | { type: 'SET_FIELD'; key: keyof MissionControlThresholds; value: string }
    | { type: 'RESET'; values: FormValues };

function formReducer(state: FormValues, action: Action): FormValues {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.key]: action.value };
        case 'RESET':
            return action.values;
    }
}

// ── Field components ──────────────────────────────────────────────────────────

interface FieldProps {
    label: string;
    fieldKey: keyof MissionControlThresholds;
    value: string;
    error?: string;
    unit: string;
    onChange: (key: keyof MissionControlThresholds, val: string) => void;
}

const ThresholdField: React.FC<FieldProps> = ({ label, fieldKey, value, error, unit, onChange }) => (
    <div className="flex flex-col gap-1">
        <label htmlFor={`tf-${fieldKey}`} className="text-xs font-medium text-primary">
            {label}
        </label>
        <div className="flex items-center gap-1.5">
            <input
                id={`tf-${fieldKey}`}
                type="number"
                min="0"
                step="1"
                value={value}
                onChange={(e) => onChange(fieldKey, e.target.value)}
                className={`input input-sm w-24 text-right ${error ? 'border-danger' : ''}`}
                aria-describedby={error ? `tf-${fieldKey}-error` : undefined}
                aria-invalid={!!error}
            />
            <span className="text-xs text-muted">{unit}</span>
        </div>
        {error && (
            <p id={`tf-${fieldKey}-error`} className="text-xs text-danger mt-0.5">{error}</p>
        )}
    </div>
);

// ── Section header ────────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ title: string; description?: string }> = ({ title, description }) => (
    <div className="mb-3">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wide">{title}</h4>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const ThresholdsEditor: React.FC<Props> = ({ unitId, onSaved }) => {
    const { user } = useAuthStatus();

    const [form, dispatch] = useReducer(
        formReducer,
        toFormValues(DEFAULT_MISSION_CONTROL_THRESHOLDS)
    );
    const [loadedFromFirestore, setLoadedFromFirestore] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Subscribe to Firestore thresholds
    useEffect(() => {
        const unsub = UnitSettingsRepository.subscribeMissionControlSettings(unitId, (thresholds) => {
            if (!loadedFromFirestore) {
                dispatch({ type: 'RESET', values: toFormValues(thresholds) });
                setLoadedFromFirestore(true);
            }
        });
        return unsub;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unitId]);

    const { errors, valid } = validate(form);
    const isDirty = JSON.stringify(form) !== JSON.stringify(toFormValues(DEFAULT_MISSION_CONTROL_THRESHOLDS));

    const handleChange = (key: keyof MissionControlThresholds, val: string) => {
        setSaveResult(null);
        dispatch({ type: 'SET_FIELD', key, value: val });
    };

    const handleSave = async () => {
        if (!valid || !user) return;
        const parsed = parseFormValues(form);
        if (!parsed) return;

        setSaving(true);
        setSaveResult(null);
        setSaveError(null);
        try {
            await UnitSettingsRepository.saveMissionControlThresholds(unitId, parsed, {
                uid: user.uid,
                email: user.email ?? '',
                displayName: user.displayName ?? undefined,
            });
            setSaveResult('success');
            onSaved?.();
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : 'Erro desconhecido.');
            setSaveResult('error');
        } finally {
            setSaving(false);
        }
    };

    const handleResetDefaults = async () => {
        if (!user) return;
        const defaults = toFormValues(DEFAULT_MISSION_CONTROL_THRESHOLDS);
        dispatch({ type: 'RESET', values: defaults });
        setSaving(true);
        setSaveResult(null);
        setSaveError(null);
        try {
            await UnitSettingsRepository.resetMissionControlThresholds(unitId, {
                uid: user.uid,
                email: user.email ?? '',
                displayName: user.displayName ?? undefined,
            });
            setSaveResult('success');
            onSaved?.();
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : 'Erro ao restaurar defaults.');
            setSaveResult('error');
        } finally {
            setSaving(false);
        }
    };

    const f = (key: keyof MissionControlThresholds, label: string, unit: string) => (
        <ThresholdField
            key={key}
            label={label}
            fieldKey={key}
            value={form[key]}
            error={errors[key]}
            unit={unit}
            onChange={handleChange}
        />
    );

    if (!loadedFromFirestore) {
        return <div className="skeleton h-64 w-full rounded-lg" />;
    }

    return (
        <div className="flex flex-col gap-6">

            {/* ── Bloqueios ─────────────────────────────────────────────────── */}
            <div>
                <SectionTitle
                    title="Bloqueios"
                    description="% dos leitos ativos com bloqueio registrado e tempo máximo de bloqueio."
                />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    {f('blockedPctWarning',         '% Aviso',           '%')}
                    {f('blockedPctCritical',         '% Crítico',         '%')}
                    {f('blockedAgingWarningHours',   'Aging Aviso',       'h')}
                    {f('blockedAgingCriticalHours',  'Aging Crítico',     'h')}
                </div>
            </div>

            {/* ── Kamishibai ────────────────────────────────────────────────── */}
            <div>
                <SectionTitle
                    title="Kamishibai"
                    description="% dos cards Kamishibai com impedimento registrado."
                />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    {f('kamishibaiImpedimentPctWarning',  '% Aviso',   '%')}
                    {f('kamishibaiImpedimentPctCritical', '% Crítico', '%')}
                </div>
            </div>

            {/* ── Freshness ─────────────────────────────────────────────────── */}
            <div>
                <SectionTitle
                    title="Freshness / Não revisados"
                    description="Quantidade de leitos sem revisão dentro dos períodos e do turno atual."
                />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    {f('freshness12hWarningCount',   '12h — Aviso',   'leitos')}
                    {f('freshness24hWarningCount',   '24h — Aviso',   'leitos')}
                    {f('freshness24hCriticalCount',  '24h — Crítico', 'leitos')}
                    {f('freshness48hCriticalCount',  '48h — Crítico', 'leitos')}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 mt-3">
                    {f('unreviewedShiftWarningCount',  'Turno — Aviso',   'leitos')}
                    {f('unreviewedShiftCriticalCount', 'Turno — Crítico', 'leitos')}
                </div>
            </div>

            {/* ── Escalonamento ─────────────────────────────────────────────── */}
            <div>
                <SectionTitle
                    title="Escalonamento"
                    description="Tempo (horas) para classificar pendências vencidas ou bloqueios como críticos."
                />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    {f('escalationOverdueHoursWarning',      'Overdue — Aviso',       'h')}
                    {f('escalationOverdueHoursCritical',     'Overdue — Crítico',     'h')}
                    {f('escalationMainBlockerHoursWarning',  'Bloqueio — Aviso',      'h')}
                    {f('escalationMainBlockerHoursCritical', 'Bloqueio — Crítico',    'h')}
                </div>
            </div>

            {/* ── Actions ───────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap pt-2 border-t">
                <button
                    className="btn btn-primary text-sm"
                    disabled={saving || !valid}
                    onClick={handleSave}
                    aria-busy={saving}
                >
                    {saving ? 'Salvando...' : 'Salvar thresholds'}
                </button>
                <button
                    className="btn btn-secondary text-sm"
                    disabled={saving || !isDirty}
                    onClick={handleResetDefaults}
                >
                    Restaurar defaults
                </button>

                {saveResult === 'success' && (
                    <span className="text-xs text-success font-semibold">Salvo com sucesso.</span>
                )}
                {saveResult === 'error' && (
                    <span className="text-xs text-danger font-semibold">
                        {saveError ?? 'Erro ao salvar.'}
                    </span>
                )}
            </div>
        </div>
    );
};

export default ThresholdsEditor;
