import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { isSuperAdminEmail } from '../config/admins';

/**
 * setSuperAdminClaim — Sets or revokes the `superAdmin` custom claim.
 *
 * Only an existing Super Admin (by claim or bootstrap email) can invoke this.
 * Super Admin is the platform-level role (SaaS owner).
 */
export const setSuperAdminClaim = functions.region('southamerica-east1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    // Caller must be an existing super admin
    const callerEmail = context.auth.token.email || '';
    const callerIsSuperAdmin = context.auth.token.superAdmin === true || isSuperAdminEmail(callerEmail);

    if (!callerIsSuperAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Only super admins can perform this action.');
    }

    const { targetEmail, superAdmin: makeSuperAdmin } = data;
    if (!targetEmail || typeof makeSuperAdmin !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'Missing targetEmail or superAdmin boolean flag.');
    }

    try {
        const userRecord = await admin.auth().getUserByEmail(targetEmail.toLowerCase().trim());
        const currentClaims = userRecord.customClaims || {};

        if (makeSuperAdmin) {
            currentClaims.superAdmin = true;
        } else {
            delete currentClaims.superAdmin;
        }

        await admin.auth().setCustomUserClaims(userRecord.uid, currentClaims);

        return { success: true, message: `Successfully ${makeSuperAdmin ? 'granted' : 'revoked'} superAdmin claim for ${targetEmail}` };
    } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'User not found with provided email.');
        }
        throw new functions.https.HttpsError('internal', `Error setting superAdmin claim: ${err.message}`);
    }
});
