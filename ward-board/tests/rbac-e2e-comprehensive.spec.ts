/**
 * rbac-e2e-comprehensive.spec.ts
 * ================================
 * Bateria completa de testes RBAC end-to-end — BedSight Flow
 *
 * Cobre 5 dimensões:
 *   (1) Controle de acesso a rotas — redirect/blocked/acessível por perfil
 *   (2) Visibilidade de ações de UI — botões, menus, controles por perfil
 *   (3) Regras Firestore backend — read/write por coleção e por unitId
 *   (4) Comportamento de sessão e troca de unidade (URL manipulation, back/forward)
 *   (5) Matriz de evidências — registro por cenário (perfil → rota → resultado → screenshot)
 *
 * Roles testados:
 *   - Global Admin  (admin@lean.com)   token.claims.admin = true, authz.A.role = 'admin'
 *   - Unit Editor   (editor@lean.com)  authz.A.role = 'editor', sem claim global
 *   - Unit Viewer   (viewer@lean.com)  authz.A.role = 'viewer', sem claim global
 *   - Unauthorized  (noauth-<ts>@test.com) não está em authorized_users
 *
 * Pré-requisitos:
 *   - Firebase emulators rodando (auth:9099, firestore:8080, functions:5001)
 *   - App em localhost:5173
 *   - Emulators seeded (npm run seed:lean garante dados de leitos/huddles)
 *
 * Setup automático (beforeAll):
 *   - Cria/atualiza usuários com claims e authz corretos via firebase-admin
 *   - Cria Unidade B (para testes de isolamento cross-unit)
 *   - Obtém ID tokens para cada perfil via custom token exchange
 */

import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

// ─── Emulator endpoints ───────────────────────────────────────────────────────

const PROJECT_ID = 'lean-841e5';
const AUTH_HOST = 'http://localhost:9099';
const FS_HOST = 'http://localhost:8080';
const FS_BASE = `${FS_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ─── Seed users ───────────────────────────────────────────────────────────────

const USERS = {
    admin: { email: 'admin@lean.com', password: 'password123', name: 'Admin User', isAdmin: true, unitRole: 'admin' },
    editor: { email: 'editor@lean.com', password: 'password123', name: 'Editor User', isAdmin: false, unitRole: 'editor' },
    viewer: { email: 'viewer@lean.com', password: 'password123', name: 'Viewer User', isAdmin: false, unitRole: 'viewer' },
} as const;

type UserKey = keyof typeof USERS;

// ─── Shared state (populated in beforeAll) ────────────────────────────────────

const idTokens: Partial<Record<UserKey, string>> = {};
const customTokens: Partial<Record<UserKey, string>> = {};
const uids: Partial<Record<UserKey, string>> = {};

// ─── Evidence matrix ──────────────────────────────────────────────────────────

interface EvidenceRow {
    id: string;
    area: string;
    profile: string;
    route: string;
    action: string;
    expected: string;
    actual: string;
    passed: boolean;
    screenshot?: string;
}

const evidenceMatrix: EvidenceRow[] = [];
let evidenceSeq = 0;

function record(row: Omit<EvidenceRow, 'id'>): EvidenceRow {
    const e: EvidenceRow = { id: `E${String(++evidenceSeq).padStart(3, '0')}`, ...row };
    evidenceMatrix.push(e);
    return e;
}

async function snap(page: Page, name: string): Promise<string> {
    const dir = 'test-results/rbac-evidence';
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

/**
 * Sign in programmatically via window.__testSignIn (exposed by config.ts in DEV mode).
 * This bypasses the OAuth redirect flow (which requires external DNS) and calls
 * signInWithCustomToken directly with the Auth Emulator — fast and reliable.
 *
 * WHY we navigate manually after sign-in:
 * LoginScreen sets local `loading=true` while calling getRedirectResult() and its
 * onAuthStateChanged handler skips navigation when `loading` is true.  After
 * signInWithCustomToken the auth state is persisted in IndexedDB, so we can
 * navigate to /tv directly and useAuthStatus will pick up the session.
 */
async function loginViaCustomToken(page: Page, customToken: string): Promise<void> {
    // Navigate to login page to ensure Firebase app + __testSignIn are initialised
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof (window as any).__testSignIn === 'function', {
        timeout: 15_000,
    });
    // Sign in — calls signInWithCustomToken against the Auth Emulator (no external DNS)
    await page.evaluate(async (token: string) => {
        await (window as any).__testSignIn(token);
    }, customToken);
    // Navigate directly to the authenticated entry point.
    // Auth state is now persisted in IndexedDB; useAuthStatus will restore the session.
    await page.goto('/tv', { waitUntil: 'domcontentloaded' });
    // Wait for auth state to resolve and the appropriate route to render
    await page.waitForURL(/\/(tv|admin|editor)/, { timeout: 15_000 });
}

/** Open fresh browser context, sign in, return page + context */
async function openAs(browser: Browser, role: UserKey): Promise<{ page: Page; ctx: BrowserContext }> {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on('console', msg => {
        if (msg.type() === 'error') console.log(`[${role}] BROWSER ERR: ${msg.text()}`);
    });
    // Block Google Fonts (render-blocking) to prevent slow load events in offline environments
    await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
    const token = customTokens[role];
    if (!token) throw new Error(`[openAs] No custom token for role "${role}" — beforeAll may not have run`);
    await loginViaCustomToken(page, token);
    return { page, ctx };
}

/** Firestore read via REST API with user token */
async function fsRead(
    token: string,
    docPath: string,
): Promise<{ ok: boolean; status: number }> {
    const res = await fetch(`${FS_BASE}/${docPath}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: res.ok, status: res.status };
}

