/**
 * notifyEscalations.ts
 *
 * P2-04 — Envio de push notifications (FCM) para escalações críticas.
 *
 * Trigger: Firestore onWrite em `units/{unitId}/beds/{bedId}`
 *
 * Condições de disparo:
 *   1. Bed tem paciente (patientAlias não vazio)
 *   2. mainBlocker mudou de vazio/ausente → não-vazio (novo bloqueio registrado)
 *
 * A notificação é enviada a todos os assinantes ativos da unidade
 * (docs em `units/{unitId}/notification_subscribers` com active === true).
 *
 * Não re-notifica enquanto o mesmo mainBlocker permanecer inalterado — apenas
 * quando um novo texto de bloqueio é registrado.
 *
 * Schema Firestore subscriber:
 *   units/{unitId}/notification_subscribers/{uid}
 *   { uid, tokens: string[], active: boolean }
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { db } from '../config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FcmSubscriberDoc {
    uid: string;
    tokens: string[];
    active: boolean;
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Coleta todos os tokens FCM de assinantes ativos da unidade.
 * Retorna lista deduplicada (um usuário pode ter múltiplos devices).
 */
async function getActiveTokensForUnit(unitId: string): Promise<string[]> {
    const snap = await db
        .collection('units')
        .doc(unitId)
        .collection('notification_subscribers')
        .where('active', '==', true)
        .get();

    const tokens: string[] = [];
    for (const doc of snap.docs) {
        const data = doc.data() as FcmSubscriberDoc;
        if (Array.isArray(data.tokens)) {
            for (const t of data.tokens) {
                if (t && !tokens.includes(t)) {
                    tokens.push(t);
                }
            }
        }
    }
    return tokens;
}

// ── Trigger ───────────────────────────────────────────────────────────────────

export const notifyEscalations = functions
    .region('southamerica-east1')
    .firestore.document('units/{unitId}/beds/{bedId}')
    .onWrite(async (change, context) => {
        const { unitId, bedId } = context.params;

        const before = change.before.data();
        const after = change.after.data();

        // Ignorar deleções
        if (!after) return null;

        // Ignorar leitos sem paciente
        if (!after.patientAlias || String(after.patientAlias).trim() === '') return null;

        const beforeBlocker = (before?.mainBlocker as string | undefined)?.trim() ?? '';
        const afterBlocker = (after.mainBlocker as string | undefined)?.trim() ?? '';

        // Só notifica quando mainBlocker passa de vazio → não vazio (novo bloqueio)
        if (beforeBlocker !== '' || afterBlocker === '') return null;

        // Coletar tokens ativos da unidade
        const tokens = await getActiveTokensForUnit(unitId);
        if (tokens.length === 0) return null;

        const bedNumber = (after.number as string | undefined) ?? bedId;
        const patientAlias = String(after.patientAlias).trim();

        const message: admin.messaging.MulticastMessage = {
            tokens,
            notification: {
                title: `🚨 Bloqueio — Leito ${bedNumber}`,
                body: `${patientAlias}: ${afterBlocker}`,
            },
            data: {
                unitId,
                bedId,
                bedNumber,
                type: 'NEW_BLOCKER',
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'bedsight_escalations',
                    priority: 'high',
                },
            },
            webpush: {
                headers: { Urgency: 'high' },
                notification: {
                    requireInteraction: true,
                    icon: '/android-chrome-192x192.png',
                    badge: '/favicon-32x32.png',
                    tag: `blocker-${unitId}-${bedId}`,
                },
            },
        };

        try {
            const response = await admin.messaging().sendEachForMulticast(message);

            // Limpar tokens inválidos (expirados / desinstalados)
            if (response.failureCount > 0) {
                const invalidTokens: string[] = [];
                response.responses.forEach((res, idx) => {
                    if (!res.success) {
                        const code = res.error?.code;
                        if (
                            code === 'messaging/registration-token-not-registered' ||
                            code === 'messaging/invalid-registration-token'
                        ) {
                            invalidTokens.push(tokens[idx]);
                        }
                    }
                });

                if (invalidTokens.length > 0) {
                    await pruneInvalidTokens(unitId, invalidTokens);
                }
            }

            return null;
        } catch (err: unknown) {
            // Não propagamos o erro para não causar retry infinito no trigger
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[notifyEscalations] Error sending FCM for ${unitId}/${bedId}: ${msg}`);
            return null;
        }
    });

// ── Token cleanup ─────────────────────────────────────────────────────────────

/**
 * Remove tokens inválidos dos documentos de subscriber.
 * Chamado após uma falha de envio FCM com código de token inválido.
 */
async function pruneInvalidTokens(unitId: string, invalidTokens: string[]): Promise<void> {
    const snap = await db
        .collection('units')
        .doc(unitId)
        .collection('notification_subscribers')
        .where('active', '==', true)
        .get();

    const batch = db.batch();
    const { FieldValue } = await import('firebase-admin/firestore');

    for (const doc of snap.docs) {
        const data = doc.data() as FcmSubscriberDoc;
        const hasInvalid = (data.tokens ?? []).some(t => invalidTokens.includes(t));
        if (!hasInvalid) continue;

        const remaining = (data.tokens ?? []).filter(t => !invalidTokens.includes(t));
        batch.update(doc.ref, {
            tokens: FieldValue.arrayRemove(...invalidTokens),
            active: remaining.length > 0,
            updatedAt: FieldValue.serverTimestamp(),
        });
    }

    await batch.commit();
}
