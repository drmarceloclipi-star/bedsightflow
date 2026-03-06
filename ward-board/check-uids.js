const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const app = initializeApp({ projectId: 'lean-841e5' });
const auth = getAuth(app);
const db = getFirestore(app);

async function check() {
    const emails = ['global-admin@lean.com', 'editor@lean.com'];
    for (const email of emails) {
        try {
            const user = await auth.getUserByEmail(email);
            console.log(`${user.email} -> UID: ${user.uid}`);
            const authz = await db.collection('users').doc(user.uid).collection('authz').doc('authz').get();
            console.log(`  authz exists? ${authz.exists}`);
            if (authz.exists) {
                console.log(`  roles:`, authz.data().units);
            }
        } catch (e) {
            console.error(e.message);
        }
    }
}
check();
