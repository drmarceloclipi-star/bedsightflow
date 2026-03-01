import type { ActorRef, TimestampLike, SpecialtyKey } from './types';

export type HuddleType = 'AM' | 'PM';
export type HuddleItemStatus = 'done' | 'skipped';
export type ActionStatus = 'open' | 'done' | 'canceled';

export interface HuddleChecklistItem {
    key: string;               // ex: 'review_kanban_24h'
    label: string;             // label humano
    status: HuddleItemStatus;  // done|skipped
    note?: string;
}

export interface HuddleAction {
    id: string;                // uuid
    title: string;             // obrigatório, curto
    ownerName?: string;        // v1: string livre (não depende de diretório)
    domain?: SpecialtyKey;     // opcional
    dueAt?: TimestampLike;     // opcional
    status: ActionStatus;      // open/done/canceled
    createdAt: TimestampLike;
    createdBy: ActorRef;
    updatedAt?: TimestampLike;
    updatedBy?: ActorRef;
    doneAt?: TimestampLike;
    doneBy?: ActorRef;
    canceledAt?: TimestampLike;
    canceledBy?: ActorRef;
}

export interface HuddleSnapshotSummary {
    generatedAt: TimestampLike;
    source?: string;
    thresholdsUsed?: Record<string, unknown>;
    shiftKey: string;

    // Gestão à vista / cadência
    unreviewedBedsCount?: number;

    // Pendências
    openPendenciesCount?: number;
    overduePendenciesCount?: number;

    // Escalonamentos (canônico)
    escalationsTotal?: number;
    escalationsOverdueCritical?: number;
    escalationsBlockerCritical?: number;

    // Fluxo de alta
    dischargeNext24hCount?: number;

    // Bloqueios
    blockedBedsCount?: number;
    maxBlockedAgingHours?: number;
}

export interface HuddleDoc {
    id: string;                     // RECOMENDADO: shiftKey (1 por turno)
    unitId: string;
    huddleType: HuddleType;
    shiftKey: string;               // computeShiftKey(now)
    reviewOfShiftKey?: string;      // calculado: AM revisa PM anterior; PM revisa AM do dia
    startedAt: TimestampLike;
    endedAt?: TimestampLike;

    ledBy?: ActorRef;               // quem conduziu
    recordedBy: ActorRef;           // quem registrou
    checklist: HuddleChecklistItem[];

    topActions: HuddleAction[];     // Top 3 (UI enforce)
    reviewNotes?: string;           // notas rápidas sobre a revisão anterior (opcional)

    snapshotSummary?: HuddleSnapshotSummary; // legado
    startSummary?: HuddleSnapshotSummary;    // capturado ao iniciar
    endSummary?: HuddleSnapshotSummary;      // capturado ao encerrar

    createdAt: TimestampLike;
    updatedAt?: TimestampLike;
}

// ----------------------------------------------------------------------------
// Constantes & Helpers
// ----------------------------------------------------------------------------

export const MAX_TOP_ACTIONS = 3;

/**
 * Checklist default contendo os 8 passos canônicos do Leader Standard Work.
 */
export const DEFAULT_HUDDLE_CHECKLIST: Omit<HuddleChecklistItem, 'status'>[] = [
    { key: 'review_previous_shift', label: 'Review do turno anterior (ações abertas)' },
    { key: 'review_kanban_24h', label: 'Revisar Kanban <24h (altas iminentes)' },
    { key: 'review_kamishibai_blocked', label: 'Revisar Kamishibai bloqueados (vermelhos)' },
    { key: 'review_overdue_pendencies', label: 'Revisar Pendências vencidas (⚠)' },
    { key: 'review_unreviewed_beds', label: 'Revisar Não revisados neste turno (sem cor)' },
    { key: 'review_escalations', label: 'Revisar 🔥 Escalonamentos (críticos)' },
    { key: 'define_top_actions', label: 'Definir Top 3 ações do turno' },
    { key: 'confirm_followup', label: 'Confirmar follow-up (quem cobra)' },
];

/**
 * Retorna o array de itens do checklist default, todos inicializados com `skipped`.
 */
export function buildDefaultChecklist(): HuddleChecklistItem[] {
    return DEFAULT_HUDDLE_CHECKLIST.map((item) => ({ ...item, status: 'skipped' as HuddleItemStatus }));
}

/**
 * Identifica o shift key a ser revisado pelo turno atual.
 * - Huddle AM revisa o PM do dia anterior.
 * - Huddle PM revisa o AM do mesmo dia.
 * 
 * @param currentShiftKey O shift key do turno atual ex: "YYYY-MM-DD-AM"
 */
export function getReviewOfShiftKey(currentShiftKey: string): string {
    const isAM = currentShiftKey.endsWith('-AM');
    const isPM = currentShiftKey.endsWith('-PM');

    if (!isAM && !isPM) return currentShiftKey; // fallback se for fora do padrão

    // Formato: YYYY-MM-DD-AM ou YYYY-MM-DD-PM
    const datePart = currentShiftKey.substring(0, 10);

    if (isPM) {
        // Se PM, o review é do AM do mesmo dia
        return `${datePart}-AM`;
    } else {
        // Se AM, o review é do PM do dia anterior
        const currentDate = new Date(`${datePart}T12:00:00Z`); // meio dia UTC
        currentDate.setUTCDate(currentDate.getUTCDate() - 1); // Dia anterior
        const prevYear = currentDate.getUTCFullYear();
        const prevMonth = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
        const prevDay = String(currentDate.getUTCDate()).padStart(2, '0');
        return `${prevYear}-${prevMonth}-${prevDay}-PM`;
    }
}
