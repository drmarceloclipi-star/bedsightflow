import {
    collection,
    onSnapshot,
    doc,
    getDoc,
    query
} from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import type { Unit } from '../domain/types';

export const UnitsRepository = {
    async getUnit(unitId: string): Promise<Unit | null> {
        const unitRef = doc(db, 'units', unitId);
        const docSnap = await getDoc(unitRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Unit;
        }
        return null;
    },

    listenToUnits(callback: (units: Unit[]) => void) {
        const q = query(collection(db, 'units'));
        return onSnapshot(q, (snapshot) => {
            const units = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Unit[];
            callback(units);
        });
    }
};
