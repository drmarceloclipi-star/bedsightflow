/**
 * Script de migração: converte documentos de usuários com IDs baseados em e-mail
 * para usarem o UID real do Firebase Auth.
 *
 * Isso corrige o erro "Missing or insufficient permissions" para editores no mobile
 * porque as regras de segurança do Firestore verificam por UID, não por slug de e-mail.
 *
 * Executar com:
 *   npm run migrate-users
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || undefined;
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || undefined;

const UNIT_IDS = ['A']; // Adicione mais unidades se necessário

const app = initializeApp({ projectId: 'lean-841e5' });
const db = getFirestore(app);
const auth = getAuth(app);

// Detecta se um ID de documento parece um UID real do Firebase (alfanumérico, ~28 chars)
function looksLikeUID(id: string): boolean {
    return /^[A-Za-z0-9]{20,30}$/.test(id);
}

async function migrateUnit(unitId: string) {
    console.log(`\n📦 Processing unit: ${unitId}`);
    const usersCol = db.collection('units').doc(unitId).collection('users');
    const snapshot = await usersCol.get();

    for (const docSnap of snapshot.docs) {
        const docId = docSnap.id;
        const data = docSnap.data();

        if (looksLikeUID(docId)) {
            console.log(`  ✅ Skipping "${docId}" — already looks like a UID.`);
            continue;
        }

        // Doc ID parece ser um slug de e-mail, precisa de migração
        const email = data.email as string | undefined;
        if (!email) {
            console.log(`  ⚠️  Skipping "${docId}" — no email field, cannot migrate.`);
            continue;
        }

        console.log(`  🔄 Migrating "${docId}" (email: ${email})...`);

        let realUid: string;
        try {
            const userRecord = await auth.getUserByEmail(email.toLowerCase().trim());
            realUid = userRecord.uid;
        } catch (err: unknown) {
            const e = err as { message?: string };
            console.error(`  ❌ Could not find Auth user for "${email}": ${e.message}`);
            console.log(`     Skipping. User needs to log in at least once before migration.`);
            continue;
        }

        // Verifica se já existe um doc com o UID correto
        const existingRef = usersCol.doc(realUid);
        const existingSnap = await existingRef.get();

        if (existingSnap.exists) {
            console.log(`  ℹ️  UID doc "${realUid}" already exists. Deleting old legacy doc "${docId}".`);
            await docSnap.ref.delete();
            console.log(`  🗑️  Deleted legacy doc "${docId}".`);
        } else {
            // Cria o novo doc com UID correto
            const newData = {
                ...data,
                uid: realUid,
                migratedFromId: docId,
                migratedAt: new Date().toISOString(),
            };
            await existingRef.set(newData);
            console.log(`  ✅ Created new doc "${realUid}" for ${email} with role "${data.role}".`);

            // Deleta o doc legado
            await docSnap.ref.delete();
            console.log(`  🗑️  Deleted legacy doc "${docId}".`);
        }
    }
}

async function run() {
    console.log('🚀 Starting user document migration...');
    console.log('   This script converts legacy email-slug doc IDs to Firebase Auth UIDs.');
    console.log('   This is required for Firestore security rules to work correctly.\n');

    for (const unitId of UNIT_IDS) {
        await migrateUnit(unitId);
    }

    console.log('\n✨ Migration complete!');
    console.log('   Verify in Firebase Console: units/{unitId}/users/');
    console.log('   All document IDs should now be UID format (28-char alphanumeric).');
    process.exit(0);
}

run().catch(err => {
    console.error('💥 Migration failed:', err);
    process.exit(1);
});
