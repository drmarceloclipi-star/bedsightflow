/**
 * shiftKey.ts — Computação de turno canônico para BedSight HRHDS
 *
 * Spec: docs/lean/LEAN_SHIFTKEY_SPEC_HRHDS.md
 * Contrato: docs/lean/LEAN_CONTRACT_HRHDS.md §5
 *
 * Exporta:
 *   - ShiftType
 *   - ShiftSchedule
 *   - DEFAULT_SHIFT_SCHEDULE
 *   - computeShiftKey(now, schedule?, tz?)
 *
 * NÃO usa timezone local do dispositivo — sempre recebe tz explícito.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShiftType = 'AM' | 'PM';

export interface ShiftSchedule {
    /** Horário de início do turno AM — formato "HH:MM" (24h) */
    amStart: string;
    /** Horário de início do turno PM — formato "HH:MM" (24h) */
    pmStart: string;
}

export const DEFAULT_SHIFT_SCHEDULE: ShiftSchedule = {
    amStart: '07:00',
    pmStart: '19:00',
};

export const DEFAULT_SHIFT_TZ = 'America/Sao_Paulo';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parseia "HH:MM" e retorna total em minutos.
 * Ex: "07:00" → 420, "19:00" → 1140
 */
function parseHHMM(hhMM: string): number {
    const [h, m] = hhMM.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Retorna a data local formatada como "YYYY-MM-DD" usando Intl.
 * Nunca usa new Date().toLocaleDateString() que depende de locale do OS.
 */
function toLocalDateString(date: Date, tz: string): string {
    return new Intl.DateTimeFormat('sv-SE', { // sv-SE dá formato ISO YYYY-MM-DD
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
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
 * Subtrai 1 dia de uma string "YYYY-MM-DD" e retorna a nova string.
 * Sem dependência de timezone — opera sobre a string diretamente.
 */
function subtractOneDay(dateStr: string): string {
    // Interpreta como UTC puro para não ter DST
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

// ── computeShiftKey ───────────────────────────────────────────────────────────

/**
 * Calcula o shiftKey canônico para o instante `now`.
 *
 * Formato de saída: "YYYY-MM-DD-AM" | "YYYY-MM-DD-PM"
 *
 * Regras (spec §3.2):
 *  - now >= amStart  &&  now < pmStart  → YYYY-MM-DD-AM
 *  - now >= pmStart                      → YYYY-MM-DD-PM
 *  - now < amStart   (madrugada)         → (YYYY-MM-DD-1)-PM   (turno PM do dia anterior)
 *
 * @param now      - Instante a calcular (Date)
 * @param schedule - Horários de turno (default: { amStart: "07:00", pmStart: "19:00" })
 * @param tz       - IANA timezone (default: "America/Sao_Paulo")
 * @returns        - shiftKey estável: "YYYY-MM-DD-AM" ou "YYYY-MM-DD-PM"
 */
export function computeShiftKey(
    now: Date,
    schedule: ShiftSchedule = DEFAULT_SHIFT_SCHEDULE,
    tz: string = DEFAULT_SHIFT_TZ
): string {
    const localDateStr = toLocalDateString(now, tz);
    const { hour, minute } = toLocalHHMM(now, tz);

    const localMinutes = hour * 60 + minute;
    const amStartMin = parseHHMM(schedule.amStart);
    const pmStartMin = parseHHMM(schedule.pmStart);

    let shiftType: ShiftType;
    let shiftDate: string;

    if (localMinutes >= amStartMin && localMinutes < pmStartMin) {
        // Turno AM
        shiftType = 'AM';
        shiftDate = localDateStr;
    } else if (localMinutes >= pmStartMin) {
        // Turno PM do dia corrente
        shiftType = 'PM';
        shiftDate = localDateStr;
    } else {
        // Madrugada (antes do amStart) → Turno PM do dia anterior
        shiftType = 'PM';
        shiftDate = subtractOneDay(localDateStr);
    }

    return `${shiftDate}-${shiftType}`;
}

/**
 * Retorna o shiftKey do momento atual.
 * Atalho para computeShiftKey(new Date()).
 */
export function currentShiftKey(
    schedule: ShiftSchedule = DEFAULT_SHIFT_SCHEDULE,
    tz: string = DEFAULT_SHIFT_TZ
): string {
    return computeShiftKey(new Date(), schedule, tz);
}

// ── Exemplos canônicos (spec §4) ──────────────────────────────────────────────
//
// Estes exemplos validam a implementação contra a spec LEAN_SHIFTKEY_SPEC_HRHDS.md §4.
// Para rodar: copiar para um script node e chamar assertShiftKey().
//
// function assertShiftKey(isoLocal: string, expected: string) {
//     // Cria Date a partir de ISO local BRT (offset -03:00)
//     const date = new Date(isoLocal + '-03:00');
//     const result = computeShiftKey(date);
//     const ok = result === expected;
//     console.log(`${ok ? '✅' : '❌'} ${isoLocal} → ${result} (expected: ${expected})`);
// }
//
// assertShiftKey('2026-02-28T03:00:00', '2026-02-27-PM'); // madrugada → PM do dia anterior
// assertShiftKey('2026-02-28T06:59:00', '2026-02-27-PM'); // 1min antes do AM → ainda PM ontem
// assertShiftKey('2026-02-28T07:00:00', '2026-02-28-AM'); // exatamente início AM
// assertShiftKey('2026-02-28T12:30:00', '2026-02-28-AM'); // meio da tarde
// assertShiftKey('2026-02-28T18:59:00', '2026-02-28-AM'); // 1min antes do PM → ainda AM
// assertShiftKey('2026-02-28T19:00:00', '2026-02-28-PM'); // exatamente início PM
// assertShiftKey('2026-02-28T23:45:00', '2026-02-28-PM'); // noite
