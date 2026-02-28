import * as functions from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../config';
import { buildAuditDiff } from '../lib/buildAuditDiff';

export const updateBoardSettings = functions.region('southamerica-east1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const { unitId, settings, reason, source } = data;
    const uid = context.auth.uid;

    if (!unitId || !settings) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing unitId or settings.');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid reason is required for updating board settings (min 3 chars).');
    }

    const userSnapshot = await db.collection('units').doc(unitId).collection('users').doc(uid).get();
    const userData = userSnapshot.data();
    const role = userData?.role;
    const email = context.auth.token.email || '';
    const displayName = context.auth.token.name || email;

    if (role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action.');
    }

    try {
        const settingsRef = db.collection('units').doc(unitId).collection('settings').doc('board');
        const settingsDoc = await settingsRef.get();
        const beforeData = settingsDoc.exists ? settingsDoc.data() : null;

        const now = FieldValue.serverTimestamp();
        const updatedBy = { uid, email };

        const afterData = {
            ...beforeData,
            ...settings,
            updatedAt: now,
            updatedBy
        };

        const diff = buildAuditDiff(beforeData, afterData);

        const batch = db.batch();
        batch.set(settingsRef, afterData, { merge: true });

        const auditLogRef = db.collection('units').doc(unitId).collection('audit_logs').doc();
        batch.set(auditLogRef, {
            id: auditLogRef.id,
            unitId,
            actor: { uid, email, displayName, role: 'admin' },
            action: 'UPDATE_BOARD_SETTINGS',
            entityType: 'board_settings',
            entityId: 'board',
            targetPath: `units/${unitId}/settings/board`,
            source: source || { appArea: 'admin' },
            before: beforeData,
            after: afterData,
            diff,
            reason: reason.trim(),
            createdAt: now
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        throw new functions.https.HttpsError('internal', `Internal error: ${error.message}`);
    }
});
