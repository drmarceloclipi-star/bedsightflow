import * as functions from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../config';

export const deletePendency = functions.region('southamerica-east1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const adminUid = context.auth.uid;
    const adminEmail = context.auth.token.email || '';

    const { unitId, bedId, pendencyId } = data;
    if (!unitId || !bedId || !pendencyId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing unitId, bedId, or pendencyId.');
    }

    // Check caller is admin of this unit or global admin
    const roleDoc = await db.collection('units').doc(unitId).collection('users').doc(adminUid).get();

    const isGlobal = context.auth.token.admin === true;

    if (!isGlobal && (!roleDoc.exists || roleDoc.data()?.role !== 'admin')) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action.');
    }

    const bedRef = db.collection('units').doc(unitId).collection('beds').doc(bedId);

    try {
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(bedRef);
            if (!snap.exists) {
                throw new functions.https.HttpsError('not-found', `Bed ${bedId} not found`);
            }

            const bed = snap.data();
            const pendencies = (bed?.pendencies || []) as Array<{ id: string }>;

            const idx = pendencies.findIndex(p => p.id === pendencyId);
            if (idx === -1) {
                throw new functions.https.HttpsError('not-found', `Pendency ${pendencyId} not found`);
            }

            // Optional: fail if you want, but user requested to just allow delete even if canceled/done.
            // Removing from array
            pendencies.splice(idx, 1);

            const updatedBy = {
                uid: adminUid,
                email: adminEmail,
                name: context.auth?.token?.name || adminEmail
            };

            tx.update(bedRef, {
                pendencies,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy
            });
        });

        return { success: true, deletedId: pendencyId };
    } catch (error) {
        const e = error as Error;
        console.error(`[deletePendency] error:`, e);
        if (e instanceof functions.https.HttpsError) {
            throw e;
        }
        throw new functions.https.HttpsError('internal', `Internal error deleting pendency: ${e.message}`);
    }
});
