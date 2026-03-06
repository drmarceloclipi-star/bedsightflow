import * as functions from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config';
import { v4 as uuidv4 } from 'uuid';
import { chunkAndCommitBatch } from '../lib/firestoreBatch';

export const softResetUnit = functions.region('southamerica-east1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const uid = context.auth.uid;
    const email = context.auth.token.email || '';
    const displayName = context.auth.token.name || email;

    const { unitId, reason, source } = data;
    if (!unitId) throw new functions.https.HttpsError('invalid-argument', 'Missing unitId.');

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid reason is required for full unit reset (min 3 chars).');
    }

    const roleDoc = await db.collection('units').doc(unitId).collection('users').doc(uid).get();
    if (!roleDoc.exists || roleDoc.data()?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action.');
    }

    const now = FieldValue.serverTimestamp();
    const updatedBy = { uid, email };
    const correlationId = uuidv4(); // ID único desta operação em lote — agrupa todos os logs relacionados

    const bedsRef = db.collection('units').doc(unitId).collection('beds');
    const existingBeds = await bedsRef.get();

    const operations = existingBeds.docs.map(doc => {
        const bedData = doc.data();
        const kamishibai: Record<string, unknown> = {};
        if (bedData.kamishibai) {
            for (const key of Object.keys(bedData.kamishibai)) {
                kamishibai[key] = {
                    status: 'na',
                    note: '',
                    updatedAt: now,
                    updatedBy: { id: uid, name: email }
                };
            }
        }

        const afterData = {
            ...bedData,
            patientAlias: '',
            expectedDischarge: 'later',
            mainBlocker: '',
            involvedSpecialties: [],
            kamishibai,
            updatedAt: now,
            updatedBy,
            _correlationId: correlationId // permite rastrear leitos afetados por esta operação
        };
        return (batch: FirebaseFirestore.WriteBatch) => batch.set(doc.ref, afterData, { merge: true });
    });

    const auditLogRef = db.collection('units').doc(unitId).collection('audit_logs').doc();
    operations.push((batch) => batch.set(auditLogRef, {
        id: auditLogRef.id,
        unitId,
        actor: { uid, email, displayName, role: 'admin' },
        action: 'SOFT_RESET_UNIT',
        entityType: 'unit',
        entityId: unitId,
        targetPath: `units/${unitId}/beds`,
        source: source || { appArea: 'admin' },
        before: null,
        after: { resetBedsCount: existingBeds.size },
        diff: null,
        reason: reason.trim(),
        correlationId,
        createdAt: now
    }));

    await chunkAndCommitBatch(db, operations);
    return { success: true };
});
