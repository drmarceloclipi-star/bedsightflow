import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// NO emulator env vars = connects to production
const app = initializeApp({ projectId: 'lean-841e5' });
const db = getFirestore(app);

async function createUnitA() {
    console.log('Creating units/A in production Firestore...');
    await db.collection('units').doc('A').set({
        id: 'A',
        name: 'Unidade A',
        totalBeds: 36,
        specialties: ['medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social']
    });
    console.log('✅ units/A created in production!');
    process.exit(0);
}

createUnitA().catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
});
