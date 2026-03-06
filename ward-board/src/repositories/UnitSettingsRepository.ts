import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import type { UnitOpsSettings, KanbanMode, ActorRef } from '../domain/types';
import { DEFAULT_SHIFT_SCHEDULE, computeShiftKey, type ShiftSchedule } from '../domain/shiftKey';
import { parseMissionControlThresholds, type MissionControlThresholds } from '../domain/missionControl';

// ── Parsers ────────────────────────────────────────────────────────────────────

const parseKanbanMode = (raw: unknown): KanbanMode =>
    raw === 'ACTIVE_LITE' ? 'ACTIVE_LITE' : 'PASSIVE';

/**
 * Extrai kamishibaiEnabled do doc Firestore.
 * Ausente → true (compat v0 — Kamishibai ativo por padrão).
 */
const parseKamishibaiEnabled = (raw: unknown): boolean =>
    typeof raw === 'boolean' ? raw : true;

/**
 * Extrai huddleSchedule do doc Firestore.
 * Ausente → DEFAULT_SHIFT_SCHEDULE { amStart: '07:00', pmStart: '19:00' }.
 */
const parseHuddleSchedule = (raw: unknown): ShiftSchedule => {
    if (
        raw !== null &&
        typeof raw === 'object' &&
        'amStart' in (raw as object) &&
        'pmStart' in (raw as object)
    ) {
        const r = raw as Record<string, unknown>;
        return {
            amStart: typeof r.amStart === 'string' ? r.amStart : DEFAULT_SHIFT_SCHEDULE.amStart,
            pmStart: typeof r.pmStart === 'string' ? r.pmStart : DEFAULT_SHIFT_SCHEDULE.pmStart,
        };
    }
    return DEFAULT_SHIFT_SCHEDULE;
};

/**
 * Mapeia doc Firestore para UnitOpsSettings com defaults v1.
 */
function parseOpsSettings(data: Record<string, unknown>): UnitOpsSettings {
    return {
        kanbanMode: parseKanbanMode(data.kanbanMode),
        kamishibaiEnabled: parseKamishibaiEnabled(data.kamishibaiEnabled),
        huddleSchedule: parseHuddleSchedule(data.huddleSchedule),
        lastHuddleAt: (data.lastHuddleAt as UnitOpsSettings['lastHuddleAt']) ?? undefined,
        lastHuddleType: (data.lastHuddleType as 'AM' | 'PM') ?? undefined,
        lastHuddleShiftKey: typeof data.lastHuddleShiftKey === 'string' ? data.lastHuddleShiftKey : undefined,
        lastHuddleRegisteredBy: (data.lastHuddleRegisteredBy as ActorRef) ?? undefined,
        lswGraceMinutes: typeof data.lswGraceMinutes === 'number' ? data.lswGraceMinutes : undefined,
    };
}

/** Fallback de segurança quando o doc ops não existe. */
const DEFAULT_OPS_SETTINGS: UnitOpsSettings = {
    kanbanMode: 'PASSIVE',
    kamishibaiEnabled: true,
    huddleSchedule: DEFAULT_SHIFT_SCHEDULE,
};

// ── Repository ────────────────────────────────────────────────────────────────

export const UnitSettingsRepository = {
    async getUnitOpsSettings(unitId: string): Promise<UnitOpsSettings> {
        const opsRef = doc(db, 'units', unitId, 'settings', 'ops');
        try {
            const docSnap = await getDoc(opsRef);
            if (docSnap.exists()) {
                return parseOpsSettings(docSnap.data() as Record<string, unknown>);
            }
        } catch (error) {
            console.error('Error fetching unit ops settings:', error);
        }
        return DEFAULT_OPS_SETTINGS;
    },

    subscribeUnitOpsSettings(
        unitId: string,
        callback: (settings: UnitOpsSettings) => void
    ): () => void {
        const opsRef = doc(db, 'units', unitId, 'settings', 'ops');
        return onSnapshot(
            opsRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    callback(parseOpsSettings(docSnap.data() as Record<string, unknown>));
                } else {
                    callback(DEFAULT_OPS_SETTINGS);
                }
            },
            (error) => {
                console.error('Error listening to unit ops settings:', error);
                callback(DEFAULT_OPS_SETTINGS);
            }
        );
    },

    async setUnitKanbanMode(
        unitId: string,
        kanbanMode: KanbanMode,
        actor: { uid: string; email: string; displayName?: string }
    ): Promise<void> {
        const opsRef = doc(db, 'units', unitId, 'settings', 'ops');
        await setDoc(
            opsRef,
            { kanbanMode, updatedAt: serverTimestamp(), updatedBy: actor },
            { merge: true }
        );
    },

    // ── v1 — Kamishibai policy ────────────────────────────────────────────────

    /**
     * Liga ou desliga o Kamishibai como ferramenta operacional da unidade.
     * Não altera settings/board (display permanece inalterado).
     */
    async setKamishibaiEnabled(
        unitId: string,
        enabled: boolean,
        actor: { uid: string; email: string; displayName?: string }
    ): Promise<void> {
        const opsRef = doc(db, 'units', unitId, 'settings', 'ops');
        await setDoc(
            opsRef,
            { kamishibaiEnabled: enabled, updatedAt: serverTimestamp(), updatedBy: actor },
            { merge: true }
        );
    },

    // ── v1 — Huddle registration ──────────────────────────────────────────────

    /**
     * Registra que o huddle do turno atual foi realizado.
     * Grava: lastHuddleAt, lastHuddleType, lastHuddleShiftKey, lastHuddleRegisteredBy.
     * Ref: LEAN_CONTRACT_HRHDS §5.2 e LEAN_SHIFTKEY_SPEC_HRHDS §5.2
     */
    async registerHuddle(
        unitId: string,
        huddleType: 'AM' | 'PM',
        actor: ActorRef,
        schedule?: ShiftSchedule
    ): Promise<void> {
        const opsRef = doc(db, 'units', unitId, 'settings', 'ops');
        const now = new Date();
        const shiftKey = computeShiftKey(now, schedule ?? DEFAULT_SHIFT_SCHEDULE);
        await setDoc(
            opsRef,
            {
                lastHuddleAt: serverTimestamp(),
                lastHuddleType: huddleType,
                lastHuddleShiftKey: shiftKey,
                lastHuddleRegisteredBy: actor,
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    },

    // ── v1 — Mission Control thresholds ──────────────────────────────────────

    /**
     * Subscribes to the unit's mission_control settings document.
     * Invokes callback with parsed thresholds (merged with defaults) on every change.
     * Falls back to DEFAULT_MISSION_CONTROL_THRESHOLDS when the document doesn't exist.
     */
    subscribeMissionControlSettings(
        unitId: string,
        callback: (thresholds: MissionControlThresholds) => void
    ): () => void {
        const ref = doc(db, 'units', unitId, 'settings', 'mission_control');
        return onSnapshot(
            ref,
            (docSnap) => {
                callback(parseMissionControlThresholds(docSnap.exists() ? docSnap.data() : undefined));
            },
            (error) => {
                console.error('Error listening to mission_control settings:', error);
            }
        );
    },
};
