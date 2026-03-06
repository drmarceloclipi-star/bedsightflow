import * as functions from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config';

export const removeUnitUser = functions.region('southamerica-east1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const adminUid = context.auth.uid;
    const adminEmail = context.auth.token.email || '';
    const adminDisplayName = context.auth.token.name || adminEmail;

    const { unitId, userUid, reason, source } = data;
    if (!unitId || !userUid) throw new functions.https.HttpsError('invalid-argument', 'Missing unitId or userUid.');

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid reason is required for removing users (min 3 chars).');
    }

    if (adminUid === userUid) {
        throw new functions.https.HttpsError('invalid-argument', 'You cannot remove yourself from the unit.');
    }

    // Check 1: platform or institution admin claim bypasses unit-level check
    const isAdminClaim = context.auth.token.superAdmin === true || context.auth.token.admin === true;

    if (!isAdminClaim) {
        // Check 2: centralized authz document (new RBAC model)
        const authzDoc = await db.collection('users').doc(adminUid).collection('authz').doc('authz').get();
        const unitRole = authzDoc.exists ? authzDoc.data()?.units?.[unitId]?.role : undefined;

        if (unitRole !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action.');
        }
    }

    const targetUserRef = db.collection('units').doc(unitId).collection('users').doc(userUid);
    const targetUserDoc = await targetUserRef.get();
    if (!targetUserDoc.exists) return { success: true }; // already removed

    const beforeData = targetUserDoc.data();
    const now = FieldValue.serverTimestamp();

    const batch = db.batch();
    batch.delete(targetUserRef);

    const auditLogRef = db.collection('units').doc(unitId).collection('audit_logs').doc();
    batch.set(auditLogRef, {
        id: auditLogRef.id,
        unitId,
        actor: { uid: adminUid, email: adminEmail, displayName: adminDisplayName, role: 'admin' },
        action: 'REMOVE_UNIT_USER',
        entityType: 'unit_user',
        entityId: userUid,
        targetPath: `units/${unitId}/users/${userUid}`,
        source: source || { appArea: 'admin' },
        before: beforeData,
        after: null,
        diff: null,
        reason: reason.trim(),
        createdAt: now
    });

    await batch.commit();
    return { success: true };
});
