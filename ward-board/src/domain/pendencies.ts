/**
 * pendencies.ts — Helpers canônicos para cálculo de pendências
 *
 * Fonte de verdade para regras de contagem usadas em TODA a UI (TV, editor, CF).
 * Regra: usar EXATAMENTE o mesmo critério do acceptance (PENDENCIES_V1_ACCEPTANCE_2026-02-28.md).
 *
 * D3: overdue = dueAt < now && status === 'open'
 * D4: pendência sem dueAt → open, sem badge de overdue
 * canceled e done são ignorados em todas as contagens
 */
import type { Bed, Pendency } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendencyCounts {
    open: number;
    overdue: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converte um TimestampLike para ms (Unix epoch).
 * Suporta: string ISO, Date, Firestore Timestamp ({ toDate() }).
 */
function toMs(value: unknown): number | null {
    if (!value) return null;
    if (typeof value === 'string') {
        const ms = Date.parse(value);
        return isNaN(ms) ? null : ms;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof (value as { toDate?: unknown }).toDate === 'function') {
        return ((value as { toDate: () => Date }).toDate()).getTime();
    }
    return null;
}

/**
 * Calcula contagens de pendências por leito.
 * Ignora status='done' e status='canceled'.
 *
 * Regra Lean: leito vazio (patientAlias vazio ou ausente) não entra em KPIs.
 * Retorna {open:0, overdue:0} para leitos sem patientAlias.
 *
 * @param bed - Documento do leito
 * @param now - Referência de tempo (default: Date.now() — injetável para testes e useMemo)
 */
export function computePendencyCounts(bed: Bed, now: Date = new Date()): PendencyCounts {
    // PZ1: leito vazio não exibe badge na TV nem entra em KPIs
    if (!bed.patientAlias || bed.patientAlias.trim() === '') {
        return { open: 0, overdue: 0 };
    }

    const pendencies: Pendency[] = Array.isArray(bed.pendencies) ? bed.pendencies : [];
    const nowMs = now.getTime();

    let open = 0;
    let overdue = 0;

    for (const p of pendencies) {
        if (p.status !== 'open') continue; // ignora done e canceled
        open++;
        if (p.dueAt) {
            const dueMs = toMs(p.dueAt);
            if (dueMs !== null && dueMs < nowMs) {
                overdue++;
            }
        }
    }

    return { open, overdue };
}

/**
 * Soma as contagens de pendências de uma lista de beds.
 * Reutiliza computePendencyCounts (que já exclui leitos vazios internamente —
 * retorna zeros quando patientAlias é vazio).
 */
export function computeUnitPendencyCounts(beds: Bed[], now: Date = new Date()): PendencyCounts {
    let open = 0;
    let overdue = 0;

    for (const bed of beds) {
        const counts = computePendencyCounts(bed, now);
        open += counts.open;
        overdue += counts.overdue;
    }

    return { open, overdue };
}

/** Retorna true se o bed tem ao menos 1 pendência vencida. */
export function hasOverdue(bed: Bed, now: Date = new Date()): boolean {
    return computePendencyCounts(bed, now).overdue > 0;
}

/**
 * Formata badge de pendências para exibição na TV.
 * - 0 open → '' (não renderizar nada)
 * - só open → '2'
 * - com overdue → '2 ⚠1'
 */
export function formatPendencyBadge(counts: PendencyCounts): string {
    if (counts.open === 0) return '';
    if (counts.overdue === 0) return String(counts.open);
    return `${counts.open} ⚠${counts.overdue}`;
}
