import {
    doc,
    onSnapshot,
    setDoc,
    getDoc
} from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import type { BoardSettings, BoardScreenConfig } from '../domain/types';

const DEFAULT_SCREENS: BoardScreenConfig[] = [
    { key: 'kanban', label: 'Quadro Kanban', durationSeconds: 15, enabled: true },
    { key: 'kamishibai', label: 'Quadro Kamishibai', durationSeconds: 15, enabled: true },
    { key: 'summary', label: 'Resumo da Unidade', durationSeconds: 10, enabled: true },
];

export const BoardSettingsRepository = {
    listenToSettings(unitId: string, callback: (settings: BoardSettings) => void) {
        const settingsRef = doc(db, 'units', unitId, 'settings', 'board');

        return onSnapshot(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.data() as BoardSettings);
            } else {
                // Return defaults if not configured
                callback({
                    unitId,
                    rotationEnabled: true,
                    screens: DEFAULT_SCREENS
                });
            }
        });
    },

    async updateSettings(unitId: string, settings: Partial<BoardSettings>) {
        const settingsRef = doc(db, 'units', unitId, 'settings', 'board');
        await setDoc(settingsRef, settings, { merge: true });
    },

    async getSettings(unitId: string): Promise<BoardSettings> {
        const settingsRef = doc(db, 'units', unitId, 'settings', 'board');
        const docSnap = await getDoc(settingsRef);

        if (docSnap.exists()) {
            return docSnap.data() as BoardSettings;
        }

        return {
            unitId,
            rotationEnabled: true,
            screens: DEFAULT_SCREENS
        };
    }
};
