/**
 * FcmTokenRepository.ts
 *
 * P2-04 — Gerencia inscrições FCM por unidade.
 *
 * Schema Firestore:
 *   units/{unitId}/notification_subscribers/{uid}
 *   {
 *     uid: string
 *     tokens: string[]      // FCM registration tokens do device
 *     active: boolean       // false = usuário desativou notificações
 *     addedAt: Timestamp
 *     updatedAt: Timestamp
 *   }
 *
 * Cada usuário pode ter múltiplos tokens (vários dispositivos/browsers).
 * A Cloud Function lê apenas documentos com active === true.
 */

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
} from 'firebase/firestore';
import { db } from '../infra/firebase/config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FcmSubscriberDoc {
    uid: string;
    tokens: string[];
    active: boolean;
    addedAt: unknown;   // Firestore Timestamp
    updatedAt: unknown; // Firestore Timestamp
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class FcmTokenRepository {
    private static ref(unitId: string, uid: string) {
        return doc(db, 'units', unitId, 'notification_subscribers', uid);
    }

    /**
     * Retorna o documento de inscrição do usuário na unidade, ou null se não existir.
     */
    static async getSubscriber(unitId: string, uid: string): Promise<FcmSubscriberDoc | null> {
        const snap = await getDoc(this.ref(unitId, uid));
        return snap.exists() ? (snap.data() as FcmSubscriberDoc) : null;
    }

    /**
     * Adiciona um token FCM à lista do usuário e marca active = true.
     * Cria o documento se não existir.
     * Usa arrayUnion para evitar duplicatas.
     */
    static async addToken(unitId: string, uid: string, token: string): Promise<void> {
        const ref = this.ref(unitId, uid);
        const existing = await getDoc(ref);

        if (!existing.exists()) {
            await setDoc(ref, {
                uid,
                tokens: [token],
                active: true,
                addedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        } else {
            await updateDoc(ref, {
                tokens: arrayUnion(token),
                active: true,
                updatedAt: serverTimestamp(),
            });
        }
    }

    /**
     * Remove um token específico da lista do usuário.
     * Se a lista ficar vazia, mantém o documento mas define active = false.
     */
    static async removeToken(unitId: string, uid: string, token: string): Promise<void> {
        const ref = this.ref(unitId, uid);
        const existing = await getDoc(ref);
        if (!existing.exists()) return;

        const data = existing.data() as FcmSubscriberDoc;
        const remainingTokens = (data.tokens ?? []).filter(t => t !== token);

        await updateDoc(ref, {
            tokens: arrayRemove(token),
            active: remainingTokens.length > 0,
            updatedAt: serverTimestamp(),
        });
    }

    /**
     * Desativa todas as notificações para o usuário nesta unidade (sem remover tokens).
     * Usado quando o usuário clica em "Desativar notificações".
     */
    static async deactivate(unitId: string, uid: string): Promise<void> {
        const ref = this.ref(unitId, uid);
        const existing = await getDoc(ref);
        if (!existing.exists()) return;

        await updateDoc(ref, {
            active: false,
            updatedAt: serverTimestamp(),
        });
    }

    /**
     * Retorna se o usuário está ativamente inscrito para notificações nesta unidade.
     */
    static async isActiveSubscriber(unitId: string, uid: string): Promise<boolean> {
        const sub = await this.getSubscriber(unitId, uid);
        return !!(sub?.active && sub.tokens.length > 0);
    }
}
