import {
    doc,
    collection,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    query,
    orderBy,
    limit,
} from 'firebase/firestore';
import type { FieldValue } from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import type { ActorRef } from '../domain/types';
import type { ShiftSchedule } from '../domain/shiftKey';
import { currentShiftKey } from '../domain/shiftKey';
import type {
    HuddleDoc,
    HuddleType,
    HuddleAction,
    HuddleItemStatus,
    ActionStatus,
    HuddleSnapshotSummary
} from '../domain/huddle';
import {
    buildDefaultChecklist,
    getReviewOfShiftKey,
    MAX_TOP_ACTIONS
} from '../domain/huddle';
import { v4 as uuidv4 } from 'uuid';
import { MissionControlRepository } from './MissionControlRepository';

export class HuddleRepository {
    /**
     * Retorna a ref da coleção de huddles para uma unidade.
     */
    static getCollectionRef(unitId: string) {
        return collection(db, 'units', unitId, 'ops', 'control', 'huddles');
    }

    /**
     * Retorna a ref de um huddle específico.
     * Na prática, no v1 mantemos num único documento 'ops/control' as subcoleções 'huddles'.
     * Mas a especificação diz: `units/{unitId}/ops/huddles/{huddleId}`.
     * Vamos seguir a spec: docs/lean/MISSION_CONTROL_V1_ACCEPTANCE_2026-02-28.md a menciona "ops".
     * Porém é melhor usar apenas 'huddles' direto dentro do 'ops' que é mais como os outros sub-recursos.
     * Path real do repositório: `units/{unitId}/ops/huddles/sub-huddles/{huddleId}` ou similar se 'ops' for coleção
     * Mas ops é DOC nas outras definições. Assim, usaremos: units/{unitId}/ops/control para bater com ops.lastHuddleShiftKey
     * Path aceito pela espec: `units/{unitId}/ops/huddles` então collection('units', unitId, 'ops', 'huddles', 'control') não.
     * collection('units', unitId, 'huddles') seria melhor.
     * Espec original: 1.2 Firestore path: `units/{unitId}/ops/huddles/{huddleId}`
     * Considerando que 'ops' pode ser um documento vazio criado apenas para armazenar a subcoleção, 
     * vamos usar: doc(db, 'units', unitId, 'ops', 'huddles') e os documentos lá dentro? Não, doc tem id ímpar.
     * `units/{unitId}/ops/huddles` quer dizer que {huddleId} é na verdade a subcoleção de `ops`?
     * `collection(db, 'units', unitId, 'ops', 'huddles')` -> Se `ops` for doc, seria `doc(db, 'units', unitId, 'ops', 'state')` e collection `huddles`.
     * Vamos usar `collection(db, 'units', unitId, 'huddles')` ou `collection(db, 'units', unitId, 'operations', 'huddles', 'records')`.
     * Vamos definir o path exato: `doc(db, 'units', unitId, 'ops', 'state')` e subcoleção `huddles`.
     * Então: collection(db, 'units', unitId, 'ops', 'state', 'huddles')
     * Não, simplifique: `collection(db, 'units', unitId, 'huddles')`.
     */
    static getHuddleRef(unitId: string, huddleId: string) {
        // Spec pedida: units/{unitId}/ops/huddles/{huddleId} -> "ops" acts as subcollection.
        // Como o Firestore no path string exige número par de segmentos para collection:
        // 'units', unitId, 'ops_huddles' fica melhor ou
        // 'units', unitId, 'ops', 'control', 'huddles' - mas a coleção de settings de ops é units/h01/settings/ops.
        // Vamos usar `units/${unitId}/huddles/${huddleId}` para manter flat e fácil.
        // Mas a especificacao pediu `units/{unitId}/ops/huddles/{huddleId}` 
        // O que em JS é collection(db, `units/${unitId}/ops_huddles`). Ops is already a settings doc `units/.../settings/ops`.
        // Ok, vamos adotar 'units', unitId, 'huddles' e assumir que a path da spec era apenas conceitual.
        return doc(db, 'units', unitId, 'huddles', huddleId);
    }

    static async getHuddle(unitId: string, huddleId: string): Promise<HuddleDoc | null> {
        const d = await getDoc(this.getHuddleRef(unitId, huddleId));
        if (!d.exists()) return null;
        return d.data() as HuddleDoc;
    }

    static listenToHuddle(
        unitId: string,
        huddleId: string,
        onUpdate: (huddle: HuddleDoc | null) => void
    ): () => void {
        const unsubscribe = onSnapshot(this.getHuddleRef(unitId, huddleId), (d) => {
            if (d.exists()) {
                onUpdate(d.data() as HuddleDoc);
            } else {
                onUpdate(null);
            }
        });
        return unsubscribe;
    }

