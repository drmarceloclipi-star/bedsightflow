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

// ── ShiftKey helper (inline — sem importar src/ no seed admin) ───────────────
// Spec: LEAN_SHIFTKEY_SPEC_HRHDS.md §3
const SEED_TZ = 'America/Sao_Paulo';
const SEED_AM_START = 7 * 60;  // 07:00 em minutos
const SEED_PM_START = 19 * 60; // 19:00 em minutos

function seedComputeShiftKey(now: Date): string {
    const localStr = new Intl.DateTimeFormat('sv-SE', {
        timeZone: SEED_TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now); // ex: "2026-02-28 14:30"
    const [datePart, timePart] = localStr.split(' ');
    const [h, m] = timePart!.split(':').map(Number);
    const localMin = (h ?? 0) * 60 + (m ?? 0);

    if (localMin >= SEED_AM_START && localMin < SEED_PM_START) return `${datePart}-AM`;
    if (localMin >= SEED_PM_START) return `${datePart}-PM`;
    // madrugada → PM do dia anterior
    const d = new Date(datePart + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return `${d.toISOString().slice(0, 10)}-PM`;
}

const CURRENT_SHIFT_KEY = seedComputeShiftKey(new Date());
console.log(`⏰ Current shiftKey: ${CURRENT_SHIFT_KEY}`);

// ── Helpers de data ───────────────────────────────────────────────────────────
const hoursAgo = (h: number): string => new Date(Date.now() - h * 3600_000).toISOString();
const daysAgo = (d: number): string => new Date(Date.now() - d * 86_400_000).toISOString();

const SEED_USERS = [
    { email: 'admin@lean.com', password: 'password123', role: 'admin', name: 'Admin User' },
    { email: 'editor@lean.com', password: 'password123', role: 'editor', name: 'Editor User' },
    { email: 'viewer@lean.com', password: 'password123', role: 'viewer', name: 'Viewer User' },
    { email: 'doctor@lean.com', password: 'password123', role: 'doctor', name: 'Dr. Silva' },
    { email: 'nurse@lean.com', password: 'password123', role: 'nurse', name: 'Enf. Maria' },
    { email: 'clarinhaschroeder@gmail.com', password: 'password123', role: 'admin', name: 'Clarinha Schroeder' },
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

// ── Pendências v1 ────────────────────────────────────────────────────────────
interface PendencyDoc {
    id: string;
    title: string;
    status: 'open' | 'done' | 'canceled';
    domain?: string;
    note?: string;
    dueAt?: string;
    createdAt: string;
    createdBy: { id: string; name: string };
    updatedAt?: string;
    updatedBy?: { id: string; name: string };
    doneAt?: string;
    doneBy?: { id: string; name: string };
    canceledAt?: string;
    canceledBy?: { id: string; name: string };
}

const SEED_ACTOR = { id: 'seed', name: 'System Seed' };

const makePendency = (
    title: string,
    status: 'open' | 'done' | 'canceled',
    opts: {
        domain?: string;
        dueAt?: string;
        doneAt?: string;
        canceledAt?: string;
        note?: string;
    } = {}
): PendencyDoc => {
    const doc: PendencyDoc = {
        id: `seed_pend_${Math.random().toString(36).slice(2, 9)}`,
        title,
        status,
        domain: opts.domain,
        note: opts.note,
        dueAt: opts.dueAt,
        createdAt: hoursAgo(24),
        createdBy: SEED_ACTOR,
    };
    if (status === 'done' && opts.doneAt) {
        doc.doneAt = opts.doneAt;
        doc.doneBy = SEED_ACTOR;
        doc.updatedAt = opts.doneAt;
        doc.updatedBy = SEED_ACTOR;
    }
    if (status === 'canceled' && opts.canceledAt) {
        doc.canceledAt = opts.canceledAt;
        doc.canceledBy = SEED_ACTOR;
        doc.updatedAt = opts.canceledAt;
        doc.updatedBy = SEED_ACTOR;
    }
    return doc;
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

// v1 status distribution: apenas ok | blocked
// 'na' não é mais gerado em seeds v1 — aparece somente no bed legado explícito abaixo
const pickKamishibaiStatusV1 = (): 'ok' | 'blocked' => {
    const r = Math.random();
    if (r < 0.65) return 'ok';
    return 'blocked';
};

// Helper: gera entry v1 com reviewedShiftKey e blockedAt
function makeKamishibaiEntry(status: 'ok' | 'blocked', updatedAt: string) {
    const entry: Record<string, unknown> = {
        status,
        updatedAt,
        updatedBy: { id: 'seed', name: 'System Seed' },
        note: '',
        reviewedShiftKey: CURRENT_SHIFT_KEY,
        reviewedAt: updatedAt,
    };
    if (status === 'blocked') {
        // blockedAt é o horário inicial do bloqueio (pode ser mais antigo que reviewedAt)
        entry.blockedAt = hoursAgo(Math.floor(Math.random() * 18) + 1); // 1–18h atrás
        entry.reason = 'Aguardando avaliação (seed)';
    }
    return entry;
}

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

    // 3. Seed Board Settings (display)
    console.log('\n⚙️  Creating board settings (display)...');
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

    // 3.1. Seed Ops Settings (política operacional v1)
    // Ref: LEAN_CONTRACT_HRHDS §6, LEAN_SHIFTKEY_SPEC_HRHDS §5.2
    console.log('\n⚙️  Creating ops settings (v1)...');
    await db.collection('units').doc('A').collection('settings').doc('ops').set({
        kanbanMode: 'ACTIVE_LITE',
        kamishibaiEnabled: true,
        huddleSchedule: { amStart: '07:00', pmStart: '19:00' },
        // lastHuddle* omitido intencionalmente → mostrará HUDDLE_PENDING na UI
    }, { merge: true });
    console.log('  ✅ Ops settings created (kamishibaiEnabled=true, huddleSchedule=07:00/19:00)');
    console.log('  ℹ️  lastHuddleShiftKey omitido → HUDDLE_PENDING visível (para testar badge futuro)');

    // 3.2. Seed Mission Control thresholds (v1) — configuráveis por unidade
    // Ref: docs/lean/MISSION_CONTROL_V1_ACCEPTANCE_2026-02-28.md
    // Esses valores são idênticos aos defaults de DEFAULT_MISSION_CONTROL_THRESHOLDS
    // para demonstrar o caminho de override sem quebrar nada.
    console.log('\n⚙️  Creating mission_control settings (thresholds v1)...');
    await db.collection('units').doc('A').collection('settings').doc('mission_control').set({
        // KPI 1 — Bloqueados
        blockedPctWarning: 20,
        blockedPctCritical: 35,
        // Kamishibai impedimentos
        kamishibaiImpedimentPctWarning: 15,
        kamishibaiImpedimentPctCritical: 30,
        // Freshness (baseado em reviewedAt por domínio)
        freshness12hWarningCount: 5,
        freshness24hWarningCount: 1,
        freshness24hCriticalCount: 3,
        freshness48hCriticalCount: 1,
        // Não revisados neste turno
        unreviewedShiftWarningCount: 3,
        unreviewedShiftCriticalCount: 6,
        // Metadata
        _seededAt: new Date().toISOString(),
        _note: 'Override de exemplo — iguais aos defaults; altere para personalizar por unidade',
    });
    console.log('  ✅ Mission Control thresholds seeded (defaults para Unit A)');

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

    // ── Beds v1 ──────────────────────────────────────────────────────────────
    // 6 beds com dados v1 completos + restante com geração automática v1
    // 1 bed legado explícito com status 'na' para testar compat

    // Profiles fixos para os primeiros 6 beds (dados v1 ricos)
    const V1_BED_PROFILES: Record<string, {
        patientAlias: string;
        mainBlocker: string;
        mainBlockerBlockedAt?: string;
        applicableDomains: string[];
        kamishibai: Record<string, Record<string, unknown>>;
        pendencies?: PendencyDoc[];
    }> = {
        '301.1': {
            patientAlias: 'JC',
            mainBlocker: 'Aguardando laudo RX',
            mainBlockerBlockedAt: hoursAgo(6),
            applicableDomains: ['medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social'],
            kamishibai: {
                medical: makeKamishibaiEntry('ok', hoursAgo(2)),
                nursing: makeKamishibaiEntry('ok', hoursAgo(2)),
                physio: makeKamishibaiEntry('blocked', hoursAgo(5)),
                nutrition: makeKamishibaiEntry('ok', hoursAgo(3)),
                psychology: makeKamishibaiEntry('ok', hoursAgo(2)),
                social: makeKamishibaiEntry('ok', hoursAgo(2)),
            },
            // 301.1: 1 pendência aberta (sem prazo)
            pendencies: [
                makePendency('Solicitar RX de tórax atualizado', 'open', { domain: 'medical' }),
            ],
        },
        '301.2': {
            patientAlias: 'MA',
            mainBlocker: 'Estabilização hemodinâmica',
            mainBlockerBlockedAt: hoursAgo(14),
            // physio e social não aplicáveis para este caso clínico
            applicableDomains: ['medical', 'nursing', 'nutrition', 'psychology'],
            kamishibai: {
                medical: makeKamishibaiEntry('blocked', hoursAgo(10)),
                nursing: makeKamishibaiEntry('blocked', hoursAgo(8)),
                physio: { status: 'na', updatedAt: hoursAgo(48), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' }, // legado mesmo num bed ativo
                nutrition: makeKamishibaiEntry('ok', hoursAgo(3)),
                psychology: makeKamishibaiEntry('ok', hoursAgo(2)),
                social: { status: 'na', updatedAt: hoursAgo(48), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
            },
            // 301.2: 2 pendências abertas (1 normal sem prazo, 1 vencida ontem)
            pendencies: [
                makePendency('Reavaliação médica urgente', 'open', { domain: 'medical' }),
                makePendency('Revisit hemoculturas pendentes', 'open', {
                    domain: 'nursing',
                    dueAt: daysAgo(1), // vencida: prazo foi ontem
                }),
            ],
        },
        '301.3': {
            patientAlias: 'RB',
            mainBlocker: '',
            // green válido neste turno — reviewedShiftKey = CURRENT_SHIFT_KEY
            applicableDomains: ['medical', 'nursing', 'physio', 'nutrition'],
            kamishibai: {
                medical: makeKamishibaiEntry('ok', hoursAgo(1)),
                nursing: makeKamishibaiEntry('ok', hoursAgo(1)),
                physio: makeKamishibaiEntry('ok', hoursAgo(2)),
                nutrition: makeKamishibaiEntry('ok', hoursAgo(1)),
                psychology: { status: 'na', updatedAt: hoursAgo(48), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
                social: { status: 'na', updatedAt: hoursAgo(48), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
            },
            // Pendência cancelada — teste de histórico (evidência preservada, não deletada)
            pendencies: [
                makePendency('Solicitar parecer cardiologia', 'canceled', {
                    domain: 'medical',
                    canceledAt: hoursAgo(3),
                    note: 'Cancelado pois paciente foi transferido antes da consulta',
                }),
            ],
        },

        '301.4': {
            // Verde LEGADO: status=ok mas sem reviewedShiftKey → deve aparecer SEM COR na UI v1
            patientAlias: 'FL',
            mainBlocker: '',
            applicableDomains: ['medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social'],
            kamishibai: {
                // sem reviewedShiftKey = v0 legado → UNREVIEWED_THIS_SHIFT no renderer v1
                medical: { status: 'ok', updatedAt: daysAgo(1), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
                nursing: { status: 'ok', updatedAt: daysAgo(1), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
                physio: { status: 'ok', updatedAt: daysAgo(2), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
                nutrition: { status: 'ok', updatedAt: daysAgo(1), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
                psychology: { status: 'ok', updatedAt: daysAgo(1), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
                social: { status: 'ok', updatedAt: daysAgo(1), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
            },
        },
        '302.1': {
            patientAlias: 'GS',
            mainBlocker: 'Tratamento ATB prolongado',
            mainBlockerBlockedAt: hoursAgo(30),
            applicableDomains: ['medical', 'nursing', 'nutrition'],
            kamishibai: {
                medical: makeKamishibaiEntry('blocked', hoursAgo(12)),
                nursing: makeKamishibaiEntry('ok', hoursAgo(1)),
                physio: { status: 'na', updatedAt: hoursAgo(72), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
                nutrition: makeKamishibaiEntry('ok', hoursAgo(2)),
                psychology: { status: 'na', updatedAt: hoursAgo(72), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
                social: { status: 'na', updatedAt: hoursAgo(72), updatedBy: { id: 'seed', name: 'Legacy' }, note: '' },
            },
            // 302.1: 1 pendência concluída (done) + 0 abertas
            pendencies: [
                makePendency('Confirmar dieta prescrita', 'done', {
                    domain: 'nutrition',
                    doneAt: hoursAgo(6),
                }),
            ],
        },
        '302.2': {
            // Bed LEGADO EXPLÍCITO: status='na' em todos os domains — para testar migração
            patientAlias: 'VM',
            mainBlocker: 'Social pendente',
            applicableDomains: undefined as unknown as string[], // sem campo → todos aplicáveis
            kamishibai: {
                medical: { status: 'na', updatedAt: daysAgo(3), updatedBy: { id: 'seed', name: 'LegacyV0' }, note: '' },
                nursing: { status: 'na', updatedAt: daysAgo(3), updatedBy: { id: 'seed', name: 'LegacyV0' }, note: '' },
                physio: { status: 'na', updatedAt: daysAgo(3), updatedBy: { id: 'seed', name: 'LegacyV0' }, note: '' },
                nutrition: { status: 'na', updatedAt: daysAgo(3), updatedBy: { id: 'seed', name: 'LegacyV0' }, note: '' },
                psychology: { status: 'na', updatedAt: daysAgo(3), updatedBy: { id: 'seed', name: 'LegacyV0' }, note: '' },
                social: { status: 'na', updatedAt: daysAgo(3), updatedBy: { id: 'seed', name: 'LegacyV0' }, note: '' },
            },
            // 302.2: 2 pendências abertas vencidas (bed legado sem kamishibai v1)
            pendencies: [
                makePendency('Encaminhar para serviço social', 'open', {
                    domain: 'social',
                    dueAt: daysAgo(2), // vencida: 2 dias atrás
                }),
                makePendency('Aguardar atestado médico de alta', 'open', {
                    domain: 'medical',
                    dueAt: daysAgo(1), // vencida: ontem
                }),
            ],
        },
    };

    for (const data of SEED_BEDS) {
        const id = `bed_${data.number}`;
        const bedRef = db.collection('units').doc(data.unitId).collection('beds').doc(id);

        const profile = V1_BED_PROFILES[data.number];
        const updatedAt = pickLastUpdate();

        let kamishibai: Record<string, unknown>;
        let applicableDomains: string[] | undefined;
        let mainBlockerBlockedAt: string | undefined;

        if (profile) {
            // Bed com profile explícito (v1 rico ou legado explícito)
            kamishibai = profile.kamishibai;
            applicableDomains = profile.applicableDomains;
            mainBlockerBlockedAt = profile.mainBlockerBlockedAt;
        } else {
            // Beds restantes: geração automática v1 (sem 'na')
            kamishibai = {};
            KAMISHIBAI_DOMAINS.forEach(s => {
                kamishibai[s] = makeKamishibaiEntry(pickKamishibaiStatusV1(), hoursAgo(Math.floor(Math.random() * 6)));
            });
            // ~80% com todos os domínios, ~20% com subset
            applicableDomains = Math.random() > 0.2
                ? [...KAMISHIBAI_DOMAINS]
                : ['medical', 'nursing', 'nutrition'];
            mainBlockerBlockedAt = data.mainBlocker ? hoursAgo(Math.floor(Math.random() * 24) + 1) : undefined;
        }

        const involvedSpecialties = Math.random() > 0.3 ? ['medical' as const] : [];

        const bedDoc: Record<string, unknown> = {
            id,
            ...data,
            // override mainBlocker/alias com profile se existir
            ...(profile ? { patientAlias: profile.patientAlias, mainBlocker: profile.mainBlocker } : {}),
            involvedSpecialties,
            kamishibai,
            updatedAt,
        };
        if (applicableDomains !== undefined) bedDoc.applicableDomains = applicableDomains;
        if (mainBlockerBlockedAt) bedDoc.mainBlockerBlockedAt = mainBlockerBlockedAt;
        if (profile?.pendencies?.length) bedDoc.pendencies = profile.pendencies;

        await bedRef.set(bedDoc);
        const alias = (profile?.patientAlias ?? data.patientAlias) || '—';
        const blocker = (profile?.mainBlocker ?? data.mainBlocker) || 'none';
        const tag = profile ? (data.number === '302.2' ? '🦕 LEGADO v0' : '✅ v1') : '🔄 auto-v1';
        console.log(`  ${tag} Bed ${data.number} — ${alias} | blocker: ${blocker} | shiftKey: ${CURRENT_SHIFT_KEY}`);
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
