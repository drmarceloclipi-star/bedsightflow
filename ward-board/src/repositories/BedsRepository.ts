import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import type { Bed } from '../domain/types';

export const BedsRepository = {
    listenToBeds(unitId: string, callback: (beds: Bed[]) => void) {
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
        });
    },

    async updateBed(unitId: string, bedId: string, data: Partial<Bed>) {
        const bedRef = doc(db, 'units', unitId, 'beds', bedId);
        const cleanData = { ...data } as Record<string, unknown>;
        delete cleanData.id;
        delete cleanData.unitId;
        await updateDoc(bedRef, {
            ...cleanData,
            lastUpdate: serverTimestamp()
        });
    }
};
