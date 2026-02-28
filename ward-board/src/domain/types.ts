import type { Timestamp } from 'firebase/firestore';
import type { ShiftSchedule } from './shiftKey';

// ─────────────────────────────────────────────────────────────────────────────
// Utility type alias
// ─────────────────────────────────────────────────────────────────────────────

/** Aceita tanto string ISO quanto Firestore Timestamp. */
export type TimestampLike = string | Timestamp;

// ─────────────────────────────────────────────────────────────────────────────
// Discharge
// ─────────────────────────────────────────────────────────────────────────────

export type DischargeEstimate = '24h' | '2-3_days' | '>3_days' | 'later';

export const DischargeEstimateLabel: Record<DischargeEstimate, string> = {
    '24h': '< 24h',
    '2-3_days': '2-3 dias',
    '>3_days': '> 3 dias',
    'later': 'Indefinida',
};

// ─────────────────────────────────────────────────────────────────────────────
// Kamishibai Status
//
// v1 armazena APENAS 'ok' | 'blocked'.
// 'na' continua aceito na LEITURA de documentos legados (v0).
// LegacyKamishibaiStatus é usado onde precisamos ler Firestore sem quebrar.
// NÃO usar LegacyKamishibaiStatus em novos writes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Status armazenado em documentos v1 (novos writes).
 * Contrato: LEAN_CONTRACT_HRHDS §4.2
 */
export type KamishibaiStatus = 'ok' | 'blocked';

/**
 * Status lido de documentos v0 (legado).
 * Usar apenas em leitura e no lógica de migração.
 * Ref: LEAN_MIGRATION_MAP_v0_to_v1 §2
 */
export type LegacyKamishibaiStatus = 'ok' | 'blocked' | 'na';

// ─────────────────────────────────────────────────────────────────────────────
// Estados visuais derivados (nunca armazenados)
// Ref: LEAN_STATE_MACHINE_HRHDS §2 e LEAN_SHIFTKEY_SPEC_HRHDS §6
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado visual do domínio Kamishibai — computado em runtime, nunca gravado.
 */
export type KamishibaiVisualState =
    | 'INACTIVE'             // leito vazio OU kamishibaiEnabled=false
    | 'NOT_APPLICABLE'       // domínio não se aplica ao caso (applicableDomains)
    | 'UNREVIEWED_THIS_SHIFT' // aplicável, mas não revisado no turno atual
    | 'OK'                   // revisado neste turno, sem impedimento
    | 'BLOCKED';             // impedimento ativo (persiste entre turnos)

// ─────────────────────────────────────────────────────────────────────────────
// SpecialtyKey
// ─────────────────────────────────────────────────────────────────────────────

export type SpecialtyKey =
    // Clínicas
    | 'cardio' | 'medical' | 'palliative' | 'gastro' | 'infecto' | 'nephro' | 'neuro' | 'pneumo' | 'psych' | 'endo' | 'intensive' | 'radio'
    // Cirúrgicas
    | 'head_neck' | 'bariatric' | 'cvs' | 'maxilo' | 'general_surgery' | 'vascular' | 'plastic' | 'thoracic' | 'obgyn' | 'urology' | 'digestive'
    // Multiprofissional (Kamishibai domains)
    | 'nursing' | 'physio' | 'nutrition' | 'social' | 'psychology';

export const SpecialtyLabel: Record<SpecialtyKey, string> = {
    // Clínicas
    cardio: 'Cardiologia',
    medical: 'Equipe Médica',
    palliative: 'Cuidados Paliativos',
    gastro: 'Gastroenterologia',
    infecto: 'Infectologia',
    nephro: 'Nefrologia',
    neuro: 'Neurologia',
    pneumo: 'Pneumologia',
    psych: 'Psiquiatria',
    endo: 'Endocrinologia',
    intensive: 'Medicina Intensiva',
    radio: 'Radiologia',
    // Cirúrgicas
    head_neck: 'Cabeça e Pescoço',
    bariatric: 'Cirurgia Bariátrica',
    cvs: 'Cirurgia Cardiovascular',
    maxilo: 'Buco-maxilo',
    general_surgery: 'Cirurgia Geral',
    vascular: 'Cirurgia Vascular',
    plastic: 'Cirurgia Plástica',
    thoracic: 'Cirurgia Torácica',
    obgyn: 'Ginecologia e Obstetrícia',
    urology: 'Urologia',
    digestive: 'Aparelho Digestivo',
    // Multiprofissional
    nursing: 'Enfermagem',
    physio: 'Fisioterapia',
    nutrition: 'Nutrição',
    social: 'Serviço Social',
    psychology: 'Psicologia',
};

// ─────────────────────────────────────────────────────────────────────────────
// ActorRef
// ─────────────────────────────────────────────────────────────────────────────

