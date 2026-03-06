import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const app = initializeApp({ projectId: 'lean-841e5' });
const auth = getAuth(app);
const db = getFirestore(app);

async function check() {
    const list = await auth.listUsers();
    console.log(`Total users in auth: ${list.users.length}`);
    for (const user of list.users) {
        console.log(`Email: ${user.email} -> UID: ${user.uid}`);
        try {
            const authz = await db.collection('users').doc(user.uid).collection('authz').doc('authz').get();
            console.log(`  authz exists? ${authz.exists}`);
            if (authz.exists) console.log(`  roles:`, authz.data().units);
        } catch (e) {
            console.error(e.message);
        }
    }
}
check();