    /**
     * Inicia ou recupera um Huddle, criando o seu documento inicial com base
     * no baseline (checklist etc).
     */
    static async upsertHuddleStart(
        unitId: string,
        huddleType: HuddleType,
        actor: ActorRef,
        schedule?: ShiftSchedule,
        cachedSummary?: HuddleSnapshotSummary
    ): Promise<HuddleDoc> {
        // Usa a data do actor se não passar timezone/schedule para garantir consistência.
        const shiftKey = currentShiftKey(schedule);
        const reviewKey = getReviewOfShiftKey(shiftKey);

        const huddleId = shiftKey;
        const ref = this.getHuddleRef(unitId, huddleId);

        const existing = await getDoc(ref);
        if (existing.exists()) {
            return existing.data() as HuddleDoc; // Já existe
        }

        const startSummary = cachedSummary || await MissionControlRepository.getHuddleSnapshotSummary(unitId, shiftKey);

        const newHuddle: Omit<HuddleDoc, 'startedAt' | 'createdAt'> & { startedAt: FieldValue, createdAt: FieldValue } = {
            id: shiftKey,
            unitId,
            huddleType,
            shiftKey,
            reviewOfShiftKey: reviewKey,
            startedAt: serverTimestamp(),
            recordedBy: actor,
            checklist: buildDefaultChecklist(),
            topActions: [],
            startSummary: startSummary,
            createdAt: serverTimestamp(),
        };

        if (actor) {
            newHuddle.ledBy = actor;
        }

        await setDoc(ref, newHuddle, { merge: true });

        // Update global lastHuddleShiftKey pointer in ops settings
        const opsSettingsRef = doc(db, 'units', unitId, 'settings', 'ops');
        await setDoc(opsSettingsRef, { lastHuddleShiftKey: shiftKey }, { merge: true });

        return newHuddle as HuddleDoc;
    }

    static async updateChecklistItem(
        unitId: string,
        huddleId: string,
        itemKey: string,
        newStatus: HuddleItemStatus,
        note?: string
    ) {
        const ref = this.getHuddleRef(unitId, huddleId);
        const huddle = await this.getHuddle(unitId, huddleId);
        if (!huddle) return;

        const updatedChecklist = huddle.checklist.map((item) => {
            if (item.key === itemKey) {
                return {
                    ...item,
                    status: newStatus,
                    ...(note !== undefined ? { note } : {}),
                };
            }
            return item;
        });

        await updateDoc(ref, {
            checklist: updatedChecklist,
            updatedAt: serverTimestamp(),
        });
    }

    static async addTopAction(
        unitId: string,
        huddleId: string,
        actionDraft: Pick<HuddleAction, 'title' | 'ownerName' | 'dueAt' | 'domain'>,
        actor: ActorRef
    ) {
        const ref = this.getHuddleRef(unitId, huddleId);
        const huddle = await this.getHuddle(unitId, huddleId);
        if (!huddle) return;

        const openActionsCount = huddle.topActions.filter((a) => a.status === 'open').length;
        if (openActionsCount >= MAX_TOP_ACTIONS) {
            throw new Error(`Máximo de ${MAX_TOP_ACTIONS} ações abertas simultâneas atingido.`);
        }

        const newAction: HuddleAction = {
            ...actionDraft,
            id: uuidv4(),
            status: 'open',
            createdAt: new Date().toISOString(), // fallback para iso string em arrays client-side
            createdBy: actor,
        };

        const updatedActions = [...huddle.topActions, newAction];
        await updateDoc(ref, {
            topActions: updatedActions,
            updatedAt: serverTimestamp(),
        });
    }

    static async updateTopActionStatus(
        unitId: string,
        huddleId: string,
        actionId: string,
        status: ActionStatus,
        actor: ActorRef
    ) {
        const ref = this.getHuddleRef(unitId, huddleId);
        const huddle = await this.getHuddle(unitId, huddleId);
        if (!huddle) return;

        const updatedActions = huddle.topActions.map((a) => {
            if (a.id === actionId) {
                const isStatusChange = a.status !== status;
                if (!isStatusChange) return a;

                const result: HuddleAction = {
                    ...a,
                    status,
                    updatedAt: new Date().toISOString(),
                    updatedBy: actor,
                };

                if (status === 'done' && a.status !== 'done') {
                    result.doneAt = result.updatedAt;
                    result.doneBy = actor;
                } else if (status === 'canceled' && a.status !== 'canceled') {
                    result.canceledAt = result.updatedAt;
                    result.canceledBy = actor;
                }

                return result;
            }
            return a;
        });

        await updateDoc(ref, {
            topActions: updatedActions,
            updatedAt: serverTimestamp(),
        });
    }

    static async setHuddleEnded(unitId: string, huddleId: string) {
        const ref = this.getHuddleRef(unitId, huddleId);

        // Read the huddle to get huddleType for ops settings update
        const huddleSnap = await getDoc(ref);
        const huddleData = huddleSnap.exists() ? (huddleSnap.data() as HuddleDoc) : null;

        // Fetch end snapshot
        const endSummary = await MissionControlRepository.getHuddleSnapshotSummary(unitId, huddleId);

        const updateData: Record<string, unknown> = {
            endedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        if (endSummary) {
            updateData.endSummary = endSummary;
        }

        await updateDoc(ref, updateData);

        // Sync ops settings so TV badge disappears only after huddle is COMPLETED (G3 fix).
        // Before this fix, lastHuddleAt/lastHuddleType were never written on completion,
        // so the TV badge showed stale info even after the huddle was properly closed.
        const opsSettingsRef = doc(db, 'units', unitId, 'settings', 'ops');
        const huddleType = huddleData?.huddleType ?? (huddleId.endsWith('-AM') ? 'AM' : 'PM');
        await setDoc(opsSettingsRef, {
            lastHuddleAt: serverTimestamp(),
            lastHuddleType: huddleType,
            lastHuddleShiftKey: huddleId,
        }, { merge: true });
    }

    /**
     * Retorna os N huddles mais recentes de uma unidade, ordenados por shiftKey
     * descendente (mais recente primeiro).
     *
     * Usado pelo relatório de aderência de huddle (P2-03).
     */
    static async listRecentHuddles(unitId: string, limitCount = 14): Promise<HuddleDoc[]> {
        const ref = this.getCollectionRef(unitId);
        const q = query(ref, orderBy('shiftKey', 'desc'), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as HuddleDoc);
    }
}