export interface ActorRef {
    id: string;
    name: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// KamishibaiEntry — v1
//
// Campos novos de v1 são todos opcionais para garantir compat com docs v0.
// Ref: LEAN_SHIFTKEY_SPEC_HRHDS §5.1, LEAN_STATE_MACHINE_HRHDS §4
// ─────────────────────────────────────────────────────────────────────────────

export interface KamishibaiEntry {
    /**
     * Status armazenado.
     * v1: 'ok' | 'blocked' apenas.
     * Leitura de docs v0 pode conter 'na' — tratar como LegacyKamishibaiStatus.
     */
    status: LegacyKamishibaiStatus; // aceita 'na' na leitura (legado), v1 não grava mais 'na'

    updatedAt: TimestampLike;
    updatedBy?: ActorRef;
    note?: string;

    // ── v1 — TTL de turno ──────────────────────────────────────────────────
    /**
     * shiftKey do turno em que o domínio foi revisado.
     * Formato: "YYYY-MM-DD-AM" | "YYYY-MM-DD-PM"
     * Ausente em docs v0 → tratar como UNREVIEWED_THIS_SHIFT.
     */
    reviewedShiftKey?: string;

    /** Timestamp exato da revisão no turno. */
    reviewedAt?: TimestampLike;

    // ── v1 — Histórico de bloqueio por domínio ─────────────────────────────
    /**
     * Quando o status 'blocked' foi declarado pela primeira vez para este domínio.
     * NÃO é sobrescrito em updates subsequentes do mesmo bloqueio.
     * Ausente em docs v0 → usar updatedAt como proxy com aviso.
     */
    blockedAt?: TimestampLike;

    /** Quando o bloqueio foi resolvido (SET_OK após BLOCKED). */
    resolvedAt?: TimestampLike;

    /** Motivo mínimo do bloqueio (campo livre). Opcional em v1. */
    reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pendency — v1
//
// Pendências operacionais por leito. Persistem entre turnos.
// Independentes de mainBlocker e de Kamishibai.
//
// Status:
//   open     → pendência ativa (default)
//   done     → concluída (imutável no v1)
//   canceled → cancelada com rastreio (não é delete) — preserva evidência
//
// Ref: PENDENCIES_V1_ACCEPTANCE_2026-02-28.md | PERMISSIONS_NOTE.md
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Status persistido da pendência.
 * 'canceled' substitui delete para editores — preserva trilha de auditoria.
 * Deletar físico (possível via `deletePendency`) é exclusivo de admin.
 */
export type PendencyStatus = 'open' | 'done' | 'canceled';

export interface Pendency {
    /** UUID gerado no client (crypto.randomUUID) */
    id: string;

    /** Título curto e objetivo (obrigatório) */
    title: string;

    /**
     * Domínio responsável (opcional).
     * Decisão D2: sem `owner` obrigatório em v1 — domain + createdBy suficientes.
     */
    domain?: SpecialtyKey;

    /** Texto livre para contexto adicional */
    note?: string;

    // ── Prazo ──────────────────────────────────────────────────────────────
    /**
     * Prazo (opcional). Decisão D4: ausência = open sem badge de SLA.
     * Overdue (D3) = dueAt < now && status === 'open'.
     */
    dueAt?: TimestampLike;

    // ── Criação ────────────────────────────────────────────────────────────
    status: PendencyStatus;
    createdAt: TimestampLike;
    createdBy: ActorRef;

    // ── Atualizações (governança) ──────────────────────────────────────────
    /** Última modificação (qualquer transição de status ou edição) */
    updatedAt?: TimestampLike;
    /** Ator que fez a última modificação */
    updatedBy?: ActorRef;

    // ── Conclusão ──────────────────────────────────────────────────────────
    doneAt?: TimestampLike;
    doneBy?: ActorRef;

    // ── Cancelamento ───────────────────────────────────────────────────────
    /** Quando foi cancelada (preserva evidência; não é delete) */
    canceledAt?: TimestampLike;
    /** Quem cancelou */
    canceledBy?: ActorRef;
}


// ─────────────────────────────────────────────────────────────────────────────
// Bed — v1
// ─────────────────────────────────────────────────────────────────────────────

export interface Bed {
    id: string;
    unitId: string;
    number: string;         // Ex: 301.1
    patientAlias?: string;  // Nome social/iniciais. '' ou ausente = leito vazio.
    expectedDischarge: DischargeEstimate;
    mainBlocker: string;    // Bloqueador principal do leito (Kanban KPI1)
    involvedSpecialties: SpecialtyKey[];
    kamishibai: Record<SpecialtyKey, KamishibaiEntry>;
    updatedAt?: TimestampLike;
    updatedBy?: {
        uid: string;
        email: string;
        displayName?: string;
    };

    // ── v1 — N/A Variante A ────────────────────────────────────────────────
    /**
     * Domínios Kamishibai que SE APLICAM ao paciente deste leito.
     * Ausência do campo → todos os KAMISHIBAI_DOMAINS são considerados aplicáveis.
     * Ref: LEAN_MIGRATION_MAP §3 Variante A.
     */
    applicableDomains?: SpecialtyKey[];

