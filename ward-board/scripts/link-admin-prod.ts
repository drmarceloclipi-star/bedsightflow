import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// NO emulator env vars = connects to production
const app = initializeApp({ projectId: 'lean-841e5' });
const db = getFirestore(app);

import { ADMIN_EMAILS } from "../src/config/admins";

const ADMIN_UID = 'wooxz2taLDMj4zBktsNOSGjs8l72';
const ADMIN_EMAIL = ADMIN_EMAILS[0];
const ADMIN_NAME = 'Dr. Marcelo Cavalcanti';

async function linkAdminToUnitA() {
    console.log('Linking admin to units/A in production...');

    // Create the unit user document so Cloud Functions recognize the role
    await db.collection('units').doc('A').collection('users').doc(ADMIN_UID).set({
        uid: ADMIN_UID,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        role: 'admin',
        addedAt: new Date().toISOString()
    });
    console.log(`✅ ${ADMIN_EMAIL} linked to Unit A as admin!`);

    // Also add to authorized_users global whitelist (if not already there)
    await db.collection('authorized_users').doc(ADMIN_UID).set({
        email: ADMIN_EMAIL,
        addedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`✅ ${ADMIN_EMAIL} added to authorized_users!`);

    process.exit(0);
}

linkAdminToUnitA().catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
});
