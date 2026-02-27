import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { isGlobalAdmin } from '../config/admins';

export const setGlobalAdminClaim = functions.region('southamerica-east1').https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    // Caller must be an existing global admin, either by email fallback or by existing claim
    const callerEmail = context.auth.token.email || '';
    const callerIsAdmin = context.auth.token.admin === true || isGlobalAdmin(callerEmail);

    if (!callerIsAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Only global admins can perform this action.');
    }

    const { targetEmail, admin: makeAdmin } = data;
    if (!targetEmail || typeof makeAdmin !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'Missing targetEmail or admin boolean flag.');
    }

    try {
        const userRecord = await admin.auth().getUserByEmail(targetEmail.toLowerCase().trim());

        // Retain existing claims while applying/removing the admin claim
        const currentClaims = userRecord.customClaims || {};

        if (makeAdmin) {
            currentClaims.admin = true;
        } else {
            delete currentClaims.admin;
        }

        await admin.auth().setCustomUserClaims(userRecord.uid, currentClaims);

        return { success: true, message: `Successfully ${makeAdmin ? 'granted' : 'revoked'} admin claim for ${targetEmail}` };
    } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'User not found with provided email.');
        }
        throw new functions.https.HttpsError('internal', `Error setting admin claim: ${err.message}`);
    }
});
