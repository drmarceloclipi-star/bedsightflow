import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import type { Bed } from '../domain/types';

export const BedsRepository = {
    listenToBeds(unitId: string, callback: (beds: Bed[]) => void, onError?: (error: Error) => void) {
        const q = query(
            collection(db, 'units', unitId, 'beds'),
            orderBy('number', 'asc')
        );

        return onSnapshot(q, (snapshot) => {
            const beds = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Bed[];
            callback(beds);
        }, (error) => {
            console.error("Error listening to beds:", error);
            if (onError) onError(error);
        });
    },

    listenToBed(unitId: string, bedId: string, callback: (bed: Bed | null) => void) {
        const bedRef = doc(db, 'units', unitId, 'beds', bedId);

        return onSnapshot(bedRef, (snapshot) => {
            if (snapshot.exists()) {
                callback({ id: snapshot.id, ...snapshot.data() } as Bed);
            } else {
                callback(null);
            }
        }, (error) => {
            console.error("Error listening to single bed:", error);
        });
    },

    async updateBed(
        unitId: string,
        bedId: string,
        data: Partial<Bed>,
        actor?: { uid: string; email: string; displayName?: string; role: string }
    ) {
        const bedRef = doc(db, 'units', unitId, 'beds', bedId);
        const cleanData = { ...data } as Record<string, unknown>;
        delete cleanData.id;
        delete cleanData.unitId;
        await updateDoc(bedRef, {
            ...cleanData,
            updatedBy: actor ?? null,
            updatedAt: serverTimestamp()
        });
    },


    async listBeds(unitId: string): Promise<Bed[]> {
        const q = query(
            collection(db, 'units', unitId, 'beds'),
            orderBy('number', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Bed[];
    },

    async bulkUpsertBeds(unitId: string, beds: Partial<Bed>[]): Promise<void> {
        const { writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);

        beds.forEach((bed) => {
            const bedId = bed.number!;
            const bedRef = doc(db, 'units', unitId, 'beds', bedId);
            const data = {
                unitId,
                number: bed.number!,
                patientAlias: bed.patientAlias ?? '',
                expectedDischarge: bed.expectedDischarge ?? '2-3_days',
                mainBlocker: bed.mainBlocker ?? '',
                involvedSpecialties: bed.involvedSpecialties ?? ['medical'],
                kamishibai: bed.kamishibai ?? {},
                updatedAt: serverTimestamp(),
            };
            batch.set(bedRef, data, { merge: true });
        });

        await batch.commit();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Pendências v1 — CRUD seguro
    //
    // Política (Ref: PERMISSIONS_NOTE.md):
    //   adicionar / marcar done / cancelar → qualquer editor autenticado
    //   deletar fisicamente               → exclusivo de admin (UI não expõe para editor)
    //
    // Concorrência: markPendencyDone e cancelPendency usam runTransaction
    // para garantir atomicidade (leitura + escrita num único commit).
    // addPendency usa arrayUnion (safe para múltiplos escritores simultâneos).
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Adiciona uma pendência à lista do leito.
     * Usa arrayUnion — seguro para concorrência multi-usuário.
     * O objeto pendency deve ter id gerado pelo client (crypto.randomUUID).
     */
    async addPendency(
        unitId: string,
        bedId: string,
        pendency: import('../domain/types').Pendency
    ): Promise<void> {
        const { arrayUnion } = await import('firebase/firestore');
        const bedRef = doc(db, 'units', unitId, 'beds', bedId);
        await updateDoc(bedRef, {
            pendencies: arrayUnion(pendency),
            updatedAt: serverTimestamp(),
        });
    },

    /**
     * Marca uma pendência como done.
     * Usa runTransaction para atomicidade (read-then-write seguro).
     * Registra doneAt, doneBy, updatedAt, updatedBy.
     * Não permite transição done → open no v1.
     */
    async markPendencyDone(
        unitId: string,
        bedId: string,
        pendencyId: string,
        actor: import('../domain/types').ActorRef
    ): Promise<void> {
        const { runTransaction } = await import('firebase/firestore');
        const bedRef = doc(db, 'units', unitId, 'beds', bedId);
        const now = new Date().toISOString();
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(bedRef);
            if (!snap.exists()) throw new Error(`Bed ${bedId} not found`);
            const bed = snap.data() as import('../domain/types').Bed;
            const pendencies = (bed.pendencies ?? []).map(p =>
                p.id === pendencyId
                    ? {
                        ...p,
                        status: 'done' as import('../domain/types').PendencyStatus,
                        doneAt: now,
                        doneBy: actor,
                        updatedAt: now,
                        updatedBy: actor,
                    }
                    : p
            );
            tx.update(bedRef, { pendencies, updatedAt: serverTimestamp() });
        });
    },

    /**
     * Cancela uma pendência (status='canceled').
     * Usa runTransaction para atomicidade.
     * Preserva evidência — não remove o item do array.
     * Disponível para qualquer editor (diferente de deletePendency).
     */
    async cancelPendency(
        unitId: string,
        bedId: string,
        pendencyId: string,
        actor: import('../domain/types').ActorRef
    ): Promise<void> {
        const { runTransaction } = await import('firebase/firestore');
        const bedRef = doc(db, 'units', unitId, 'beds', bedId);
        const now = new Date().toISOString();
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(bedRef);
            if (!snap.exists()) throw new Error(`Bed ${bedId} not found`);
            const bed = snap.data() as import('../domain/types').Bed;
            const pendencies = (bed.pendencies ?? []).map(p =>
                p.id === pendencyId
                    ? {
                        ...p,
                        status: 'canceled' as import('../domain/types').PendencyStatus,
                        canceledAt: now,
                        canceledBy: actor,
                        updatedAt: now,
                        updatedBy: actor,
                    }
                    : p
            );
            tx.update(bedRef, { pendencies, updatedAt: serverTimestamp() });
        });
    },

    /**
     * Remove fisicamente uma pendência do array.
     * RESTRIÇÃO: exclusivo de admin — a UI não deve expor este botão para editor.
     * Para auditoria, prefira cancelPendency.
     */
    async deletePendency(
        unitId: string,
        bedId: string,
        pendencyId: string,
        actor: import('../domain/types').ActorRef
    ): Promise<void> {
        const { runTransaction } = await import('firebase/firestore');
        const bedRef = doc(db, 'units', unitId, 'beds', bedId);
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(bedRef);
            if (!snap.exists()) throw new Error(`Bed ${bedId} not found`);
            const bed = snap.data() as import('../domain/types').Bed;
            const pendencies = (bed.pendencies ?? []).filter(p => p.id !== pendencyId);
            // Log de auditoria (não gravado no Firestore, mas disponível em console)
            console.info('[deletePendency] admin delete by', actor.id, 'pendencyId:', pendencyId);
            tx.update(bedRef, { pendencies, updatedAt: serverTimestamp() });
        });
    },
};


