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
    { email: 'editor@lean.com', password: 'password123', role: 'editor', name: 'Editor User' },
    { email: 'viewer@lean.com', password: 'password123', role: 'viewer', name: 'Viewer User' },
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
// Frequency-weighted blockers so the TopBlockers chart shows a clear ranking
const MOCK_BLOCKERS_WEIGHTED = [
    // High frequency (realistic leading blockers)
    'Aguardando laudo RX',
    'Aguardando laudo RX',
    'Aguardando laudo RX',
    'Aguardando laudo RX',
    'Estabilização hemodinâmica',
    'Estabilização hemodinâmica',
    'Estabilização hemodinâmica',
    'Tratamento ATB prolongado',
    'Tratamento ATB prolongado',
    'Tratamento ATB prolongado',
    // Medium frequency
    'Ajuste de anticoagulação',
    'Ajuste de anticoagulação',
    'Aguardando vaga em reabilitação',
    'Aguardando vaga em reabilitação',
    'Avaliação neurológica pendente',
    'Avaliação neurológica pendente',
    // Low frequency
    'Fisioterapia motora intensiva',
    'Controle de dor crônica',
    'Exames laboratoriais',
    'Social pendente',
    'Aguardando vaga de UTI',
    'Pendente avaliação da Cirurgia'
];
// ~60% of beds have a blocker in a busy ward scenario
const pickBlocker = () =>
    Math.random() < 0.6
        ? MOCK_BLOCKERS_WEIGHTED[Math.floor(Math.random() * MOCK_BLOCKERS_WEIGHTED.length)]
        : '';

// Discharge distribution: realistic LOS (majority medium/long stays)
const MOCK_DISCHARGES = ['24h', '2-3_days', '>3_days', 'later'] as const;
const pickDischarge = () => {
    const r = Math.random();
    if (r < 0.15) return MOCK_DISCHARGES[0]; // 15% rapid discharge
    if (r < 0.40) return MOCK_DISCHARGES[1]; // 25% 2-3 days
    if (r < 0.70) return MOCK_DISCHARGES[2]; // 30% >3 days
    return MOCK_DISCHARGES[3];               // 30% later/undefined
};

const SEED_BEDS = BED_NUMBERS.map(num => ({
    number: num,
    patientAlias: MOCK_ALIASES[Math.floor(Math.random() * MOCK_ALIASES.length)],
    expectedDischarge: pickDischarge(),
    mainBlocker: pickBlocker(),
    unitId: 'A'
}));


// Domínios canônicos do Kamishibai — mesma ordem canônica: MÉDICA · ENF · FIS · NUT · PSIC · SS
const KAMISHIBAI_DOMAINS: string[] = [
    'medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social'
];

// Realistic kamishibai status distribution (not fully random):
// ~55% ok, ~25% pending, ~12% blocked, ~8% na
const pickKamishibaiStatus = (): 'ok' | 'pending' | 'blocked' | 'na' => {
    const r = Math.random();
    if (r < 0.55) return 'ok';
    if (r < 0.80) return 'pending';
    if (r < 0.92) return 'blocked';
    return 'na';
};

// Staleness buckets for freshness analytics:
// ~50% fresh (<6h), ~20% stale12h, ~15% stale24h, ~15% stale48h
const pickLastUpdate = (): string => {
    const now = Date.now();
    const r = Math.random();
    let ageMs: number;
    if (r < 0.50) ageMs = Math.random() * 6 * 3600_000;          // fresh: 0–6h
    else if (r < 0.70) ageMs = 12 * 3600_000 + Math.random() * 6 * 3600_000;  // 12–18h
    else if (r < 0.85) ageMs = 24 * 3600_000 + Math.random() * 8 * 3600_000;  // 24–32h
    else ageMs = 48 * 3600_000 + Math.random() * 12 * 3600_000;               // 48–60h
    return new Date(now - ageMs).toISOString();
};

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

            await db.collection('authorized_users').doc(userRecord.uid).set({
                email: user.email,
                addedAt: new Date().toISOString()
            });

            console.log(`  ✅ ${user.name} (${user.email}) — uid: ${userRecord.uid}`);
        } catch (error: unknown) {
            const err = error as { code?: string; message?: string };
            if (err.code === 'auth/email-already-exists') {
                console.log(`  ℹ️  Already exists: ${user.email} (updating profiles)`);
                try {
                    const existingUser = await auth.getUserByEmail(user.email);
                    await db.collection('users').doc(existingUser.uid).set({
                        uid: existingUser.uid,
                        email: user.email,
                        role: user.role,
                        name: user.name,
                        createdAt: new Date().toISOString() // or keep old one, but merge true is fine if we omit createdAt
                    }, { merge: true });

                    await db.collection('authorized_users').doc(existingUser.uid).set({
                        email: user.email,
                        addedAt: new Date().toISOString()
                    }, { merge: true });
                } catch (e) {
                    console.error(`  ❌ Error updating existing user ${user.email}:`, e);
                }
            } else {
                console.error(`  ❌ Error creating ${user.email}:`, err.message);
            }
        }
    }

    // 2. Seed Unit document
    console.log('\n🏥 Creating unit...');
    await db.collection('units').doc('A').set({
        id: 'A',
        name: 'Unidade A',
        totalBeds: SEED_BEDS.length,
        specialties: ['medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social']
    });
    console.log('  ✅ Unit A created');

    // 2.1. Link all seeded users to Unit A to pass Firestore Rules (isUnitMember)
    console.log('\n🔗 Linking users to Unit A...');
    for (const user of SEED_USERS) {
        try {
            const userRecord = await auth.getUserByEmail(user.email);
            await db.collection('units').doc('A').collection('users').doc(userRecord.uid).set({
                uid: userRecord.uid,
                email: user.email,
                role: user.role,
                name: user.name,
                addedAt: new Date().toISOString()
            });
            console.log(`  ✅ ${user.name} linked to Unit A as ${user.role}`);
        } catch (error: unknown) {
            const err = error as { message?: string };
            console.error(`  ❌ Failed to link ${user.email} to Unit A:`, err.message);
        }
    }

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

        const kamishibai: Record<string, {
            status: 'ok' | 'pending' | 'blocked' | 'na';
            updatedAt: string;
            note: string;
            updatedBy: { id: string; name: string };
        }> = {};
        KAMISHIBAI_DOMAINS.forEach(s => {
            kamishibai[s] = {
                status: pickKamishibaiStatus(),
                updatedAt: new Date().toISOString(),
                note: '',
                updatedBy: { id: 'seed', name: 'System Seed' }
            };
        });

        // ~70% of beds have medical specialty involvement
        const involvedSpecialties = Math.random() > 0.3 ? ['medical' as const] : [];

        // Realistic last-update timestamp (drives Freshness metrics)
        const lastUpdate = pickLastUpdate();

        await bedRef.set({
            id,
            ...data,
            involvedSpecialties,
            kamishibai,
            lastUpdate,
            updatedAt: lastUpdate,
        });
        console.log(`  ✅ Bed ${data.number} — ${data.patientAlias} | blocker: ${data.mainBlocker || 'none'} | last update: ${lastUpdate.slice(11, 16)}`);
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
