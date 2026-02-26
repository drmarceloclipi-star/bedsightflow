import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Connect to emulators via environment variables
// These are set automatically when running with `npm run seed`
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const app = initializeApp({ projectId: 'lean-841e5' });
const db = getFirestore(app);
const auth = getAuth(app);

const SEED_USERS = [
    { email: 'admin@lean.com', password: 'password123', role: 'admin', name: 'Admin User' },
    { email: 'doctor@lean.com', password: 'password123', role: 'doctor', name: 'Dr. Silva' },
    { email: 'nurse@lean.com', password: 'password123', role: 'nurse', name: 'Enf. Maria' },
];

const BED_NUMBERS = [
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

const MOCK_ALIASES = ['JC', 'MA', 'RB', 'FL', 'GS', 'VM', 'OP', 'LM', 'KR', 'PT', 'AV', 'BF', 'DH', 'EL'];
const MOCK_BLOCKERS = [
    'Aguardando laudo RX',
    'Estabilização hemodinâmica',
    'Tratamento ATB prolongado',
    'Ajuste de anticoagulação',
    'Aguardando vaga em reabilitação',
    'Avaliação neurológica pendente',
    'Fisioterapia motora intensiva',
    'Controle de dor crônica',
    'Exames laboratoriais',
    'Social pendente',
    'Aguardando vaga de UTI',
    'Pendente avaliação da Cirurgia'
];
const MOCK_DISCHARGES = ['24h', '2-3_days', '>3_days', 'later'] as const;

const SEED_BEDS = BED_NUMBERS.map(num => ({
    number: num,
    patientAlias: MOCK_ALIASES[Math.floor(Math.random() * MOCK_ALIASES.length)],
    expectedDischarge: MOCK_DISCHARGES[Math.floor(Math.random() * MOCK_DISCHARGES.length)],
    mainBlocker: MOCK_BLOCKERS[Math.floor(Math.random() * MOCK_BLOCKERS.length)],
    unitId: 'A'
}));


// Domínios canônicos do Kamishibai — mesma ordem canônica: MÉDICA · ENF · FIS · NUT · PSIC · SS
const KAMISHIBAI_DOMAINS: string[] = [
    'medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social'
];
const STATUSES = ['ok', 'blocked', 'pending', 'na'] as const;

async function seed() {
    console.log('🌱 Starting seed...\n');

    // 1. Seed Auth Users + Firestore user profiles
    console.log('👤 Creating users...');
    for (const user of SEED_USERS) {
        try {
            const userRecord = await auth.createUser({
                email: user.email,
                password: user.password,
                displayName: user.name,
            });

            await db.collection('users').doc(userRecord.uid).set({
                uid: userRecord.uid,
                email: user.email,
                role: user.role,
                name: user.name,
                createdAt: new Date().toISOString()
            });

            console.log(`  ✅ ${user.name} (${user.email}) — uid: ${userRecord.uid}`);
        } catch (error: any) {
            if (error.code === 'auth/email-already-exists') {
                console.log(`  ℹ️  Already exists: ${user.email}`);
            } else {
                console.error(`  ❌ Error creating ${user.email}:`, error.message);
            }
        }
    }

    // 2. Seed Unit document
    console.log('\n🏥 Creating unit...');
    await db.collection('units').doc('A').set({
        id: 'A',
        name: 'Unidade A — MÉDICA',
        totalBeds: SEED_BEDS.length,
        specialties: ['medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social']
    });
    console.log('  ✅ Unit A created');

    // 3. Seed Board Settings
    console.log('\n⚙️  Creating board settings...');
    await db.collection('units').doc('A').collection('settings').doc('board').set({
        unitId: 'A',
        rotationEnabled: true,
        screens: [
            { key: 'kanban', label: 'Quadro Kanban', durationSeconds: 15, enabled: true },
            { key: 'kamishibai', label: 'Quadro Kamishibai', durationSeconds: 15, enabled: true },
            { key: 'summary', label: 'Resumo da Unidade', durationSeconds: 10, enabled: true },
        ]
    });
    console.log('  ✅ Board settings created');

    // 4. Clear and Seed Beds
    console.log('\n🛏️  Cleaning and creating beds...');
    const bedsCollection = db.collection('units').doc('A').collection('beds');
    const existingBeds = await bedsCollection.get();

    if (!existingBeds.empty) {
        console.log(`  🗑️  Deleting ${existingBeds.size} existing beds...`);
        const batch = db.batch();
        existingBeds.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    for (const data of SEED_BEDS) {

        const id = `bed_${data.number}`;
        const bedRef = db.collection('units').doc(data.unitId).collection('beds').doc(id);

        const kamishibai: Record<string, any> = {};
        KAMISHIBAI_DOMAINS.forEach(s => {
            kamishibai[s] = {
                status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
                updatedAt: new Date().toISOString(),
                note: '',
                updatedBy: { id: 'seed', name: 'System Seed' }
            };
        });

        // Randomly assign medical specialty for MVP consistency
        const involvedSpecialties = Math.random() > 0.3 ? ['medical' as const] : [];

        await bedRef.set({
            id,
            ...data,
            involvedSpecialties,
            kamishibai,
            lastUpdate: new Date().toISOString()
        });
        console.log(`  ✅ Bed ${data.number} — ${data.patientAlias} (Spec: ${involvedSpecialties.length})`);
    }

    console.log('\n✨ Seed finished successfully!');
    console.log('📋 Open http://localhost:4000 to see the data in the Emulator UI');
    console.log('📺 Open http://localhost:5173/tv?unit=A to see the TV Dashboard');

    process.exit(0);
}

seed().catch(err => {
    console.error('💥 Seed failed:', err);
    process.exit(1);
});
