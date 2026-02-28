import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    Timestamp
} from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import { ADMIN_EMAILS } from '../config/admins';

export interface AuthorizedUser {
    id: string;
    email: string;
    addedAt: Date;
}

const COLLECTION_NAME = 'authorized_users';

export const authorizedUsersRepository = {
    async isAuthorized(email: string): Promise<boolean> {
        // The admins are always authorized
        if (ADMIN_EMAILS.includes(email.toLowerCase())) return true;

        const q = query(collection(db, COLLECTION_NAME), where('email', '==', email.toLowerCase()));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    },

    async getAll(): Promise<AuthorizedUser[]> {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        return querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                email: data.email,
                addedAt: data.addedAt && typeof data.addedAt.toDate === 'function'
                    ? data.addedAt.toDate()
                    : new Date(data.addedAt || Date.now())
            };
        });
    },

    async add(email: string): Promise<void> {
        const normalizedEmail = email.toLowerCase().trim();
        const alreadyExists = await this.isAuthorized(normalizedEmail);

        if (!alreadyExists) {
            await addDoc(collection(db, COLLECTION_NAME), {
                email: normalizedEmail,
                addedAt: Timestamp.now()
            });
        }
    },

    async remove(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
};
