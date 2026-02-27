import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    setDoc,
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
            lastUpdate: serverTimestamp()
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
        const promises = beds.map((bed) => {
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
                lastUpdate: serverTimestamp(),
            };
            return setDoc(bedRef, data, { merge: true });
        });
        await Promise.all(promises);
    }
};

