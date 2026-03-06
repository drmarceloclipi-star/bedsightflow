import * as functions from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config';
import { v4 as uuidv4 } from 'uuid';
import { chunkAndCommitBatch } from '../lib/firestoreBatch';

const CANONICAL_BED_NUMBERS = [
    '301.1', '301.2', '301.3', '301.4',
    '302.1', '302.2', '302.3',
    '303',
    '304.1', '304.2', '304.3',
    '305.1', '305.2', '305.3', '305.4',
    '306.1', '306.2', '306.3',
    '307.1', '307.2', '307.3', '307.4',
    '308',
    '309.1', '309.2', '309.3',
    '310.1', '310.2',
    '311.1', '311.2', '311.3',
    '312.1', '312.2', '312.3',
    '313.1', '313.2'
];

export const applyCanonicalBeds = functions.region('southamerica-east1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const uid = context.auth.uid;
    const email = context.auth.token.email || '';
    const displayName = context.auth.token.name || email;

    const { unitId, reason, source } = data;
    if (!unitId) throw new functions.https.HttpsError('invalid-argument', 'Missing unitId.');

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid reason is required for applying canonical beds (min 3 chars).');
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

    const kamishibai: Record<string, unknown> = {};
    const domains = ['medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social'];
    domains.forEach(d => {
        kamishibai[d] = {
            status: 'na',
            updatedAt: now,
            note: '',
            updatedBy: { id: uid, name: email }
        };
    });

    const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

    // Deleta leitos que não estão na lista canônica e reseta os que estão
    existingBeds.docs.forEach(doc => {
        operations.push((batch) => batch.delete(doc.ref));
    });

    for (const num of CANONICAL_BED_NUMBERS) {
        const id = `bed_${num}`;
        const bedRef = bedsRef.doc(id);
        operations.push((batch) => batch.set(bedRef, {
            id,
            unitId,
            number: num,
            patientAlias: '',
            expectedDischarge: 'later',
            mainBlocker: '',
            involvedSpecialties: [],
            kamishibai,
            updatedAt: now,
            updatedBy,
            _correlationId: correlationId // permite rastrear leitos criados por esta operação
        }));
    }

    const auditLogRef = db.collection('units').doc(unitId).collection('audit_logs').doc();
    operations.push((batch) => batch.set(auditLogRef, {
        id: auditLogRef.id,
        unitId,
        actor: { uid, email, displayName, role: 'admin' },
        action: 'APPLY_CANONICAL_BEDS',
        entityType: 'unit',
        entityId: unitId,
        targetPath: `units/${unitId}/beds`,
        source: source || { appArea: 'admin' },
        before: null,
        after: { totalBeds: CANONICAL_BED_NUMBERS.length },
        diff: null,
        reason: reason.trim(),
        correlationId,
        createdAt: now
    }));

    await chunkAndCommitBatch(db, operations);
    return { success: true };
});
