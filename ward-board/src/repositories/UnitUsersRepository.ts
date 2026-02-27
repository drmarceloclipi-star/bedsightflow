import {
    collection,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import type { UnitUserRole, UnitRole } from '../domain/types';

export const UnitUsersRepository = {
    listenToUsers(unitId: string, callback: (users: UnitUserRole[]) => void) {
        const col = collection(db, 'units', unitId, 'users');
        return onSnapshot(col, (snapshot) => {
            const users = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as UnitUserRole[];
            callback(users);
        }, (error) => {
            console.error('Error listening to unit users:', error);
        });
    },

    /**
     * @deprecated NÃO USE — grava diretamente no Firestore sem gerar log de auditoria.
     * Use httpsCallable(functions, 'setUnitUserRole') para operações auditadas.
     */
    async addUser(
        unitId: string,
        email: string,
        role: UnitRole,
        displayName?: string
    ): Promise<void> {
        // Use email hash as doc id for pending users (no uid yet)
        const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const userRef = doc(db, 'units', unitId, 'users', docId);
        await setDoc(userRef, {
            email: email.toLowerCase().trim(),
            displayName: displayName ?? '',
            role,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        }, { merge: false });
    },

    /**
     * @deprecated NÃO USE — grava diretamente no Firestore sem gerar log de auditoria.
     * Use httpsCallable(functions, 'setUnitUserRole') para operações auditadas.
     */
    async updateUserRole(
        unitId: string,
        userId: string,
        role: UnitRole
    ): Promise<void> {
        const userRef = doc(db, 'units', unitId, 'users', userId);
        await setDoc(userRef, {
            role,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    },

    /**
     * @deprecated NÃO USE — grava diretamente no Firestore sem gerar log de auditoria.
     * Use httpsCallable(functions, 'removeUnitUser') para operações auditadas.
     */
    async removeUser(unitId: string, userId: string): Promise<void> {
        const userRef = doc(db, 'units', unitId, 'users', userId);
        await deleteDoc(userRef);
    },
};