    // ── v1 — Aging do mainBlocker (separado do Kamishibai) ────────────────
    /**
     * Quando mainBlocker foi preenchido pela primeira vez para o paciente atual.
     * Usado para calcular aging em Mission Control KPI1 (bloqueados agora).
     * NÃO é sobrescrito ao editar mainBlocker se já existia.
     * Ausente em docs v0 → usar updatedAt como proxy.
     */
    mainBlockerBlockedAt?: TimestampLike;

    /**
     * Quando mainBlocker foi resolvido (voltou a '').
     * Opcional, para histórico.
     */
    mainBlockerResolvedAt?: TimestampLike;

    // ── v1 — Pendências operacionais ──────────────────────────────────────
    /**
     * Lista de pendências operacionais do leito.
     * Persistem entre turnos. Independentes de Kamishibai e mainBlocker.
     * Ref: PENDENCIES_V1_ACCEPTANCE_2026-02-28.md
     */
    pendencies?: Pendency[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit
// ─────────────────────────────────────────────────────────────────────────────

export interface Unit {
    id: string;
    name: string;
    totalBeds: number;
    specialties: SpecialtyKey[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Board (Display) Settings — settings/board
// ─────────────────────────────────────────────────────────────────────────────

export type BoardScreenKey = 'kanban' | 'kamishibai' | 'summary';

export interface BoardScreenConfig {
    key: BoardScreenKey;
    label: string;
    durationSeconds: number;
    enabled: boolean;
}

export interface BoardSettings {
    unitId: string;
    rotationEnabled: boolean;
    screens: BoardScreenConfig[];
    kanbanBedsPerPage: number;
    kanbanColumnsPerPage?: number;
    kamishibaiBedsPerPage: number;
    kamishibaiColumnsPerPage?: number;
    updatedAt?: TimestampLike;
    updatedBy?: {
        uid: string;
        email: string;
        displayName?: string;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

export interface SummaryMetrics {
    activePatients: number;
    discharges24h: number;
    withBlockers: number;
    /** v1.5: contagem de pendências abertas da unidade (somente leitos ativos) */
    pendenciesOpen: number;
    /** v1.5: contagem de pendências abertas vencidas (dueAt < now) */
    pendenciesOverdue: number;
}


// ─────────────────────────────────────────────────────────────────────────────
// RBAC
// ─────────────────────────────────────────────────────────────────────────────

export type UnitRole = 'admin' | 'editor' | 'viewer';

export interface UnitUserRole {
    id?: string;
    uid?: string;
    email: string;
    displayName?: string;
    role: UnitRole;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    updatedBy?: {
        uid: string;
        email: string;
        displayName?: string;
    };
}

export type AdminTab = 'tv' | 'beds' | 'users' | 'ops' | 'audit' | 'analytics';

// ─────────────────────────────────────────────────────────────────────────────
// Operational Settings — settings/ops
//
// Separação: settings/board = display | settings/ops = política Lean
// Ref: LEAN_CONTRACT_HRHDS §6
// ─────────────────────────────────────────────────────────────────────────────

export type KanbanMode = 'PASSIVE' | 'ACTIVE_LITE';

export interface UnitOpsSettings {
    /** Modo Kanban (v0). Continua obrigatório. */
    kanbanMode: KanbanMode;

    // ── v1 — Política Kamishibai ───────────────────────────────────────────
    /**
     * Kamishibai habilitado como ferramenta operacional na unidade.
     * Ausente → tratar como true (compat v0).
     * FALSE: oculta TODOS os semáforos/dots (TV, Editor, Mission Control).
     */
    kamishibaiEnabled?: boolean;

    // ── v1 — Configuração de turno ────────────────────────────────────────
    /**
     * Horários de início dos turnos AM/PM.
     * Ausente → usar DEFAULT_SHIFT_SCHEDULE { amStart: '07:00', pmStart: '19:00' }.
     */
    huddleSchedule?: ShiftSchedule;

    // ── v1 — Registro do último huddle ────────────────────────────────────
    /** Timestamp do último huddle registrado na unidade. */
    lastHuddleAt?: TimestampLike;
    /** Tipo do último huddle ('AM' | 'PM'). */
    lastHuddleType?: 'AM' | 'PM';
    /**
     * shiftKey do turno em que o huddle foi registrado.
     * Comparado com currentShiftKey() para saber se "Huddle Pendente".
     */
    lastHuddleShiftKey?: string;
    /** Quem registrou o huddle. */
    lastHuddleRegisteredBy?: ActorRef;

    // ── v1 — Reservado (não usar ainda) ──────────────────────────────────
    /** Turno ativo explicitamente confirmado pelo admin. Reservado. */
    currentShiftType?: 'AM' | 'PM';
}
