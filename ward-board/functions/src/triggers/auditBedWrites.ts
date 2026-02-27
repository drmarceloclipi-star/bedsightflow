import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../config';
import { buildAuditDiff } from '../lib/buildAuditDiff';

export const auditBedWrites = functions.region('southamerica-east1').firestore
    .document('units/{unitId}/beds/{bedId}')
    .onWrite(async (change, context) => {
        const { unitId, bedId } = context.params;

        const beforeData = change.before.data();
        const afterData = change.after.data();

        // Se ambos não existem, sair
        if (!beforeData && !afterData) return null;

        const diff = buildAuditDiff(beforeData, afterData);
        // Se a diff for nula e não for uma criação nem deleção (só atualizou timestamps por ex)
        if (!diff && beforeData && afterData) return null;

        // Tentar descobrir o ator
        // No client, devemos injetar { updatedBy: { uid, email, role? } } para sabermos quem fez.
        // Se não existir, marcamos como "System"
        const updatedBy = afterData?.updatedBy || beforeData?.updatedBy;
        const actorObj = updatedBy ? {
            uid: updatedBy.uid,
            email: updatedBy.email,
            displayName: updatedBy.displayName || 'Unknown',
            role: updatedBy.role || 'editor'
        } : {
            uid: 'system',
            email: 'system',
            role: 'system'
        };

        const now = admin.firestore.FieldValue.serverTimestamp();

        let action = 'UPDATE_BED';
        if (!beforeData && afterData) action = 'CREATE_BED';
        if (beforeData && !afterData) action = 'DELETE_BED';

        // Registra a diff
        const auditLogRef = db.collection('units').doc(unitId).collection('audit_logs').doc();

        return auditLogRef.set({
            id: auditLogRef.id,
            unitId,
            actor: actorObj,
            action,
            entityType: 'bed',
            entityId: bedId,
            targetPath: `units/${unitId}/beds/${bedId}`,
            source: { appArea: 'system', feature: 'onWriteTrigger' },
            before: beforeData || null,
            after: afterData || null,
            diff: diff || null,
            reason: 'Atualização direta de leito',
            createdAt: now
        });
    });
