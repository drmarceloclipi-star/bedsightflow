import {
    doc,
    onSnapshot,
    getDoc
} from 'firebase/firestore';
import { db, functions } from '../infra/firebase/config';
import { httpsCallable } from 'firebase/functions';
import type { BoardSettings, BoardScreenConfig } from '../domain/types';

const DEFAULT_SCREENS: BoardScreenConfig[] = [
    { key: 'kanban', label: 'Quadro Kanban', durationSeconds: 15, enabled: true },
    { key: 'kamishibai', label: 'Quadro Kamishibai', durationSeconds: 15, enabled: true },
    { key: 'summary', label: 'Resumo da Unidade', durationSeconds: 10, enabled: true },
];

export const BoardSettingsRepository = {
    listenToSettings(unitId: string, callback: (settings: BoardSettings) => void, onError?: (error: Error) => void) {
        const settingsRef = doc(db, 'units', unitId, 'settings', 'board');

        return onSnapshot(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.data() as BoardSettings);
            } else {
                // Return defaults if not configured
                callback({
                    unitId,
                    rotationEnabled: true,
                    screens: DEFAULT_SCREENS,
                    kanbanBedsPerPage: 18,
                    kamishibaiBedsPerPage: 18,
                    kanbanColumnsPerPage: 1,
                    kamishibaiColumnsPerPage: 1
                });
            }
        }, (error) => {
            console.error("Error listening to board settings:", error);
            if (onError) onError(error);
        });
    },

    async updateSettings(unitId: string, settings: Partial<BoardSettings>, reason: string) {
        const updateFn = httpsCallable(functions, 'updateBoardSettings');
        await updateFn({
            unitId,
            reason,
            settings
        });
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
            screens: DEFAULT_SCREENS,
            kanbanBedsPerPage: 18,
            kamishibaiBedsPerPage: 18,
            kanbanColumnsPerPage: 1,
            kamishibaiColumnsPerPage: 1
        };
    }
};
