/**
 * seed-lean-tests.ts (v2.0 — 36 beds canônicos)
 * ===============================================
 * Seed DETERMINÍSTICO para a Lean Suite de testes (E2E + Unit).
 *
 * CONTRATO:
 *  - Zero Math.random() — PRNG seedado para valores variáveis
 *  - Zero Date.now() / new Date() livre
 *  - mockNow = 2026-02-28T22:00:00-03:00 (BRT) = shiftKey 2026-02-28-PM
 *  - 36 leitos canônicos da Unidade A
 *  - Perfis especiais em beds reais (não leitos fake)
 *
 * Ref: docs/lean/SEED_LEAN_CONTRACT_2026-02-28.md
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const app = initializeApp({ projectId: 'lean-841e5' });
const db = getFirestore(app);
const auth = getAuth(app);

// ─────────────────────────────────────────────────────────────────────────────
// CLOCK FIXO — toda derivação de tempo parte daqui
// ─────────────────────────────────────────────────────────────────────────────
// 2026-02-28T22:00:00 BRT (America/Sao_Paulo, UTC-3) → UTC: 2026-03-01T01:00:00Z
const MOCK_NOW_ISO = '2026-03-01T01:00:00.000Z'; // UTC
const MOCK_NOW_MS = new Date(MOCK_NOW_ISO).getTime();

/** Returns an ISO string fixed at MOCK_NOW minus `hours` hours */
function msAgo(hours: number): string {
    return new Date(MOCK_NOW_MS - hours * 3_600_000).toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT KEYS
// ─────────────────────────────────────────────────────────────────────────────
// 22:00 BRT = 1320 min >= 1140 (PM_START 19:00) → PM do dia atual
const CURRENT_SHIFT_KEY = '2026-02-28-PM';
// PM revisa AM do mesmo dia (Huddle v1 contract) — turno anterior = 2026-02-28-AM
const PREV_SHIFT_KEY = '2026-02-28-AM';
// Turno ainda mais anterior (para huddle prev) = 2026-02-27-PM
const PREV_PREV_SHIFT_KEY = '2026-02-27-PM';

console.log('[seed:lean] mockNow:', MOCK_NOW_ISO);
console.log('[seed:lean] currentShiftKey:', CURRENT_SHIFT_KEY);
console.log('[seed:lean] prevShiftKey:', PREV_SHIFT_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// SEED ACTOR + USERS
// ─────────────────────────────────────────────────────────────────────────────
const SEED_ACTOR = { id: 'seed', name: 'System Seed' };

const SEED_USERS = [
    { email: 'admin@lean.com', password: 'password123', role: 'admin', name: 'Admin User' },
    { email: 'editor@lean.com', password: 'password123', role: 'editor', name: 'Editor User' },
    { email: 'viewer@lean.com', password: 'password123', role: 'viewer', name: 'Viewer User' },
];

// ─────────────────────────────────────────────────────────────────────────────
// KAMISHIBAI DOMAINS
// ─────────────────────────────────────────────────────────────────────────────
const ALL_DOMAINS = ['medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social'];

function makeKamishibaiOk(updatedAt: string, shiftKey: string = CURRENT_SHIFT_KEY) {
    return { status: 'ok', updatedAt, updatedBy: SEED_ACTOR, note: '', reviewedShiftKey: shiftKey, reviewedAt: updatedAt };
}
function makeKamishibaiBlocked(updatedAt: string, blockedAt: string, reason: string) {
    return { status: 'blocked', updatedAt, updatedBy: SEED_ACTOR, note: '', reviewedShiftKey: CURRENT_SHIFT_KEY, reviewedAt: updatedAt, blockedAt, reason };
}
function makeKamishibaiNa(updatedAt: string) {
    return { status: 'na', updatedAt, updatedBy: SEED_ACTOR, note: '' };
}
function makeKamishibaiAllOk(shiftKey: string = CURRENT_SHIFT_KEY) {
    return Object.fromEntries(ALL_DOMAINS.map(d => [d, makeKamishibaiOk(msAgo(1), shiftKey)]));
}

// ─────────────────────────────────────────────────────────────────────────────
// 36 BEDS CANÔNICOS DA UNIDADE A
// ─────────────────────────────────────────────────────────────────────────────
const CANONICAL_BED_NUMBERS = [
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
    '313.1', '313.2',
]; // 36 total

// ─────────────────────────────────────────────────────────────────────────────
// PERFIS ESPECIAIS (aplicados em beds reais)
// ─────────────────────────────────────────────────────────────────────────────
const SPECIAL_BEDS: Record<string, unknown> = {

    // ── 301.1 → UNREVIEWED ──────────────────────────────────────────────────
    // reviewedShiftKey = PREV_SHIFT_KEY → rende UNREVIEWED_THIS_SHIFT no turno PM
    '301.1': {
        id: 'bed_301.1', number: '301.1', unitId: 'A',
        patientAlias: 'U.R.',
        mainBlocker: '',
        expectedDischarge: '2-3_days',
        applicableDomains: ALL_DOMAINS,
        kamishibai: makeKamishibaiAllOk(PREV_SHIFT_KEY), // turno AM → não revisado no PM
        pendencies: [],
        updatedAt: msAgo(14), updatedBy: SEED_ACTOR,
    },

    // ── 301.2 → NOT_APPLICABLE ──────────────────────────────────────────────
    // psychology + social fora de applicableDomains → NOT_APPLICABLE
    '301.2': {
        id: 'bed_301.2', number: '301.2', unitId: 'A',
        patientAlias: 'N.A.',
        mainBlocker: '',
        expectedDischarge: '24h',
        applicableDomains: ['medical', 'nursing', 'physio', 'nutrition'],
        kamishibai: {
            medical: makeKamishibaiOk(msAgo(1), CURRENT_SHIFT_KEY),
            nursing: makeKamishibaiOk(msAgo(1), CURRENT_SHIFT_KEY),
            physio: makeKamishibaiOk(msAgo(2), CURRENT_SHIFT_KEY),
            nutrition: makeKamishibaiOk(msAgo(2), CURRENT_SHIFT_KEY),
            psychology: makeKamishibaiNa(msAgo(48)),
            social: makeKamishibaiNa(msAgo(48)),
        },
        pendencies: [],
        updatedAt: msAgo(1), updatedBy: SEED_ACTOR,
    },

    // ── 301.3 → PENDENCIES ──────────────────────────────────────────────────
    // Cobre todos os estados de pendência: open, overdue, done, canceled
    '301.3': {
        id: 'bed_301.3', number: '301.3', unitId: 'A',
        patientAlias: 'P.D.',
        mainBlocker: '',
        expectedDischarge: '2-3_days',
        applicableDomains: ALL_DOMAINS,
        kamishibai: makeKamishibaiAllOk(CURRENT_SHIFT_KEY),
        pendencies: [
            { id: 'PEND_3013_A1', title: 'Acompanhar hemoculturas pendentes (seed)', status: 'open', domain: 'medical', createdAt: msAgo(6), createdBy: SEED_ACTOR },
            { id: 'PEND_3013_A2_OVERDUE', title: 'Revisar ATB prescrito — prazo vencido (seed)', status: 'open', domain: 'nursing', dueAt: msAgo(13), createdAt: msAgo(24), createdBy: SEED_ACTOR },
            { id: 'PEND_3013_A3_DONE', title: 'Solicitar parecer dermatologia (seed)', status: 'done', domain: 'medical', doneAt: msAgo(4), doneBy: SEED_ACTOR, createdAt: msAgo(20), createdBy: SEED_ACTOR, updatedAt: msAgo(4), updatedBy: SEED_ACTOR },
            { id: 'PEND_3013_A4_CANCELED', title: 'Solicitar transf para UTI (seed)', status: 'canceled', domain: 'medical', note: 'Cancelado: paciente estabilizou (seed)', canceledAt: msAgo(8), canceledBy: SEED_ACTOR, createdAt: msAgo(36), createdBy: SEED_ACTOR, updatedAt: msAgo(8), updatedBy: SEED_ACTOR },
        ],
        updatedAt: msAgo(1), updatedBy: SEED_ACTOR,
    },

    // ── 302.1 → BLOCKED ─────────────────────────────────────────────────────
    // mainBlocker + 2 domínios kamishibai blocked, blockedAt mensurável
    '302.1': {
        id: 'bed_302.1', number: '302.1', unitId: 'A',
        patientAlias: 'B.K.',
        mainBlocker: 'Aguardando laudo RX (seed)',
        mainBlockerBlockedAt: msAgo(10),
        expectedDischarge: '>3_days',
        applicableDomains: ALL_DOMAINS,
        kamishibai: {
            medical: makeKamishibaiBlocked(msAgo(10), msAgo(10), 'Aguardando avaliação médica urgente (seed)'),
            nursing: makeKamishibaiOk(msAgo(1), CURRENT_SHIFT_KEY),
            physio: makeKamishibaiBlocked(msAgo(8), msAgo(8), 'Fisioterapia bloqueada por risco de queda (seed)'),
            nutrition: makeKamishibaiOk(msAgo(2), CURRENT_SHIFT_KEY),
            psychology: makeKamishibaiOk(msAgo(3), CURRENT_SHIFT_KEY),
            social: makeKamishibaiOk(msAgo(4), CURRENT_SHIFT_KEY),
        },
        pendencies: [
            { id: 'PEND_3021_B1', title: 'Solicitar RX de tórax atualizado (seed)', status: 'open', domain: 'medical', createdAt: msAgo(10), createdBy: SEED_ACTOR },
        ],
        updatedAt: msAgo(1), updatedBy: SEED_ACTOR,
    },

    // ── 303 → ESCALATION-01 (overdue critical) ───────────────────────────────
    // dueAt = MOCK_NOW - 14h ≥ threshold 12h → overdue critical
    '303': {
        id: 'bed_303', number: '303', unitId: 'A',
        patientAlias: 'P. Overdue (seed)',
        mainBlocker: '',
        expectedDischarge: 'later',
        applicableDomains: ALL_DOMAINS,
        kamishibai: makeKamishibaiAllOk(CURRENT_SHIFT_KEY),
        pendencies: [
            { id: 'PEND_303_ESC01_OVERDUE', title: 'TC Tórax com contraste urgente (seed)', status: 'open', domain: 'medical', dueAt: msAgo(14), note: 'Exame agendado, desmarcado por ausência de jejum (seed)', createdAt: msAgo(20), createdBy: SEED_ACTOR },
        ],
        updatedAt: msAgo(1), updatedBy: SEED_ACTOR,
    },

    // ── 304.1 → ESCALATION-02 (blocker critical) ─────────────────────────────
    // mainBlockerBlockedAt = MOCK_NOW - 29h ≥ threshold 24h → blocker critical
    '304.1': {
        id: 'bed_304.1', number: '304.1', unitId: 'A',
        patientAlias: 'P. Blocker (seed)',
        mainBlocker: 'Aguardando CTI (seed)',
        mainBlockerBlockedAt: msAgo(29),
        expectedDischarge: 'later',
        applicableDomains: ALL_DOMAINS,
        kamishibai: {
            medical: makeKamishibaiBlocked(msAgo(29), msAgo(29), 'Transferência CTI bloqueada (seed)'),
            nursing: makeKamishibaiOk(msAgo(1), CURRENT_SHIFT_KEY),
            physio: makeKamishibaiOk(msAgo(2), CURRENT_SHIFT_KEY),
            nutrition: makeKamishibaiOk(msAgo(2), CURRENT_SHIFT_KEY),
            psychology: makeKamishibaiOk(msAgo(3), CURRENT_SHIFT_KEY),
            social: makeKamishibaiOk(msAgo(3), CURRENT_SHIFT_KEY),
        },
        pendencies: [],
        updatedAt: msAgo(1), updatedBy: SEED_ACTOR,
    },

    // ── 304.2 → ESCALATION-03 (ambos: overdue + blocker) ─────────────────────
    // Aparece nos dois grupos mas conta 1 no total
    '304.2': {
        id: 'bed_304.2', number: '304.2', unitId: 'A',
        patientAlias: 'P. Ambos (seed)',
        mainBlocker: 'Social pendente (seed)',
        mainBlockerBlockedAt: msAgo(26),
        expectedDischarge: 'later',
        applicableDomains: ALL_DOMAINS,
        kamishibai: {
            medical: makeKamishibaiOk(msAgo(1), CURRENT_SHIFT_KEY),
            nursing: makeKamishibaiOk(msAgo(1), CURRENT_SHIFT_KEY),
            physio: makeKamishibaiOk(msAgo(2), CURRENT_SHIFT_KEY),
            nutrition: makeKamishibaiOk(msAgo(2), CURRENT_SHIFT_KEY),
            psychology: makeKamishibaiOk(msAgo(3), CURRENT_SHIFT_KEY),
            social: makeKamishibaiBlocked(msAgo(26), msAgo(26), 'Aguardando encaminhamento social (seed)'),
        },
        pendencies: [
            { id: 'PEND_3042_ESC03_OVERDUE', title: 'Contatar família responsável (seed)', status: 'open', domain: 'social', dueAt: msAgo(13), createdAt: msAgo(30), createdBy: SEED_ACTOR },
        ],
        updatedAt: msAgo(1), updatedBy: SEED_ACTOR,
    },

    // ── 308 → EMPTY ─────────────────────────────────────────────────────────
    // patientAlias='' → INACTIVE (sem badges, sem dots)
    '308': {
        id: 'bed_308', number: '308', unitId: 'A',
        patientAlias: '',
        mainBlocker: '',
        expectedDischarge: 'later',
        applicableDomains: ALL_DOMAINS,
        kamishibai: {},
        pendencies: [],
        updatedAt: msAgo(2), updatedBy: SEED_ACTOR,
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// PRNG SEEDADO (Linear Congruential Generator)
// Seed fixo → mesma sequência a cada execução
// ─────────────────────────────────────────────────────────────────────────────
function makePrng(seedStr: string): () => number {
    // Hash djb2 da seed string para um número inteiro inicial
    let seed = 5381;
    for (let i = 0; i < seedStr.length; i++) {
        seed = ((seed * 33) ^ seedStr.charCodeAt(i)) >>> 0;
    }
    return function lcg() {
        seed = ((seed * 1664525) + 1013904223) >>> 0;
        return seed / 0x100000000;
    };
}

const prng = makePrng('LEAN-TESTS-UNIT-A-2026-02-28');

function prngInt(min: number, max: number): number {
    return Math.floor(prng() * (max - min + 1)) + min;
}

function prngChoice<T>(arr: T[]): T {
    return arr[Math.floor(prng() * arr.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// GERADOR DE BEDS GENÉRICOS (PRNG)
// ─────────────────────────────────────────────────────────────────────────────
const DISCHARGE_OPTIONS = ['24h', '2-3_days', '>3_days', 'later'];
const PATIENT_ALIASES = ['M.S.', 'R.P.', 'J.A.', 'C.L.', 'T.F.', 'A.B.', 'L.G.', 'P.N.', 'F.C.', 'E.M.'];

function generateGenericBed(bedNumber: string): Record<string, unknown> {
    const bedId = `bed_${bedNumber}`;
    // 75% ocupado, 25% vazio (determinístico via PRNG)
    const occupied = prng() < 0.75;
    const patientAlias = occupied ? prngChoice(PATIENT_ALIASES) : '';
    const expectedDischarge = occupied ? prngChoice(DISCHARGE_OPTIONS) : 'later';

    // Kamishibai: se ocupado, gerar por domínio
    const kamishibai: Record<string, unknown> = {};
    const pendencies: unknown[] = [];

    if (occupied) {
        // applicableDomains: 90% todos, 10% excluir 1 domínio aleatório
        const excludeDomain = prng() < 0.1 ? prngChoice(['psychology', 'social']) : null;
        const applicableDomains = excludeDomain
            ? ALL_DOMAINS.filter(d => d !== excludeDomain)
            : ALL_DOMAINS;

        for (const domain of ALL_DOMAINS) {
            if (!applicableDomains.includes(domain)) {
                // Domínio não aplicável
                kamishibai[domain] = makeKamishibaiNa(msAgo(48));
            } else {
                // 85% ok, 15% blocked
                const isBlocked = prng() < 0.15;
                // 50% revisado no turno atual, 50% turno anterior (para garantir unreviewed espalhado)
                const shiftKey = prng() < 0.5 ? CURRENT_SHIFT_KEY : PREV_SHIFT_KEY;
                const hoursAgo = prngInt(1, 12);
                if (isBlocked) {
                    const blockedHours = prngInt(2, 20);
                    kamishibai[domain] = makeKamishibaiBlocked(msAgo(hoursAgo), msAgo(blockedHours), `Bloqueio ${domain} (seed prng)`);
                } else {
                    kamishibai[domain] = makeKamishibaiOk(msAgo(hoursAgo), shiftKey);
                }
            }
        }

        // Pendências: 0 a 2 por bed (determinístico)
        const pendCount = prngInt(0, 2);
        for (let i = 1; i <= pendCount; i++) {
            const isOverdue = prng() < 0.2;
            const pend: Record<string, unknown> = {
                id: `PEND_${bedNumber.replace('.', '_')}_P${i}`,
                title: `Pendência ${i} do leito ${bedNumber} (seed prng)`,
                status: 'open',
                domain: prngChoice(ALL_DOMAINS),
                createdAt: msAgo(prngInt(4, 30)),
                createdBy: SEED_ACTOR,
            };
            if (isOverdue) {
                // dueAt 8-11h atrás — abaixo do threshold crítico 12h (não escalona acidentalmente)
                pend.dueAt = msAgo(prngInt(8, 11));
            }
            pendencies.push(pend);
        }

        // mainBlocker: 10% chance de ter bloqueio, mas com aging < 24h (não escalona)
        const hasMainBlocker = prng() < 0.1;
        if (hasMainBlocker) {
            return {
                id: bedId, number: bedNumber, unitId: 'A',
                patientAlias,
                mainBlocker: `Bloqueio principal ${bedNumber} (seed prng)`,
                mainBlockerBlockedAt: msAgo(prngInt(2, 20)), // < 24h threshold → não escalona
                expectedDischarge, applicableDomains,
                kamishibai, pendencies,
                updatedAt: msAgo(1), updatedBy: SEED_ACTOR,
            };
        }

        return {
            id: bedId, number: bedNumber, unitId: 'A',
            patientAlias, mainBlocker: '',
            expectedDischarge, applicableDomains,
            kamishibai, pendencies,
            updatedAt: msAgo(1), updatedBy: SEED_ACTOR,
        };
    }

    // Vazio
    return {
        id: bedId, number: bedNumber, unitId: 'A',
        patientAlias: '', mainBlocker: '',
        expectedDischarge: 'later', applicableDomains: ALL_DOMAINS,
        kamishibai: {}, pendencies: [],
        updatedAt: msAgo(prngInt(1, 24)), updatedBy: SEED_ACTOR,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTAR LISTA DE 36 BEDS
// ─────────────────────────────────────────────────────────────────────────────
const BEDS: Record<string, unknown>[] = CANONICAL_BED_NUMBERS.map(num => {
    if (SPECIAL_BEDS[num]) return SPECIAL_BEDS[num] as Record<string, unknown>;
    return generateGenericBed(num);
});

// ─────────────────────────────────────────────────────────────────────────────
// HUDDLES DETERMINÍSTICOS
// ─────────────────────────────────────────────────────────────────────────────
const PREV_HUDDLE_DOC = {
    id: `HUDDLE_${PREV_PREV_SHIFT_KEY}`,
    unitId: 'A',
    shiftKey: PREV_PREV_SHIFT_KEY,
    createdAt: msAgo(22), createdBy: SEED_ACTOR,
    startedAt: msAgo(22), startedBy: SEED_ACTOR,
    endedAt: msAgo(21.5), endedBy: SEED_ACTOR,
    checklist: [
        { id: 'chk1', label: '1. Equipe completa?', checked: true },
        { id: 'chk2', label: '2. Escalonamentos revisados?', checked: true },
    ],
    topActions: [
        { id: 'ACT_PREV_OPEN_1', text: 'Alinhar com CCIH sobre leitos de isolamento (seed)', status: 'open', owner: 'Enf. Maria', createdAt: msAgo(22), createdBy: SEED_ACTOR },
        { id: 'ACT_PREV_OPEN_2', text: 'Cobrar manutenção da maca do quarto 305 (seed)', status: 'open', owner: 'Admin', createdAt: msAgo(22), createdBy: SEED_ACTOR },
    ],
    startSummary: { generatedAt: msAgo(22), shiftKey: PREV_PREV_SHIFT_KEY, source: 'seed', blockedBedsCount: 5, maxBlockedAgingHours: 28, dischargeNext24hCount: 2, unreviewedBedsCount: 4, escalationsOverdueCritical: 3, escalationsBlockerCritical: 2, totalEscalations: 4, overduePendenciesCount: 8 },
    endSummary: { generatedAt: msAgo(21.5), shiftKey: PREV_PREV_SHIFT_KEY, source: 'seed', blockedBedsCount: 4, maxBlockedAgingHours: 28, dischargeNext24hCount: 3, unreviewedBedsCount: 0, escalationsOverdueCritical: 1, escalationsBlockerCritical: 1, totalEscalations: 2, overduePendenciesCount: 5 },
};

const CURRENT_HUDDLE_DOC = {
    id: `HUDDLE_${PREV_SHIFT_KEY}`,
    unitId: 'A',
    shiftKey: PREV_SHIFT_KEY,
    createdAt: msAgo(10), createdBy: SEED_ACTOR,
    startedAt: msAgo(10), startedBy: SEED_ACTOR,
    endedAt: msAgo(9.5), endedBy: SEED_ACTOR,
    checklist: [
        { id: 'chk1', label: '1. Equipe completa?', checked: true },
        { id: 'chk2', label: '2. Escalonamentos revisados?', checked: true },
    ],
    topActions: [
        { id: 'ACT_CUR_DONE_1', text: 'Resolver pedido de laudo RX pendente (seed)', status: 'done', owner: 'Dr. Santos', createdAt: msAgo(10), createdBy: SEED_ACTOR, completedAt: msAgo(8), completedBy: SEED_ACTOR },
    ],
    startSummary: { generatedAt: msAgo(10), shiftKey: PREV_SHIFT_KEY, source: 'seed', blockedBedsCount: 4, maxBlockedAgingHours: 18, dischargeNext24hCount: 3, unreviewedBedsCount: 2, escalationsOverdueCritical: 2, escalationsBlockerCritical: 1, totalEscalations: 3, overduePendenciesCount: 5 },
    endSummary: { generatedAt: msAgo(9.5), shiftKey: PREV_SHIFT_KEY, source: 'seed', blockedBedsCount: 3, maxBlockedAgingHours: 18, dischargeNext24hCount: 4, unreviewedBedsCount: 0, escalationsOverdueCritical: 2, escalationsBlockerCritical: 1, totalEscalations: 3, overduePendenciesCount: 4 },
};

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
async function deleteCollection(collRef: FirebaseFirestore.CollectionReference) {
    const snap = await collRef.get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`  🗑️  Deleted ${snap.size} docs from ${collRef.path}`);
}

async function seed() {
    console.log('\n🌱 [seed:lean v2] Starting DETERMINISTIC Lean Seed — 36 beds...');
    console.log(`   mockNow = ${MOCK_NOW_ISO} (BRT 2026-02-28T22:00:00-03:00)`);
    console.log(`   currentShiftKey = ${CURRENT_SHIFT_KEY}`);
    console.log(`   prevShiftKey = ${PREV_SHIFT_KEY}\n`);

    // ── 1. Users (idempotente) ───────────────────────────────────────────────
    console.log('👤 [seed:lean] Ensuring auth users...');
    for (const user of SEED_USERS) {
        try {
            const rec = await auth.createUser({ email: user.email, password: user.password, displayName: user.name });
            await db.collection('users').doc(rec.uid).set({ uid: rec.uid, email: user.email, role: user.role, name: user.name, createdAt: msAgo(0) });
            await db.collection('authorized_users').doc(rec.uid).set({ email: user.email, addedAt: msAgo(0) });
            console.log(`  ✅ Created: ${user.email} (${user.role})`);
        } catch (e: unknown) {
            const err = e as { code?: string; message?: string };
            if (err.code === 'auth/email-already-exists') {
                const existing = await auth.getUserByEmail(user.email);
                await db.collection('users').doc(existing.uid).set({ uid: existing.uid, email: user.email, role: user.role, name: user.name, createdAt: msAgo(0) }, { merge: true });
                await db.collection('authorized_users').doc(existing.uid).set({ email: user.email, addedAt: msAgo(0) }, { merge: true });
                console.log(`  ℹ️  Already exists (updated): ${user.email}`);
            } else {
                console.error(`  ❌ Error: ${user.email}`, err.message);
            }
        }
    }

    // ── 2. Unit A ────────────────────────────────────────────────────────────
    console.log('\n🏥 [seed:lean] Creating unit A...');
    await db.collection('units').doc('A').set({ id: 'A', name: 'Unidade A', totalBeds: BEDS.length, specialties: ALL_DOMAINS });

    for (const user of SEED_USERS) {
        const rec = await auth.getUserByEmail(user.email);
        await db.collection('units').doc('A').collection('users').doc(rec.uid).set({ uid: rec.uid, email: user.email, role: user.role, name: user.name, addedAt: msAgo(0) });
    }
    console.log(`  ✅ Unit A created (${BEDS.length} beds, users linked)`);

    // ── 3. Settings fixos ────────────────────────────────────────────────────
    console.log('\n⚙️  [seed:lean] Writing settings...');
    await db.collection('units').doc('A').collection('settings').doc('board').set({
        unitId: 'A', rotationEnabled: true,
        screens: [
            { key: 'kanban', label: 'Quadro Kanban', durationSeconds: 15, enabled: true },
            { key: 'kamishibai', label: 'Quadro Kamishibai', durationSeconds: 15, enabled: true },
            { key: 'summary', label: 'Resumo da Unidade', durationSeconds: 10, enabled: true },
        ],
    });

    await db.collection('units').doc('A').collection('settings').doc('ops').set({
        kanbanMode: 'ACTIVE_LITE',
        kamishibaiEnabled: true,
        huddleSchedule: { amStart: '07:00', pmStart: '19:00' },
        // CORRETO: lastHuddleShiftKey = CURRENT_SHIFT_KEY (o PM é o turno atual e já tem huddle registrado)
        lastHuddleShiftKey: CURRENT_SHIFT_KEY,
    });

    // CORRETO: chaves exatas lidas pelo computeEscalations / parseMissionControlThresholds
    await db.collection('units').doc('A').collection('settings').doc('mission_control').set({
        // Escalação (chaves exatas do domínio escalation.ts)
        escalationOverdueHoursWarning: 6,
        escalationOverdueHoursCritical: 12,
        escalationMainBlockerHoursWarning: 8,
        escalationMainBlockerHoursCritical: 24,
        // KPI — Bloqueados
        blockedPctWarning: 20,
        blockedPctCritical: 35,
        blockedAgingWarningHours: 12,
        blockedAgingCriticalHours: 24,
        // Kamishibai impedimentos
        kamishibaiImpedimentPctWarning: 15,
        kamishibaiImpedimentPctCritical: 30,
        // Freshness
        freshness12hWarningCount: 5,
        freshness24hWarningCount: 1,
        freshness24hCriticalCount: 3,
        freshness48hCriticalCount: 1,
        // Não revisados
        unreviewedShiftWarningCount: 3,
        unreviewedShiftCriticalCount: 6,
        _seededAt: MOCK_NOW_ISO,
        _note: 'seed:lean v2 deterministic thresholds',
    });
    console.log('  ✅ Settings written (ops, board, mission_control)');

    // ── 4. Limpar e semear beds ──────────────────────────────────────────────
    console.log('\n🛏️  [seed:lean] Clearing beds...');
    await deleteCollection(db.collection('units').doc('A').collection('beds'));

    console.log(`🛏️  [seed:lean] Seeding ${BEDS.length} beds...`);
    let specialCount = 0;
    let genericCount = 0;
    for (const bed of BEDS) {
        await db.collection('units').doc('A').collection('beds').doc(bed.id as string).set(bed);
        const isSpecial = Object.keys(SPECIAL_BEDS).includes(bed.number as string);
        if (isSpecial) specialCount++; else genericCount++;
    }
    console.log(`  ✅ ${BEDS.length} beds seeded (${specialCount} special + ${genericCount} generic prng)`);

    // ── 5. Limpar e semear huddles ───────────────────────────────────────────
    console.log('\n🗣️  [seed:lean] Clearing huddles...');
    await deleteCollection(db.collection('units').doc('A').collection('huddles'));

    console.log('🗣️  [seed:lean] Seeding huddles...');
    await db.collection('units').doc('A').collection('huddles').doc(PREV_HUDDLE_DOC.id).set(PREV_HUDDLE_DOC);
    console.log(`  ✅ Prev Huddle (${PREV_HUDDLE_DOC.id}) seeded`);

    await db.collection('units').doc('A').collection('huddles').doc(CURRENT_HUDDLE_DOC.id).set(CURRENT_HUDDLE_DOC);
    console.log(`  ✅ AM Huddle (${CURRENT_HUDDLE_DOC.id}) seeded`);

    // ── 6. Summary ───────────────────────────────────────────────────────────
    const specialKeys = Object.keys(SPECIAL_BEDS);
    console.log('\n✨ [seed:lean v2] DONE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  mockNow:          ${MOCK_NOW_ISO}`);
    console.log(`  currentShiftKey:  ${CURRENT_SHIFT_KEY}`);
    console.log(`  prevShiftKey:     ${PREV_SHIFT_KEY}`);
    console.log(`  beds:             ${BEDS.length} total`);
    console.log(`  special beds:     ${specialKeys.join(', ')}`);
    console.log(`  generic beds:     ${BEDS.length - specialKeys.length} (PRNG seed: LEAN-TESTS-UNIT-A-2026-02-28)`);
    console.log('  huddles:          HUDDLE_2026-02-27-PM, HUDDLE_2026-02-28-AM');
    console.log('  lastHuddleShiftKey: 2026-02-28-PM (CURRENT — turno atual)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Emulator UI: http://localhost:4000');
    console.log('  TV Dashboard: http://localhost:5173/tv?unit=A');
    process.exit(0);
}

seed().catch(err => {
    console.error('[seed:lean] 💥 Failed:', err);
    process.exit(1);
});
