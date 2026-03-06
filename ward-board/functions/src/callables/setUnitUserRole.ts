import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config';
import { isGlobalAdmin } from '../config/admins';
import { isAnyAdmin as isAnyAdminClaim } from '../lib/authz';

export const setUnitUserRole = functions.region('southamerica-east1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const adminUid = context.auth.uid;
    const adminEmail = context.auth.token.email || '';
    const adminDisplayName = context.auth.token.name || adminEmail;

    const { unitId, email, role, reason, source } = data;
    if (!unitId || !email || !role) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing unitId, email, or role.');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid reason is required for setting user roles (min 3 chars).');
    }

    // Check caller is admin of this unit
    const roleDoc = await db.collection('units').doc(unitId).collection('users').doc(adminUid).get();

    if (!isAnyAdminClaim(context) && !isGlobalAdmin(adminEmail) && (!roleDoc.exists || roleDoc.data()?.role !== 'admin')) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action.');
    }

    // Lookup the real Firebase Auth UID by email
    let targetUid: string;
    let targetDisplayName: string;
    try {
        const userRecord = await admin.auth().getUserByEmail(email.toLowerCase().trim());
        targetUid = userRecord.uid;
        // displayName may be undefined for users who signed up without a name
        targetDisplayName = userRecord.displayName ?? userRecord.email ?? email;
    } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === 'auth/user-not-found') {
            try {
                const newUser = await admin.auth().createUser({
                    email: email.toLowerCase().trim(),
                    emailVerified: false,
                    disabled: false,
                });
                targetUid = newUser.uid;
                targetDisplayName = newUser.displayName ?? email;
            } catch (createErr: unknown) {
                const msg = createErr instanceof Error ? createErr.message : String(createErr);
                throw new functions.https.HttpsError('internal', `Error creating user: ${msg}`);
            }
        } else {
            const msg = err instanceof Error ? err.message : String(err);
            throw new functions.https.HttpsError('internal', `Error looking up user: ${msg}`);
        }
    }

    const targetUserRef = db.collection('units').doc(unitId).collection('users').doc(targetUid);
    const targetUserDoc = await targetUserRef.get();
    const beforeData = targetUserDoc.exists ? targetUserDoc.data() : null;

    const now = FieldValue.serverTimestamp();
    const updatedBy = { uid: adminUid, email: adminEmail };

    // Strip any undefined values from Firestore reads — JSON.parse/stringify only safe for plain objects
    // NOTE: do NOT apply sanitize to afterData because it contains FieldValue.serverTimestamp()
    const sanitize = (obj: Record<string, any> | null | undefined): Record<string, any> | null =>
        obj ? JSON.parse(JSON.stringify(obj)) : null;

    const afterData: Record<string, any> = {
        uid: targetUid,
        email: email.toLowerCase().trim(),
        displayName: targetDisplayName,
        role,
        updatedAt: now,
        updatedBy,
    };

    if (!beforeData) {
        afterData.createdAt = now;
    } else if (beforeData.createdAt) {
        afterData.createdAt = beforeData.createdAt;
    }

    // Serializable version for the audit log (no FieldValue sentinels)
    const afterDataForAudit: Record<string, any> = {
        uid: targetUid,
        email: email.toLowerCase().trim(),
        displayName: targetDisplayName,
        role,
    };

    const batch = db.batch();
    batch.set(targetUserRef, afterData, { merge: true });

    const auditLogRef = db.collection('units').doc(unitId).collection('audit_logs').doc();
    batch.set(auditLogRef, {
        id: auditLogRef.id,
        unitId,
        actor: { uid: adminUid, email: adminEmail, displayName: adminDisplayName, role: 'admin' },
        action: beforeData ? 'UPDATE_UNIT_USER' : 'ADD_UNIT_USER',
        entityType: 'unit_user',
        entityId: targetUid,
        targetPath: `units/${unitId}/users/${targetUid}`,
        source: source || { appArea: 'admin' },
        before: sanitize(beforeData),
        after: afterDataForAudit,
        diff: {
            role: { before: beforeData?.role ?? null, after: role }
        },
        reason: reason.trim(),
        createdAt: now
    });

    // Sync with global authorized_users whitelist
    const authUserRef = db.collection('authorized_users').doc(targetUid);
    const authUserSnap = await authUserRef.get();
    batch.set(authUserRef, {
        email: email.toLowerCase().trim(),
        ...(authUserSnap.exists ? {} : { addedAt: now })
    }, { merge: true });

    await batch.commit();
    return { success: true, userUid: targetUid };
});
