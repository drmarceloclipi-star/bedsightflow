import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { db } from '../config';
import { buildAuditDiff } from '../lib/buildAuditDiff';

export const resetBedKamishibai = functions.region('southamerica-east1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const uid = context.auth.uid;
    const email = context.auth.token.email || '';
    const displayName = context.auth.token.name || email;

    const { unitId, bedId, reason, source } = data;
    if (!unitId || !bedId) throw new functions.https.HttpsError('invalid-argument', 'Missing unitId or bedId.');

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid reason is required for resetting Kamishibai board (min 3 chars).');
    }

    const roleDoc = await db.collection('units').doc(unitId).collection('users').doc(uid).get();
    if (!roleDoc.exists || roleDoc.data()?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action.');
    }

    const bedRef = db.collection('units').doc(unitId).collection('beds').doc(bedId);
    const bedDoc = await bedRef.get();
    if (!bedDoc.exists) throw new functions.https.HttpsError('not-found', 'Bed not found.');

    const beforeData = bedDoc.data() || {};
    const now = admin.firestore.FieldValue.serverTimestamp();
    const updatedBy = { uid, email };

    const resetKamishibai: Record<string, any> = {};
    if (beforeData.kamishibai) {
        for (const key of Object.keys(beforeData.kamishibai)) {
            resetKamishibai[key] = {
                status: 'na',
                note: '',
                updatedAt: now,
                updatedBy: { id: uid, name: email }
            };
        }
    }

    const afterData = {
        ...beforeData,
        kamishibai: resetKamishibai,
        updatedAt: now,
        updatedBy
    };

    const diff = buildAuditDiff(beforeData, afterData);
    if (!diff) return { success: true };

    const batch = db.batch();
    batch.set(bedRef, afterData, { merge: true });

    const auditLogRef = db.collection('units').doc(unitId).collection('audit_logs').doc();
    batch.set(auditLogRef, {
        id: auditLogRef.id,
        unitId,
        actor: { uid, email, displayName, role: 'admin' },
        action: 'RESET_BED_KAMISHIBAI',
        entityType: 'bed',
        entityId: bedId,
        targetPath: `units/${unitId}/beds/${bedId}`,
        source: source || { appArea: 'admin' },
        before: beforeData,
        after: afterData,
        diff,
        reason: reason.trim(),
        createdAt: now
    });

    await batch.commit();
    return { success: true };
});
