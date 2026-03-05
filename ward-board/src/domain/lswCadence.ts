/**
 * lswCadence.ts — Domínio de Cadência LSW (Leader Standard Work)
 *
 * Patch 2 do LSW Closed-Loop V2.
 * Ref: LSW_V2_SPEC.md §Patch 2
 *
 * Exporta funções puras (sem I/O) para:
 *   - computeHuddleCadence: calcula status de aderência ao rito de huddle
 *
 * NUNCA importa repositórios ou Firebase — é domínio puro.
 */

import type { UnitOpsSettings } from './types';
import type { ShiftSchedule } from './shiftKey';
import { computeShiftKey, DEFAULT_SHIFT_SCHEDULE, DEFAULT_SHIFT_TZ } from './shiftKey';

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Status de cadência do huddle para o turno atual.
 * OK       → huddle foi COMPLETED no shiftKey atual
 * DUE      → turno iniciou há menos de graceMinutes sem huddle (período de graça)
 * OVERDUE  → turno iniciou há mais de graceMinutes sem huddle concluído
 *
 * graceMinutes padrão = 30. Override por unidade via UnitOpsSettings.lswGraceMinutes.
 */
export type HuddleCadenceStatus = 'OK' | 'DUE' | 'OVERDUE';

/**
 * Estado completo de cadência — retornado por computeHuddleCadence.
 * Todos os campos são derivados, nunca armazenados.
 */
export interface HuddleCadenceState {
    status: HuddleCadenceStatus;
    currentShiftKey: string;
    /** shiftKey do último huddle completado (ou undefined se nunca houve) */
    lastCompletedShiftKey: string | undefined;
    /** Minutos decorridos desde o início do turno atual */
    minutesSinceShiftStart: number;
    /**
     * Bucket legível para UI.
     * null quando status === 'OK'.
     * Ex: '0-30min' | '30-60min' | '>1h' | '>2h'
     */
    overdueBucket: string | null;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/**
 * Parseia "HH:MM" e retorna total em minutos.
 */
function parseHHMM(hhMM: string): number {
    const [h, m] = hhMM.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Retorna { hour, minute } no fuso indicado.
 */
function toLocalHHMM(date: Date, tz: string): { hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
    }).formatToParts(date);

    const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    return { hour, minute };
}

/**
 * Calcula quantos minutos se passaram desde o início do turno atual.
 */
function computeMinutesSinceShiftStart(
    now: Date,
    schedule: ShiftSchedule,
    tz: string
): number {
    const { hour, minute } = toLocalHHMM(now, tz);
    const localMinutes = hour * 60 + minute;
    const amStartMin = parseHHMM(schedule.amStart);
    const pmStartMin = parseHHMM(schedule.pmStart);

    // Determina qual turno está ativo e quando começou
    if (localMinutes >= amStartMin && localMinutes < pmStartMin) {
        // Turno AM — começou em amStart do dia atual
        return localMinutes - amStartMin;
    } else if (localMinutes >= pmStartMin) {
        // Turno PM — começou em pmStart do dia atual
        return localMinutes - pmStartMin;
    } else {
        // Madrugada — turno PM do dia anterior (localMinutes < amStart)
        // Minutos desde pmStart até meia-noite + minutos desde meia-noite até agora
        return (24 * 60 - pmStartMin) + localMinutes;
    }
}

/**
 * Retorna um bucket legível a partir de minutos de atraso.
 */
function bucketMinutes(min: number, graceMin: number): string {
    if (min < graceMin) return `0-${graceMin}min`;
    if (min < 60) return `${graceMin}-60min`;
    if (min < 120) return '>1h';
    return '>2h';
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Computa o estado de cadência do huddle para o instante `now`.
 *
 * Lógica:
 *  - Se lastHuddleShiftKey === currentShiftKey → OK (huddle foi feito neste turno)
 *  - Se minutesSinceShiftStart < 30 → DUE (período de graça)
 *  - Se minutesSinceShiftStart >= 30 → OVERDUE
 *
 * NOTA: Usa lastHuddleShiftKey de UnitOpsSettings, que é atualizado por
 * HuddleRepository.setHuddleCompleted(). Huddles apenas iniciados (sem COMPLETED)
 * são tratados como DUE/OVERDUE até a conclusão formal.
 *
 * @param now     Instante atual
 * @param ops     Configurações operacionais da unidade (contém lastHuddleShiftKey)
 * @param schedule Horários de turno (default: { amStart: '07:00', pmStart: '19:00' })
 * @param tz       IANA timezone (default: 'America/Sao_Paulo')
 */
export function computeHuddleCadence(
    now: Date,
    ops: Pick<UnitOpsSettings, 'lastHuddleShiftKey' | 'lswGraceMinutes'>,
    schedule: ShiftSchedule = DEFAULT_SHIFT_SCHEDULE,
    tz: string = DEFAULT_SHIFT_TZ
): HuddleCadenceState {
    const graceMinutes = ops.lswGraceMinutes ?? 30;
    const current = computeShiftKey(now, schedule, tz);
    const last = ops.lastHuddleShiftKey;

    if (last === current) {
        // Huddle já foi completado neste turno
        return {
            status: 'OK',
            currentShiftKey: current,
            lastCompletedShiftKey: last,
            minutesSinceShiftStart: 0,
            overdueBucket: null,
        };
    }

    const minutesSinceShiftStart = computeMinutesSinceShiftStart(now, schedule, tz);
    const status: HuddleCadenceStatus = minutesSinceShiftStart < graceMinutes ? 'DUE' : 'OVERDUE';

    return {
        status,
        currentShiftKey: current,
        lastCompletedShiftKey: last,
        minutesSinceShiftStart,
        overdueBucket: bucketMinutes(minutesSinceShiftStart, graceMinutes),
    };
}

// ── UI Helpers ─────────────────────────────────────────────────────────────────

/**
 * Retorna label legível para exibição no banner de TV e badge do admin.
 */
export function huddleCadenceLabel(state: HuddleCadenceState): string {
    switch (state.status) {
        case 'OK': return 'Huddle concluído ✓';
        case 'DUE': return `Huddle pendente (${state.overdueBucket})`;
        case 'OVERDUE': return `⚠ Huddle em atraso (${state.overdueBucket})`;
    }
}
