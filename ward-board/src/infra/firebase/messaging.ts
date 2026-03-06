/**
 * messaging.ts — Integração FCM (Firebase Cloud Messaging) no frontend.
 *
 * P2-04: Push notifications para escalações críticas.
 *
 * Fluxo:
 *  1. Usuário clica em "Ativar Notificações" no painel admin.
 *  2. Browser solicita permissão (Notification.requestPermission).
 *  3. Se concedida, registra o Service Worker e obtém o FCM token via getToken().
 *  4. Token é salvo em Firestore via FcmTokenRepository.
 *  5. Cloud Function notifyEscalations lê os tokens e envia FCM quando um novo
 *     bloqueio crítico é registrado.
 *
 * REQUISITO DE CONFIGURAÇÃO:
 *   Adicione ao .env (ou .env.local):
 *   VITE_FCM_VAPID_KEY=<sua_chave_VAPID_do_Firebase_Console>
 *   (Firebase Console → Project Settings → Cloud Messaging → Web Push certificates)
 */

import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { getApp } from 'firebase/app';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface FcmRegistrationResult {
    token: string | null;
    permission: NotificationPermissionState;
    error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVapidKey(): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (import.meta as any).env?.VITE_FCM_VAPID_KEY as string | undefined;
}

/**
 * Verifica se FCM é suportado neste browser e contexto (HTTPS obrigatório).
 */
export async function isFcmSupported(): Promise<boolean> {
    try {
        return await isSupported();
    } catch {
        return false;
    }
}

/**
 * Retorna o estado atual da permissão de notificação do browser.
 */
export function currentPermissionState(): NotificationPermissionState {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission as NotificationPermissionState;
}

/**
 * Solicita permissão de notificação ao usuário (se ainda não concedida),
 * registra o Service Worker FCM e retorna o token FCM.
 *
 * Retorna null em token se permissão negada ou FCM não suportado.
 * Não lança — todos os erros são capturados e retornados em .error.
 */
export async function requestAndRegisterToken(): Promise<FcmRegistrationResult> {
    try {
        const supported = await isFcmSupported();
        if (!supported) {
            return { token: null, permission: 'unsupported', error: 'FCM não suportado neste browser.' };
        }

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return { token: null, permission: permission as NotificationPermissionState, error: 'Permissão negada.' };
        }

        // Register service worker explicitly so Vite doesn't intercept /firebase-messaging-sw.js
        let swRegistration: ServiceWorkerRegistration | undefined;
        if ('serviceWorker' in navigator) {
            swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/',
            });
        }

        const messaging = getMessaging(getApp());
        const vapidKey = getVapidKey();

        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: swRegistration,
        });

        return { token: token || null, permission: 'granted' };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { token: null, permission: currentPermissionState(), error: msg };
    }
}

/**
 * Remove o token FCM atual do browser (revoga a inscrição).
 * Deve ser chamado quando o usuário desativa notificações.
 */
export async function revokeCurrentToken(): Promise<boolean> {
    try {
        const supported = await isFcmSupported();
        if (!supported) return false;
        const messaging = getMessaging(getApp());
        return await deleteToken(messaging);
    } catch {
        return false;
    }
}