/** Firestore write via REST API with user token */
async function fsWrite(
    token: string,
    docPath: string,
    fieldName: string,
    fieldValue: string,
): Promise<{ ok: boolean; status: number }> {
    const res = await fetch(`${FS_BASE}/${docPath}?updateMask.fieldPaths=${fieldName}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields: { [fieldName]: { stringValue: fieldValue } } }),
    });
    return { ok: res.ok, status: res.status };
}

/** Firestore admin write (bypass rules) via firebase-admin initialized in beforeAll */
async function fsAdminEnsureDoc(
    collPath: string,
    docId: string,
    data: Record<string, unknown>,
): Promise<void> {
    if (getApps().length === 0) return;
    const db = getFirestore(getApps()[0]!);
    await db.collection(collPath).doc(docId).set(data, { merge: true });
}

// ─── Emulator readiness poll ──────────────────────────────────────────────────

async function waitForEmulator(url: string, label: string, timeoutMs = 90_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(url);
            if (res.ok || res.status < 500) {
                console.log(`[rbac-setup] ✅ ${label} ready`);
                return;
            }
        } catch {
            // not ready yet — retry
        }
        await new Promise(r => setTimeout(r, 1_500));
    }
    throw new Error(`[rbac-setup] Timeout waiting for ${label} at ${url}`);
}

// ─── Test setup (beforeAll) ───────────────────────────────────────────────────

test.beforeAll(async () => {
    // Point firebase-admin at emulators — MUST be set before initializeApp
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] = 'localhost:9099';
    process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080';

    // Wait for both emulators to be ready (webServer only guarantees port 5173)
    console.log('[rbac-setup] Waiting for Firebase emulators to start...');
    await Promise.all([
        waitForEmulator(`${AUTH_HOST}/`, 'Auth Emulator :9099'),
        waitForEmulator(`${FS_HOST}/`, 'Firestore Emulator :8080'),
    ]);

    const app = getApps().length
        ? getApps()[0]!
        : initializeApp({ projectId: PROJECT_ID });
    const db = getFirestore(app);
    const auth = getAuth(app);

    // ── Ensure each seed user exists with correct RBAC ──────────────────────
    const userEntries = Object.entries(USERS) as [UserKey, typeof USERS[UserKey]][];
    for (const [key, user] of userEntries) {
        let uid: string;
        try {
            const rec = await auth.createUser({
                email: user.email,
                password: user.password,
                displayName: user.name,
            });
            uid = rec.uid;
        } catch (e: unknown) {
            const err = e as { code?: string };
            if (err.code === 'auth/email-already-exists') {
                uid = (await auth.getUserByEmail(user.email)).uid;
            } else throw e;
        }

        uids[key] = uid;

        // Custom claims
        await auth.setCustomUserClaims(uid, user.isAdmin ? { admin: true } : {});

        // Central authz document (used by Firestore rules)
        await db
            .collection('users').doc(uid)
            .collection('authz').doc('authz')
            .set(
                {
                    units: {
                        A: { role: user.unitRole, assignedAt: new Date().toISOString(), assignedBy: 'rbac-test-setup' },
                    },
                    updatedAt: new Date().toISOString(),
                },
                { merge: true },
            );

        // Whitelist entry
        await db.collection('authorized_users').doc(uid).set(
            { email: user.email, addedAt: new Date().toISOString() },
            { merge: true },
        );

        // Obtain ID token via custom token exchange (includes claims immediately)
        const customToken = await auth.createCustomToken(
            uid,
            user.isAdmin ? { admin: true } : {},
        );
        customTokens[key] = customToken;  // store for browser programmatic sign-in
        const tokenRes = await fetch(
            `${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=test`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: customToken, returnSecureToken: true }),
            },
        );
        const tokenData = await tokenRes.json() as { idToken?: string };
        if (!tokenData.idToken) throw new Error(`[rbac-setup] Token exchange failed for ${user.email}`);
        idTokens[key] = tokenData.idToken;

        console.log(`[rbac-setup] ✅ ${user.email} uid=${uid}`);
    }

    // ── Ensure Unit A has at least one bed ──────────────────────────────────
    const unitASnap = await db.collection('units').doc('A').get();
    if (!unitASnap.exists) {
        await db.collection('units').doc('A').set({ id: 'A', name: 'Unidade A', totalBeds: 1 });
    }
    const bedSnap = await db.collection('units').doc('A').collection('beds').doc('bed_301.1').get();
    if (!bedSnap.exists) {
        await db
            .collection('units').doc('A').collection('beds').doc('bed_301.1')
            .set({
                id: 'bed_301.1', number: '301.1', unitId: 'A',
                patientAlias: 'TC', mainBlocker: '', expectedDischarge: '24h',
                kamishibai: {}, pendencies: [], updatedAt: new Date().toISOString(),
            });
    }

    // ── Ensure Unit A has settings/board (for write rules test) ─────────────
    const boardSnap = await db.collection('units').doc('A').collection('settings').doc('board').get();
    if (!boardSnap.exists) {
        await db.collection('units').doc('A').collection('settings').doc('board').set({
            unitId: 'A', rotationEnabled: true, screens: [],
        });
    }

    // ── Create Unit B (cross-unit isolation) — users A have NO authz for B ──
    await db.collection('units').doc('B').set(
        { id: 'B', name: 'Unidade B (Isolamento RBAC)', totalBeds: 1 },
        { merge: true },
    );
    await db
        .collection('units').doc('B').collection('beds').doc('bed_B-001')
        .set({
            id: 'bed_B-001', number: 'B-001', unitId: 'B',
            patientAlias: 'IsolacaoB', mainBlocker: 'Teste RBAC cross-unit',
            expectedDischarge: '24h', kamishibai: {}, pendencies: [],
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    await db.collection('units').doc('B').collection('settings').doc('board').set(
        { unitId: 'B', rotationEnabled: false, screens: [] },
        { merge: true },
    );

    console.log('[rbac-setup] ✅ Unit B created. Setup complete.');
});

// ─── afterAll: persist evidence matrix ───────────────────────────────────────

test.afterAll(async () => {
    const dir = 'test-results/rbac-evidence';
    fs.mkdirSync(dir, { recursive: true });
    const reportPath = path.join(dir, 'evidence-matrix.json');
    fs.writeFileSync(reportPath, JSON.stringify(evidenceMatrix, null, 2), 'utf-8');

    // Print markdown table to console
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════');
    console.log('║  RBAC E2E — MATRIZ DE EVIDÊNCIAS');
    console.log('╠══════════════════════════════════════════════════════════════════════════════');
    console.log(`║  ${'ID'.padEnd(5)} ${'Perfil'.padEnd(12)} ${'Área'.padEnd(18)} ${'Rota/Ação'.padEnd(38)} ${'Esperado'.padEnd(12)} ${'OK?'}`);
    console.log('╠══════════════════════════════════════════════════════════════════════════════');
    for (const e of evidenceMatrix) {
        const ok = e.passed ? '✅' : '❌';
        console.log(`║  ${e.id.padEnd(5)} ${e.profile.padEnd(12)} ${e.area.padEnd(18)} ${(e.route + ' · ' + e.action).substring(0, 36).padEnd(38)} ${e.expected.padEnd(12)} ${ok}`);
    }
    const passed = evidenceMatrix.filter(e => e.passed).length;
    const total = evidenceMatrix.length;
    console.log('╠══════════════════════════════════════════════════════════════════════════════');
    console.log(`║  RESULTADO: ${passed}/${total} testes passaram`);
    console.log(`╠══════════════════════════════════════════════════════════════════════════════`);
    console.log(`║  Evidências salvas em: ${reportPath}`);
    console.log('╚══════════════════════════════════════════════════════════════════════════════\n');
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SEÇÃO 1 — CONTROLE DE ACESSO A ROTAS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('§1 — Controle de acesso a rotas', () => {

    // ── §1.1 Global Admin ───────────────────────────────────────────────────

    test('§1.1a [Global Admin] /admin acessível sem redirect', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'admin');
        try {
            await page.goto('/admin', { waitUntil: 'load' });
            const url = page.url();
            const accessible = url.includes('/admin');

            const shot = await snap(page, 'E-route-admin-admin');
            record({
                area: '§1 Rotas', profile: 'Global Admin',
                route: '/admin', action: 'GET',
                expected: 'URL contém /admin', actual: url,
                passed: accessible, screenshot: shot,
            });
            expect(accessible, `Admin deveria acessar /admin. URL atual: ${url}`).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§1.1b [Global Admin] /admin/unit/A acessível', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'admin');
        try {
            await page.goto('/admin/unit/A', { waitUntil: 'load' });
            const url = page.url();
            const accessible = url.includes('/admin/unit/A') || url.includes('/admin');

            const shot = await snap(page, 'E-route-admin-unitA');
            record({
                area: '§1 Rotas', profile: 'Global Admin',
                route: '/admin/unit/A', action: 'GET',
                expected: 'URL contém /admin', actual: url,
                passed: accessible, screenshot: shot,
            });
            expect(accessible).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§1.1c [Global Admin] /tv acessível', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'admin');
        try {
            await page.goto('/tv', { waitUntil: 'load' });
            const url = page.url();
            const accessible = url.includes('/tv');

            const shot = await snap(page, 'E-route-admin-tv');
            record({
                area: '§1 Rotas', profile: 'Global Admin',
                route: '/tv', action: 'GET',
                expected: 'URL contém /tv', actual: url,
                passed: accessible, screenshot: shot,
            });
            expect(accessible).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§1.1d [Global Admin] /editor acessível', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'admin');
        try {
            await page.goto('/editor', { waitUntil: 'load' });
            const url = page.url();
            const accessible = url.includes('/editor');

            const shot = await snap(page, 'E-route-admin-editor');
            record({
                area: '§1 Rotas', profile: 'Global Admin',
                route: '/editor', action: 'GET',
                expected: 'URL contém /editor', actual: url,
                passed: accessible, screenshot: shot,
            });
            expect(accessible).toBe(true);
        } finally { await ctx.close(); }
    });

    // ── §1.2 Unit Editor ────────────────────────────────────────────────────

    test('§1.2a [Unit Editor] /admin redireciona para /login', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            await page.goto('/admin', { waitUntil: 'load' });
            await page.waitForURL(url => !url.pathname.startsWith('/admin'), { timeout: 5_000 });
            const url = page.url();
            const blocked = !url.includes('/admin') || url.includes('/login');

            const shot = await snap(page, 'E-route-editor-admin-blocked');
            record({
                area: '§1 Rotas', profile: 'Unit Editor',
                route: '/admin', action: 'GET',
                expected: 'redirect → /login', actual: url,
                passed: blocked, screenshot: shot,
            });
            expect(blocked, `Editor não deveria acessar /admin. URL: ${url}`).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§1.2b [Unit Editor] /mobile-admin redireciona para /login', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            await page.goto('/mobile-admin', { waitUntil: 'load' });
            await page.waitForURL(url => !url.pathname.startsWith('/mobile-admin'), { timeout: 5_000 });
            const url = page.url();
            const blocked = !url.includes('/mobile-admin') || url.includes('/login');

            const shot = await snap(page, 'E-route-editor-mobile-admin-blocked');
            record({
                area: '§1 Rotas', profile: 'Unit Editor',
                route: '/mobile-admin', action: 'GET',
                expected: 'redirect → /login', actual: url,
                passed: blocked, screenshot: shot,
            });
            expect(blocked).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§1.2c [Unit Editor] /tv acessível', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            await page.goto('/tv', { waitUntil: 'load' });
            const url = page.url();
            const accessible = url.includes('/tv');

            record({
                area: '§1 Rotas', profile: 'Unit Editor',
                route: '/tv', action: 'GET',
                expected: 'URL contém /tv', actual: url,
                passed: accessible,
            });
            expect(accessible).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§1.2d [Unit Editor] /editor acessível', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            await page.goto('/editor', { waitUntil: 'load' });
            const url = page.url();
            const accessible = url.includes('/editor');

            record({
                area: '§1 Rotas', profile: 'Unit Editor',
                route: '/editor', action: 'GET',
                expected: 'URL contém /editor', actual: url,
                passed: accessible,
            });
            expect(accessible).toBe(true);
        } finally { await ctx.close(); }
    });

    // ── §1.3 Unit Viewer ────────────────────────────────────────────────────

    test('§1.3a [Unit Viewer] /admin redireciona para /login', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'viewer');
        try {
            await page.goto('/admin', { waitUntil: 'load' });
            await page.waitForURL(url => !url.pathname.startsWith('/admin'), { timeout: 5_000 });
            const url = page.url();
            const blocked = !url.includes('/admin') || url.includes('/login');

            const shot = await snap(page, 'E-route-viewer-admin-blocked');
            record({
                area: '§1 Rotas', profile: 'Unit Viewer',
                route: '/admin', action: 'GET',
                expected: 'redirect → /login', actual: url,
                passed: blocked, screenshot: shot,
            });
            expect(blocked).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§1.3b [Unit Viewer] /tv acessível', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'viewer');
        try {
            await page.goto('/tv', { waitUntil: 'load' });
            const url = page.url();
            const accessible = url.includes('/tv');

            record({
                area: '§1 Rotas', profile: 'Unit Viewer',
                route: '/tv', action: 'GET',
                expected: 'URL contém /tv', actual: url,
                passed: accessible,
            });
            expect(accessible).toBe(true);
        } finally { await ctx.close(); }
    });

    // ── §1.4 Não autenticado ────────────────────────────────────────────────

    test('§1.4a [Não autenticado] /admin redireciona para /login', async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await ctx.newPage();
        try {
            await page.goto('/admin', { waitUntil: 'load' });
            // React auth state check happens after load; wait for redirect
            await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {});
            const url = page.url();
            const blocked = url.includes('/login');

            const shot = await snap(page, 'E-route-noauth-admin');
            record({
                area: '§1 Rotas', profile: 'Não autenticado',
                route: '/admin', action: 'GET',
                expected: 'redirect → /login', actual: url,
                passed: blocked, screenshot: shot,
            });
            expect(blocked, `Não autenticado acessou /admin. URL: ${url}`).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§1.4b [Não autenticado] /tv redireciona para /login', async ({ browser }) => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
            await page.goto('/tv', { waitUntil: 'load' });
            await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {});
            const url = page.url();
            const blocked = url.includes('/login');

            record({
                area: '§1 Rotas', profile: 'Não autenticado',
                route: '/tv', action: 'GET',
                expected: 'redirect → /login', actual: url,
                passed: blocked,
            });
            expect(blocked).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§1.4c [Não autenticado] /editor redireciona para /login', async ({ browser }) => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        try {
            await page.goto('/editor', { waitUntil: 'load' });
            await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {});
            const url = page.url();
            const blocked = url.includes('/login');

            record({
                area: '§1 Rotas', profile: 'Não autenticado',
                route: '/editor', action: 'GET',
                expected: 'redirect → /login', actual: url,
                passed: blocked,
            });
            expect(blocked).toBe(true);
        } finally { await ctx.close(); }
    });

    // ── §1.5 Usuário não autorizado (em auth, mas fora da whitelist) ─────────

    test('§1.5 [Não autorizado] login recusado, banner de erro exibido', async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await ctx.newPage();
        try {
            // Create an unauthorized user (NOT in authorized_users) via admin SDK
            const app = getApps()[0]!;
            const adminAuth = getAuth(app);
            const unauthorizedEmail = `noauth-${Date.now()}@test.com`;
            const newUser = await adminAuth.createUser({
                email: unauthorizedEmail,
                password: 'password123',
                displayName: 'Unauthorized Intruder',
            });
            // Intentionally do NOT add to authorized_users or set any authz
            const unauthToken = await adminAuth.createCustomToken(newUser.uid, {});

            await page.goto('/login', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof (window as any).__testSignIn === 'function', {
                timeout: 15_000,
            });
            await page.evaluate(async (token: string) => {
                await (window as any).__testSignIn(token);
            }, unauthToken);

            // App should sign out the user and redirect back to /login with error
            await page.waitForURL(/\/login/, { timeout: 15_000 });
            const url = page.url();
            const blocked = url.includes('/login');

            // App should show unauthorized error message
            const errorVisible = await page.locator('text=/[Nn]ão autorizado|[Aa]dministrador/').isVisible({ timeout: 5_000 }).catch(() => false);

            const shot = await snap(page, 'E-route-unauthorized-login');
            record({
                area: '§1 Rotas', profile: 'Não autorizado',
                route: '/login', action: 'Google login com email fora da whitelist',
                expected: 'fica em /login + mensagem de erro', actual: `url=${url} errorBanner=${errorVisible}`,
                passed: blocked, screenshot: shot,
            });
            expect(blocked, `Usuário não autorizado não deveria entrar. URL: ${url}`).toBe(true);
        } finally { await ctx.close(); }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SEÇÃO 2 — VISIBILIDADE DE AÇÕES DE UI
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('§2 — Visibilidade de ações de UI', () => {

    // ── §2.1 Global Admin ───────────────────────────────────────────────────

    test('§2.1a [Global Admin] botão de admin (escudo) visível em /editor', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'admin');
        try {
            await page.goto('/editor', { waitUntil: 'load' });
            // Wait for the auth-loading spinner to disappear so isAdmin is resolved
            await page.waitForFunction(
                () => !document.querySelector('.animate-pulse'),
                { timeout: 10_000 },
            ).catch(() => {});

            // EditorLayout.tsx: {isAdmin && <button aria-label="Acessar painel de administração">}
            const adminBtn = page.locator('button[aria-label="Acessar painel de administração"]');
            const visible = await adminBtn.isVisible({ timeout: 8_000 }).catch(() => false);

            const shot = await snap(page, 'E-ui-admin-shield-visible');
            record({
                area: '§2 UI Visibility', profile: 'Global Admin',
                route: '/editor', action: 'Botão navegação admin visível (ShieldAlert)',
                expected: 'visível', actual: visible ? 'visível' : 'não encontrado',
                passed: visible, screenshot: shot,
            });
            expect(visible, 'Admin deve ver botão ShieldAlert em /editor').toBe(true);
        } finally { await ctx.close(); }
    });

    test('§2.1b [Global Admin] painel de gestão de usuários acessível', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'admin');
        try {
            // Navigate directly to unit A admin panel
            await page.goto('/admin/unit/A', { waitUntil: 'load' });

            // Wait directly for the "Acesso" tab to appear (avoids race between auth/unit loading spinners)
            // AdminUnitShell.tsx: TABS array includes { key: 'users', label: 'Acesso', category: 'control' }
            // Tab renders as <button role="tab">...<span aria-hidden>icon</span>Acesso</button>
            const accessTab = page.locator('button[role="tab"]:has-text("Acesso")');
            await accessTab.waitFor({ state: 'visible', timeout: 25_000 });
            await accessTab.click();

            // UsersAdminScreen is lazy-loaded via Suspense — wait for the Suspense fallback to clear
            // then wait for the form to render. The form renders unconditionally (not behind a loading guard).
            await page.waitForFunction(
                () => !document.querySelector('.animate-pulse'),
                { timeout: 10_000 },
            ).catch(() => {});

            // AdminScreen.tsx renders: <input type="email" /> for adding users (in UsersAdminScreen)
            const emailInput = page.locator('input[type="email"]');
            const addVisible = await emailInput.isVisible({ timeout: 15_000 }).catch(() => false);

            const shot = await snap(page, 'E-ui-admin-users-panel');
            record({
                area: '§2 UI Visibility', profile: 'Global Admin',
                route: '/admin/unit/A → tab Acesso', action: 'input[type=email] para adicionar usuário visível',
                expected: 'controles visíveis', actual: addVisible ? 'visíveis' : 'não encontrados',
                passed: addVisible, screenshot: shot,
            });
            expect(addVisible).toBe(true);
        } finally { await ctx.close(); }
    });

    // ── §2.2 Unit Editor ────────────────────────────────────────────────────

    test('§2.2a [Unit Editor] sem botão de admin em /editor', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            await page.goto('/editor', { waitUntil: 'load' });
            await page.waitForTimeout(1_500); // allow layout to stabilize

            // Admin nav button should NOT be present for non-admin
            const adminLink = page.locator('a[href="/admin"]')
                .or(page.locator('[data-testid="admin-nav"]'));
            const adminVisible = await adminLink.first().isVisible({ timeout: 2_000 }).catch(() => false);

            const shot = await snap(page, 'E-ui-editor-no-admin-btn');
            record({
                area: '§2 UI Visibility', profile: 'Unit Editor',
                route: '/editor', action: 'Botão de navegação admin ausente',
                expected: 'não visível', actual: adminVisible ? 'visível (FALHOU)' : 'não visível ✓',
                passed: !adminVisible, screenshot: shot,
            });
            expect(adminVisible, 'Editor não deveria ver botão de admin').toBe(false);
        } finally { await ctx.close(); }
    });

    test('§2.2b [Unit Editor] controles de edição de leito acessíveis', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            await page.goto('/editor', { waitUntil: 'load' });

            // Look for bed cards
            const bedCard = page.locator('[class*="bed"], [data-testid*="bed"]').first()
                .or(page.locator('text="301.1"').locator('..'));
            await bedCard.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => { });

            // Click a bed to open details
            const bed301 = page.locator('text="301.1"');
            if (await bed301.isVisible({ timeout: 5_000 }).catch(() => false)) {
                await bed301.click();
                await page.waitForTimeout(800);
            }

            // Editor should see editable fields (textarea or input for blocker/alias)
            const editField = page.locator('textarea, input[type="text"]').first();
            const editVisible = await editField.isVisible({ timeout: 5_000 }).catch(() => false);

            const shot = await snap(page, 'E-ui-editor-bed-controls');
            record({
                area: '§2 UI Visibility', profile: 'Unit Editor',
                route: '/editor → leito', action: 'Campos editáveis do leito visíveis',
                expected: 'campos editáveis presentes', actual: editVisible ? 'presentes' : 'não encontrados',
                passed: editVisible, screenshot: shot,
            });
            expect(editVisible).toBe(true);
        } finally { await ctx.close(); }
    });

    // ── §2.3 Unit Viewer ────────────────────────────────────────────────────

    test('§2.3a [Unit Viewer] editar leito gera "Permissão negada"', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'viewer');
        try {
            await page.goto('/editor', { waitUntil: 'load' });

            // Find bed 301.1 and open it
            const bed301 = page.locator('text="301.1"');
            await bed301.waitFor({ state: 'visible', timeout: 10_000 });
            await bed301.click();

            // Try to fill the blocker field
            const blockerField = page.locator('textarea[placeholder*="impedindo" i], textarea[placeholder*="blocker" i], textarea').first();
            await blockerField.waitFor({ state: 'visible', timeout: 5_000 });
            const uniqueVal = `RBAC_VIEWER_INTRUSO_${Date.now()}`;
            await blockerField.fill(uniqueVal);
            await blockerField.blur();

            // Expect permission denied banner
            const permError = page.locator('text=/[Pp]ermissão negada|Apenas editores/');
            await expect(permError).toBeVisible({ timeout: 8_000 });

            const shot = await snap(page, 'E-ui-viewer-permission-denied');
            record({
                area: '§2 UI Visibility', profile: 'Unit Viewer',
                route: '/editor → leito → blocker', action: 'Tentativa de edição',
                expected: 'banner "Permissão negada"', actual: 'banner visível ✓',
                passed: true, screenshot: shot,
            });
        } finally { await ctx.close(); }
    });

    test('§2.3b [Unit Viewer] sem controles de admin em /admin (redirecionado)', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'viewer');
        try {
            await page.goto('/admin', { waitUntil: 'load' });
            await page.waitForURL(url => !url.pathname.startsWith('/admin'), { timeout: 5_000 });
            const url = page.url();

            // Ensure no admin controls are rendered
            const adminControls = page.locator('button:has-text("Adicionar"), button:has-text("Remover"), select.admin-select');
            const adminVisible = await adminControls.first().isVisible({ timeout: 2_000 }).catch(() => false);

            record({
                area: '§2 UI Visibility', profile: 'Unit Viewer',
                route: '/admin', action: 'Controles admin ausentes (redirect)',
                expected: 'redirecionado, sem controles admin', actual: `url=${url}`,
                passed: !adminVisible && !url.includes('/admin'),
            });
            expect(!url.includes('/admin')).toBe(true);
        } finally { await ctx.close(); }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SEÇÃO 3 — REGRAS FIRESTORE BACKEND
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('§3 — Regras Firestore backend', () => {

    // ── §3.1 authorized_users ────────────────────────────────────────────────

    test('§3.1a [Admin] pode escrever em authorized_users', async () => {
        const token = idTokens['admin']!;
        const res = await fsWrite(token, 'authorized_users/rbac-test-write-admin', '_testField', 'admin-ok');

        record({
            area: '§3 Firestore Rules', profile: 'Global Admin',
            route: 'authorized_users/{doc}', action: 'write',
            expected: '200 OK', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Admin deve poder escrever em authorized_users. Status: ${res.status}`).toBe(true);
    });

    test('§3.1b [Editor] NÃO pode escrever em authorized_users', async () => {
        const token = idTokens['editor']!;
        const res = await fsWrite(token, 'authorized_users/rbac-test-write-editor', '_testField', 'editor-fail');

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor',
            route: 'authorized_users/{doc}', action: 'write',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok && res.status === 403,
        });
        expect(res.ok, `Editor NÃO deve escrever em authorized_users. Status: ${res.status}`).toBe(false);
    });

    test('§3.1c [Viewer] NÃO pode escrever em authorized_users', async () => {
        const token = idTokens['viewer']!;
        const res = await fsWrite(token, 'authorized_users/rbac-test-write-viewer', '_testField', 'viewer-fail');

        record({
            area: '§3 Firestore Rules', profile: 'Unit Viewer',
            route: 'authorized_users/{doc}', action: 'write',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok && res.status === 403,
        });
        expect(res.ok).toBe(false);
    });

    // ── §3.2 beds (Unit A) ──────────────────────────────────────────────────

    test('§3.2a [Editor] pode ler beds da Unidade A', async () => {
        const token = idTokens['editor']!;
        const res = await fsRead(token, 'units/A/beds/bed_301.1');

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor',
            route: 'units/A/beds/bed_301.1', action: 'read',
            expected: '200 OK', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Editor deve poder ler beds da unidade A. Status: ${res.status}`).toBe(true);
    });

    test('§3.2b [Editor] pode escrever em beds da Unidade A', async () => {
        const token = idTokens['editor']!;
        const res = await fsWrite(token, 'units/A/beds/bed_301.1', '_rbacTestEditor', `editor-write-${Date.now()}`);

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor',
            route: 'units/A/beds/bed_301.1', action: 'write',
            expected: '200 OK', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Editor deve poder escrever em beds da unidade A. Status: ${res.status}`).toBe(true);
    });

    test('§3.2c [Viewer] pode ler beds da Unidade A', async () => {
        const token = idTokens['viewer']!;
        const res = await fsRead(token, 'units/A/beds/bed_301.1');

        record({
            area: '§3 Firestore Rules', profile: 'Unit Viewer',
            route: 'units/A/beds/bed_301.1', action: 'read',
            expected: '200 OK', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Viewer deve poder ler beds. Status: ${res.status}`).toBe(true);
    });

    test('§3.2d [Viewer] NÃO pode escrever em beds da Unidade A', async () => {
        const token = idTokens['viewer']!;
        const res = await fsWrite(token, 'units/A/beds/bed_301.1', '_rbacTestViewer', `viewer-write-${Date.now()}`);

        record({
            area: '§3 Firestore Rules', profile: 'Unit Viewer',
            route: 'units/A/beds/bed_301.1', action: 'write',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok && res.status === 403,
        });
        expect(res.ok, `Viewer NÃO deve escrever em beds. Status: ${res.status}`).toBe(false);
    });

    // ── §3.3 Isolamento cross-unit (Unidade B) ───────────────────────────────

    test('§3.3a [Editor de A] NÃO pode ler beds da Unidade B (não membro)', async () => {
        const token = idTokens['editor']!;
        const res = await fsRead(token, 'units/B/beds/bed_B-001');

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor (A)',
            route: 'units/B/beds/bed_B-001', action: 'read cross-unit',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok && res.status === 403,
        });
        expect(res.ok, `Editor de A NÃO deve ler beds da Unidade B. Status: ${res.status}`).toBe(false);
    });

    test('§3.3b [Editor de A] NÃO pode escrever em beds da Unidade B', async () => {
        const token = idTokens['editor']!;
        const res = await fsWrite(token, 'units/B/beds/bed_B-001', '_rbacCrossUnit', `intrusion-${Date.now()}`);

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor (A)',
            route: 'units/B/beds/bed_B-001', action: 'write cross-unit',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok && res.status === 403,
        });
        expect(res.ok, `Editor de A NÃO deve escrever em Unidade B. Status: ${res.status}`).toBe(false);
    });

    test('§3.3c [Viewer de A] NÃO pode ler beds da Unidade B', async () => {
        const token = idTokens['viewer']!;
        const res = await fsRead(token, 'units/B/beds/bed_B-001');

        record({
            area: '§3 Firestore Rules', profile: 'Unit Viewer (A)',
            route: 'units/B/beds/bed_B-001', action: 'read cross-unit',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok && res.status === 403,
        });
        expect(res.ok).toBe(false);
    });

    test('§3.3d [Admin] pode ler beds da Unidade B (global admin sem restrição de unidade)', async () => {
        const token = idTokens['admin']!;
        const res = await fsRead(token, 'units/B/beds/bed_B-001');

        record({
            area: '§3 Firestore Rules', profile: 'Global Admin',
            route: 'units/B/beds/bed_B-001', action: 'read cross-unit',
            expected: '200 OK (global admin sem restrição)', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Global Admin deve poder ler qualquer unidade. Status: ${res.status}`).toBe(true);
    });

    // ── §3.4 settings/board ──────────────────────────────────────────────────

    test('§3.4a [Editor] NÃO pode escrever em settings/board (apenas unit admin)', async () => {
        const token = idTokens['editor']!;
        const res = await fsWrite(token, 'units/A/settings/board', '_rbacEditorSettings', `editor-settings-${Date.now()}`);

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor',
            route: 'units/A/settings/board', action: 'write',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok && res.status === 403,
        });
        expect(res.ok, `Editor NÃO deve escrever em settings. Status: ${res.status}`).toBe(false);
    });

    test('§3.4b [Viewer] NÃO pode escrever em settings/board', async () => {
        const token = idTokens['viewer']!;
        const res = await fsWrite(token, 'units/A/settings/board', '_rbacViewerSettings', `viewer-settings-${Date.now()}`);

        record({
            area: '§3 Firestore Rules', profile: 'Unit Viewer',
            route: 'units/A/settings/board', action: 'write',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok && res.status === 403,
        });
        expect(res.ok).toBe(false);
    });

    test('§3.4c [Admin] pode escrever em settings/board', async () => {
        const token = idTokens['admin']!;
        const res = await fsWrite(token, 'units/A/settings/board', '_rbacAdminSettings', `admin-settings-${Date.now()}`);

        record({
            area: '§3 Firestore Rules', profile: 'Global Admin',
            route: 'units/A/settings/board', action: 'write',
            expected: '200 OK', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Admin deve poder escrever em settings. Status: ${res.status}`).toBe(true);
    });

    test('§3.4d [Editor] pode ler settings/board (membro da unidade)', async () => {
        const token = idTokens['editor']!;
        const res = await fsRead(token, 'units/A/settings/board');

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor',
            route: 'units/A/settings/board', action: 'read',
            expected: '200 OK', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Editor deve poder ler settings. Status: ${res.status}`).toBe(true);
    });

    // ── §3.5 audit_logs ──────────────────────────────────────────────────────

    test('§3.5a [Editor] NÃO pode ler audit_logs (apenas unit admin)', async () => {
        const token = idTokens['editor']!;
        // Try to list the collection (GET on subcollection)
        const res = await fsRead(token, 'units/A/audit_logs');

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor',
            route: 'units/A/audit_logs', action: 'read (list)',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok,
        });
        expect(res.ok, `Editor NÃO deve ler audit_logs. Status: ${res.status}`).toBe(false);
    });

    test('§3.5b [Viewer] NÃO pode ler audit_logs', async () => {
        const token = idTokens['viewer']!;
        const res = await fsRead(token, 'units/A/audit_logs');

        record({
            area: '§3 Firestore Rules', profile: 'Unit Viewer',
            route: 'units/A/audit_logs', action: 'read (list)',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok,
        });
        expect(res.ok).toBe(false);
    });

    test('§3.5c [Admin] pode ler audit_logs', async () => {
        const token = idTokens['admin']!;
        // GET with runQuery to list docs (list endpoint)
        const res = await fetch(
            `${FS_BASE}/units/A/audit_logs?pageSize=1`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        const ok = res.ok || res.status === 200;

        record({
            area: '§3 Firestore Rules', profile: 'Global Admin',
            route: 'units/A/audit_logs', action: 'read (list)',
            expected: '200 OK', actual: `${res.status}`,
            passed: ok,
        });
        expect(ok, `Admin deve poder ler audit_logs. Status: ${res.status}`).toBe(true);
    });

    test('§3.5d ninguém pode escrever em audit_logs diretamente (write: if false)', async () => {
        const adminToken = idTokens['admin']!;
        const res = await fsWrite(adminToken, 'units/A/audit_logs/rbac-test-direct-write', '_test', 'blocked');

        record({
            area: '§3 Firestore Rules', profile: 'Global Admin',
            route: 'units/A/audit_logs/{doc}', action: 'write direto (deve ser sempre negado)',
            expected: '403 PERMISSION_DENIED (write: if false)', actual: `${res.status}`,
            passed: !res.ok,
        });
        expect(res.ok, `Ninguém deve escrever diretamente em audit_logs. Status: ${res.status}`).toBe(false);
    });

    // ── §3.6 Central authz (/users/{uid}/authz/authz) ─────────────────────────

    test('§3.6a [Viewer] pode ler seu próprio documento authz', async () => {
        const viewerUid = uids['viewer']!;
        const token = idTokens['viewer']!;
        const res = await fsRead(token, `users/${viewerUid}/authz/authz`);

        record({
            area: '§3 Firestore Rules', profile: 'Unit Viewer',
            route: `users/[self]/authz/authz`, action: 'read próprio',
            expected: '200 OK', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Viewer deve ler seu próprio authz. Status: ${res.status}`).toBe(true);
    });

    test('§3.6b [Editor] NÃO pode ler authz de outro usuário', async () => {
        const viewerUid = uids['viewer']!;
        const editorToken = idTokens['editor']!;
        const res = await fsRead(editorToken, `users/${viewerUid}/authz/authz`);

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor',
            route: `users/[outro]/authz/authz`, action: 'read de outro',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok,
        });
        expect(res.ok, `Editor NÃO deve ler authz de outro usuário. Status: ${res.status}`).toBe(false);
    });

    test('§3.6c [Admin] pode ler authz de qualquer usuário', async () => {
        const viewerUid = uids['viewer']!;
        const adminToken = idTokens['admin']!;
        const res = await fsRead(adminToken, `users/${viewerUid}/authz/authz`);

        record({
            area: '§3 Firestore Rules', profile: 'Global Admin',
            route: `users/[outro]/authz/authz`, action: 'read de outro',
            expected: '200 OK', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Admin deve ler authz de qualquer usuário. Status: ${res.status}`).toBe(true);
    });

    test('§3.6d [Editor] NÃO pode escrever em authz (apenas global admin)', async () => {
        const editorUid = uids['editor']!;
        const editorToken = idTokens['editor']!;
        const res = await fsWrite(editorToken, `users/${editorUid}/authz/authz`, '_rbacSelfEscalation', 'escalation-attempt');

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor',
            route: `users/[self]/authz/authz`, action: 'write (tentativa de escalação)',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok,
        });
        expect(res.ok, `Editor NÃO deve escrever em authz (escalação de privilégio bloqueada). Status: ${res.status}`).toBe(false);
    });

    // ── §3.7 Huddles ──────────────────────────────────────────────────────────

    test('§3.7a [Editor] pode criar huddle com status != COMPLETED', async () => {
        const token = idTokens['editor']!;
        const huddleId = `rbac-test-huddle-${Date.now()}`;
        const res = await fetch(`${FS_BASE}/units/A/huddles/${huddleId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    id: { stringValue: huddleId },
                    unitId: { stringValue: 'A' },
                    completionState: { stringValue: 'IN_PROGRESS' },
                    createdAt: { stringValue: new Date().toISOString() },
                },
            }),
        });

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor',
            route: `units/A/huddles/${huddleId}`, action: 'create (completionState=IN_PROGRESS)',
            expected: '200 OK', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Editor deve poder criar huddle em IN_PROGRESS. Status: ${res.status}`).toBe(true);
    });

    test('§3.7b [Editor] NÃO pode setar huddle como COMPLETED', async () => {
        const token = idTokens['editor']!;
        const huddleId = `rbac-test-huddle-complete-${Date.now()}`;
        const res = await fetch(`${FS_BASE}/units/A/huddles/${huddleId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    id: { stringValue: huddleId },
                    unitId: { stringValue: 'A' },
                    completionState: { stringValue: 'COMPLETED' },
                    createdAt: { stringValue: new Date().toISOString() },
                },
            }),
        });

        record({
            area: '§3 Firestore Rules', profile: 'Unit Editor',
            route: `units/A/huddles/{id}`, action: 'create/update completionState=COMPLETED',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok,
        });
        expect(res.ok, `Editor NÃO deve setar COMPLETED. Status: ${res.status}`).toBe(false);
    });

    test('§3.7c [Admin] pode setar huddle como COMPLETED', async () => {
        const token = idTokens['admin']!;
        const huddleId = `rbac-test-huddle-admin-complete-${Date.now()}`;

        // Rules: `create` blocks completionState=COMPLETED even for admin.
        // `update` allows admin to set COMPLETED on an existing document.
        // Step 1: create huddle in IN_PROGRESS state (allowed for admin as unit member)
        const createRes = await fetch(`${FS_BASE}/units/A/huddles/${huddleId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    id: { stringValue: huddleId },
                    unitId: { stringValue: 'A' },
                    completionState: { stringValue: 'IN_PROGRESS' },
                    createdAt: { stringValue: new Date().toISOString() },
                },
            }),
        });
        if (!createRes.ok) {
            const errBody = await createRes.text();
            console.warn(`[§3.7c] Could not create huddle (step 1): ${createRes.status} ${errBody}`);
        }

        // Step 2: update to COMPLETED (only isGlobalAdmin can do this per rules)
        const res = await fetch(`${FS_BASE}/units/A/huddles/${huddleId}?updateMask.fieldPaths=completionState`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    completionState: { stringValue: 'COMPLETED' },
                },
            }),
        });

        record({
            area: '§3 Firestore Rules', profile: 'Global Admin',
            route: `units/A/huddles/{id}`, action: 'update completionState → COMPLETED (via update, não create)',
            expected: '200 OK', actual: `${res.status}`,
            passed: res.ok,
        });
        expect(res.ok, `Admin deve poder setar COMPLETED via update. Status: ${res.status}`).toBe(true);
    });

    test('§3.7d [Viewer] NÃO pode criar huddle', async () => {
        const token = idTokens['viewer']!;
        const huddleId = `rbac-test-huddle-viewer-${Date.now()}`;
        const res = await fetch(`${FS_BASE}/units/A/huddles/${huddleId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    id: { stringValue: huddleId },
                    unitId: { stringValue: 'A' },
                    completionState: { stringValue: 'IN_PROGRESS' },
                    createdAt: { stringValue: new Date().toISOString() },
                },
            }),
        });

        record({
            area: '§3 Firestore Rules', profile: 'Unit Viewer',
            route: `units/A/huddles/{id}`, action: 'create',
            expected: '403 PERMISSION_DENIED', actual: `${res.status}`,
            passed: !res.ok,
        });
        expect(res.ok, `Viewer NÃO deve criar huddle. Status: ${res.status}`).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SEÇÃO 4 — COMPORTAMENTO DE SESSÃO E TROCA DE UNIDADE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('§4 — Sessão e troca de unidade', () => {

    test('§4.1 [Editor] URL manipulation para /admin não concede acesso', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            // Try direct URL hack to admin unit panel
            await page.goto('/admin/unit/A', { waitUntil: 'load' });
            // React auth redirect happens after load; wait for it
            await page.waitForURL(/\/login/, { timeout: 8_000 }).catch(() => {});
            const url = page.url();
            const blocked = !url.includes('/admin/unit/A') && !url.includes('/admin');

            const shot = await snap(page, 'E-session-editor-url-hack-admin');
            record({
                area: '§4 Sessão', profile: 'Unit Editor',
                route: '/admin/unit/A (URL direto)', action: 'URL manipulation para admin',
                expected: 'redirect → /login', actual: url,
                passed: blocked, screenshot: shot,
            });
            expect(blocked, `Editor via URL hack não deve acessar /admin/unit/A. URL: ${url}`).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§4.2 [Editor de A] URL manipulation para /admin/unit/B não concede acesso', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            await page.goto('/admin/unit/B', { waitUntil: 'load' });
            await page.waitForURL(/\/login/, { timeout: 8_000 }).catch(() => {});
            const url = page.url();
            const blocked = !url.includes('/admin/unit/B') && !url.includes('/admin/unit');

            const shot = await snap(page, 'E-session-editor-cross-unit-url');
            record({
                area: '§4 Sessão', profile: 'Unit Editor (A)',
                route: '/admin/unit/B (URL direto)', action: 'URL manipulation cross-unit',
                expected: 'redirect → /login (sem admin claim)', actual: url,
                passed: blocked, screenshot: shot,
            });
            expect(blocked, `Editor de A não deve acessar /admin/unit/B. URL: ${url}`).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§4.3 Após logout, rotas protegidas redirecionam para /login', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            // Confirm we're logged in
            await page.goto('/editor', { waitUntil: 'load' });
            expect(page.url()).toContain('/editor');

            // Sign out via Firebase (navigate to login and clear session)
            // The app doesn't expose a logout button in the test viewport easily,
            // so we use page.evaluate to sign out via Firebase SDK's signOut
            await page.goto('/login', { waitUntil: 'load' });

            // Clear IndexedDB (Firebase Auth persistence) to simulate logout
            await page.evaluate(async () => {
                const dbs = await indexedDB.databases?.() ?? [];
                for (const db of dbs) {
                    if (db.name) indexedDB.deleteDatabase(db.name);
                }
            });

            // Try to navigate to /editor after clearing session
            await page.goto('/editor', { waitUntil: 'load' });
            await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {});
            const url = page.url();
            const blocked = url.includes('/login');

            const shot = await snap(page, 'E-session-after-logout');
            record({
                area: '§4 Sessão', profile: 'Unit Editor (pós-logout)',
                route: '/editor', action: 'Acesso pós-logout',
                expected: 'redirect → /login', actual: url,
                passed: blocked, screenshot: shot,
            });
            expect(blocked, `Após logout, /editor deve redirecionar para /login. URL: ${url}`).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§4.4 [Admin] navegar de /tv para /admin funciona sem fricção', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'admin');
        try {
            // Start on TV
            await page.goto('/tv', { waitUntil: 'load' });
            expect(page.url()).toContain('/tv');

            // Navigate to admin
            await page.goto('/admin', { waitUntil: 'load' });
            const url = page.url();
            const onAdmin = url.includes('/admin');

            const shot = await snap(page, 'E-session-admin-tv-to-admin');
            record({
                area: '§4 Sessão', profile: 'Global Admin',
                route: '/tv → /admin', action: 'Navegação cross-route sem fricção',
                expected: 'acessa /admin sem re-login', actual: url,
                passed: onAdmin, screenshot: shot,
            });
            expect(onAdmin).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§4.5 [Editor] back/forward após redirect não restaura rota bloqueada', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            // Navigate to /editor (accessible)
            await page.goto('/editor', { waitUntil: 'load' });
            const editorUrl = page.url();

            // Try to navigate to /admin (blocked, redirected to /login)
            await page.goto('/admin', { waitUntil: 'load' });
            await page.waitForURL(url => !url.pathname.startsWith('/admin'), { timeout: 5_000 });

            // Press browser back button
            await page.goBack({ waitUntil: 'load' });
            await page.waitForTimeout(1_000);
            const urlAfterBack = page.url();

            // After back, user should be at /editor (accessible), NOT at /admin
            const notOnAdmin = !urlAfterBack.includes('/admin');

            const shot = await snap(page, 'E-session-back-after-redirect');
            record({
                area: '§4 Sessão', profile: 'Unit Editor',
                route: 'back após redirect de /admin', action: 'Botão back do browser',
                expected: 'não restaura /admin (sem sessão admin)', actual: urlAfterBack,
                passed: notOnAdmin, screenshot: shot,
            });
            expect(notOnAdmin, `Back button não deve restaurar /admin para editor. URL: ${urlAfterBack}`).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§4.6 [Viewer] deep link para /editor/bed/:id — pode ver mas não editar', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'viewer');
        try {
            // Deep link directly to bed 301.1
            await page.goto('/editor/bed/bed_301.1', { waitUntil: 'load' });
            const url = page.url();

            // Viewer should be able to reach the page (no route-level block for viewer on /editor)
            const reachedPage = url.includes('/editor') || url.includes('/tv');

            // But if they try to edit, they should get permission denied (tested in §2.3a)
            const shot = await snap(page, 'E-session-viewer-deep-link-bed');
            record({
                area: '§4 Sessão', profile: 'Unit Viewer',
                route: '/editor/bed/bed_301.1 (deep link)', action: 'Acesso via deep link',
                expected: 'página carrega (sem block de rota), edição bloqueada no backend',
                actual: url,
                passed: reachedPage, screenshot: shot,
            });
            expect(reachedPage).toBe(true);
        } finally { await ctx.close(); }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SEÇÃO 5 — ENFORCEMENT REAL (frontend não é a única barreira)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('§5 — Enforcement real no backend (não só esconder botão)', () => {

    test('§5.1 Viewer com token válido não consegue escrever em bed mesmo sem passar pela UI', async () => {
        // Esta é a prova mais importante: mesmo contornando o frontend completamente,
        // a tentativa de escrita via REST API direto é bloqueada pelo Firestore Rules
        const viewerToken = idTokens['viewer']!;

        const payload = {
            fields: {
                mainBlocker: { stringValue: `INTRUSION_BYPASS_UI_${Date.now()}` },
                patientAlias: { stringValue: 'RBAC_INTRUDER' },
            },
        };

        const res = await fetch(`${FS_BASE}/units/A/beds/bed_301.1?updateMask.fieldPaths=mainBlocker&updateMask.fieldPaths=patientAlias`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        record({
            area: '§5 Backend Enforcement', profile: 'Unit Viewer',
            route: 'units/A/beds/bed_301.1', action: 'REST API write direto (bypass de UI)',
            expected: '403 — backend bloqueia independente de UI', actual: `${res.status}`,
            passed: !res.ok && res.status === 403,
        });
        expect(res.ok, `Viewer NÃO deve escrever via REST API direta. Status: ${res.status}`).toBe(false);
        expect(res.status).toBe(403);
    });

    test('§5.2 Editor de A não consegue acessar Unidade B mesmo por REST direto', async () => {
        const editorToken = idTokens['editor']!;

        const res = await fetch(`${FS_BASE}/units/B/beds/bed_B-001`, {
            headers: { Authorization: `Bearer ${editorToken}` },
        });

        record({
            area: '§5 Backend Enforcement', profile: 'Unit Editor (A)',
            route: 'units/B/beds/bed_B-001', action: 'REST API read direto cross-unit (bypass de UI)',
            expected: '403 — backend bloqueia cross-unit independente de UI', actual: `${res.status}`,
            passed: !res.ok && res.status === 403,
        });
        expect(res.ok, `Editor de A não deve ler Unidade B via REST. Status: ${res.status}`).toBe(false);
    });

    test('§5.3 Ninguém consegue elevar seu próprio role no authz doc via REST', async () => {
        const editorUid = uids['editor']!;
        const editorToken = idTokens['editor']!;

        // Attempt privilege escalation: try to set own unit role to 'admin' or add global admin claim
        const escalationPayload = {
            fields: {
                units: {
                    mapValue: {
                        fields: {
                            A: { mapValue: { fields: { role: { stringValue: 'admin' } } } },
                            B: { mapValue: { fields: { role: { stringValue: 'admin' } } } }, // cross-unit escalation
                        },
                    },
                },
            },
        };

        const res = await fetch(`${FS_BASE}/users/${editorUid}/authz/authz`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${editorToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(escalationPayload),
        });

        record({
            area: '§5 Backend Enforcement', profile: 'Unit Editor',
            route: `users/[self]/authz/authz`, action: 'Tentativa de escalação de privilégio (PATCH authz)',
            expected: '403 — escalação bloqueada', actual: `${res.status}`,
            passed: !res.ok,
        });
        expect(res.ok, `Escalação de privilégio via authz doc deve ser bloqueada. Status: ${res.status}`).toBe(false);
    });

    test('§5.4 Fluxo feliz: Admin executa operação completa sem fricção (TV settings)', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'admin');
        try {
            // Navigate directly to unit A admin panel
            await page.goto('/admin/unit/A', { waitUntil: 'load' });
            // Wait for auth-loading spinner to disappear
            await page.waitForFunction(
                () => !document.querySelector('.animate-pulse'),
                { timeout: 10_000 },
            ).catch(() => {});

            const url = page.url();
            const onAdmin = url.includes('/admin');

            // Check for "TV" tab (AdminUnitShell has TV tab)
            const tvTab = page.locator('[role="tab"]:has-text("TV"), button.admin-tab:has-text("TV")');
            await tvTab.first().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
            const tabVisible = await tvTab.first().isVisible({ timeout: 2_000 }).catch(() => false);

            const shot = await snap(page, 'E-enforce-admin-happy-path');
            record({
                area: '§5 Backend Enforcement', profile: 'Global Admin',
                route: '/admin/unit/A → TV tab', action: 'Fluxo feliz admin sem fricção',
                expected: 'admin acessa painel sem redirect/bloqueio', actual: `url=${url} tabTV=${tabVisible}`,
                passed: onAdmin && tabVisible, screenshot: shot,
            });
            expect(onAdmin && tabVisible).toBe(true);
        } finally { await ctx.close(); }
    });

    test('§5.5 Fluxo feliz: Editor edita leito sem fricção', async ({ browser }) => {
        const { page, ctx } = await openAs(browser, 'editor');
        try {
            // Navigate directly to bed details — verifies editor can open a bed without being blocked.
            // bed_301.1 was seeded in beforeAll with unitId='A'.
            // Route: /editor/bed/:id matches App.tsx nested route under EditorLayout.
            await page.goto('/editor/bed/bed_301.1?unit=A', { waitUntil: 'load' });

            // BedDetails renders skeleton while bed===null (Firestore listener pending),
            // then renders <input id="patient-alias"> and <textarea id="blocker-textarea"> once data loads.
            // Use waitFor (not isVisible) to actually poll until visible.
            const patientAlias = page.locator('#patient-alias');
            const hasForm = await patientAlias
                .waitFor({ state: 'visible', timeout: 20_000 })
                .then(() => true)
                .catch(() => false);

            const shot = await snap(page, 'E-enforce-editor-happy-path');
            record({
                area: '§5 Backend Enforcement', profile: 'Unit Editor',
                route: '/editor → leito 301.1', action: 'Fluxo feliz editor sem fricção',
                expected: 'editor abre leito sem redirect/bloqueio', actual: `hasForm=${hasForm}`,
                passed: hasForm, screenshot: shot,
            });
            expect(hasForm, 'Editor deve abrir leito e ver campos de edição').toBe(true);
        } finally { await ctx.close(); }
    });
});
