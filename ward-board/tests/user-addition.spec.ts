/**
 * user-addition.spec.ts
 *
 * Verifies the full user-addition flow in the Admin > Usuários tab.
 *
 * ── Key design decisions ──────────────────────────────────────────────────
 *  1. The setUnitUserRole Cloud Function calls admin.auth().getUserByEmail(),
 *     and if the user is not found, it creates a new user in Firebase Auth.
 *
 *  2. The audit reason is now collected via a React modal (ReasonModal),
 *     NOT window.prompt. The helper `fillReasonModal` handles this interaction.
 *
 *  3. Native confirm() dialogs (for "Remover") are still handled via
 *     `autoAcceptDialogs`.
 *
 *  4. Tests are idempotent: each scenario self-manages state.
 *
 * Prerequisites:
 *  - Firebase emulators running  (auth:9099, firestore:8080, functions:5001)
 *  - App running at localhost:5173
 *  - Emulator seeded with unit 'A' and an admin account (admin@lean.com)
 */

import { test, expect, request } from '@playwright/test';
import { signInAsAdmin, goToAdminTab, autoAcceptDialogs, fillConfirmModal } from './helpers';

// ── Constants ────────────────────────────────────────────────────────────────
const TEST_EMAIL = 'e2e-add-user@lean.com';
const TEST_NAME = 'E2E Test User';
const AUDIT_REASON = 'Adição de usuário via teste E2E automatizado';
const AUTH_EMU = 'http://localhost:9099';
const PROJECT_ID = 'lean-841e5';

// ── Auth Emulator helpers ────────────────────────────────────────────────────

async function ensureAuthUserExists(email: string, displayName: string) {
    const api = await request.newContext({ baseURL: AUTH_EMU });

    const signIn = await api.post(
        `/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`,
        { data: { email, password: 'test1234', returnSecureToken: false } }
    );

    if (!signIn.ok()) {
        await api.post(
            `/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`,
            { data: { email, password: 'test1234', displayName, returnSecureToken: false } }
        );
    }

    await api.dispose();
}

async function deleteAuthUserIfExists(email: string) {
    const api = await request.newContext({ baseURL: AUTH_EMU });

    const lookup = await api.post(
        `/identitytoolkit.googleapis.com/v1/accounts:lookup?key=fake-key`,
        { data: { email: [email] } }
    );

    if (lookup.ok()) {
        const body = await lookup.json().catch(() => null);
        const uid = body?.users?.[0]?.localId;
        if (uid) {
            await api.delete(`/emulator/v1/projects/${PROJECT_ID}/accounts/${uid}`);
        }
    }

    await api.dispose();
}

// ── Test suite ───────────────────────────────────────────────────────────────

test.describe('Admin – User Addition Flow', () => {

    test.beforeAll(async () => {
        await ensureAuthUserExists(TEST_EMAIL, TEST_NAME);
    });

    test.beforeEach(async ({ page }) => {
        // Confirm dialogs (e.g. "Remover" confirmation) are still native
        autoAcceptDialogs(page, AUDIT_REASON);
        await signInAsAdmin(page);
    });

    // ── 1. Happy path: add user ──────────────────────────────────────────────

    test('Admin can add a new user with Editor role and it appears in the list', async ({ page }) => {
        await goToAdminTab(page, 'users');

        // Read current count
        const countBadge = page.locator('span.font-bold', { hasText: /Acesso na Unidade/ });
        await expect(countBadge).toBeVisible({ timeout: 8000 });


        // Remove test user if already in the list (from a previous failed run)
        const alreadyInList = await page.locator(`text="${TEST_EMAIL}"`).isVisible({ timeout: 1500 }).catch(() => false);
        if (alreadyInList) {
            const row = page.locator('tr, [role="row"]').filter({ hasText: TEST_EMAIL });
            const removeBtn = row.locator('button, span', { hasText: /remover/i });
            await removeBtn.click();
            await fillConfirmModal(page, 'Limpeza antes do teste E2E');
            await expect(page.locator(`text="${TEST_EMAIL}"`)).not.toBeVisible({ timeout: 10000 });
        }

        // Re-read count after optional cleanup
        const cleanText = await countBadge.textContent() ?? '';
        const startCount = parseInt(cleanText.match(/\d+/)?.[0] ?? '0', 10);

        // ── Fill the form ─────────────────────────────────────────────────
        const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="e-mail" i]').first();
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill(TEST_EMAIL);

        await page.locator('select').first().selectOption({ label: 'Editor' });

        // ── Click Adicionar — ReasonModal appears ──────────────────────────
        await page.locator('button[type="submit"]', { hasText: 'Adicionar' }).click();
        await fillConfirmModal(page, AUDIT_REASON);

        // ── Assertions ────────────────────────────────────────────────────
        await expect(page.locator(`text="${TEST_EMAIL}"`)).toBeVisible({ timeout: 20000 });
        await expect(countBadge).toContainText(`${startCount + 1}`, { timeout: 15000 });

        await page.screenshot({ path: 'playwright-report/user-addition-success.png', fullPage: true });
    });


    // ── 3. Cleanup: remove the user we added ─────────────────────────────────

    test('Admin can remove the previously added user', async ({ page }) => {
        await goToAdminTab(page, 'users');
        await expect(page.locator('h2', { hasText: /Acesso na Unidade/ })).toBeVisible({ timeout: 8000 });

        // Ensure user is present (add if missing)
        const userInList = await page.locator(`text="${TEST_EMAIL}"`).isVisible({ timeout: 2000 }).catch(() => false);
        if (!userInList) {
            const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
            await emailInput.fill(TEST_EMAIL);
            await page.locator('select').first().selectOption({ label: 'Editor' });
            await page.locator('button[type="submit"]', { hasText: 'Adicionar' }).click();
            await fillConfirmModal(page, AUDIT_REASON);
            await expect(page.locator(`text="${TEST_EMAIL}"`)).toBeVisible({ timeout: 20000 });
        }

        const countBadge = page.locator('span.font-bold', { hasText: /Acesso na Unidade/ });
        const beforeText = await countBadge.textContent() ?? '';
        const beforeCount = parseInt(beforeText.match(/\d+/)?.[0] ?? '0', 10);

        // Remove
        const row = page.locator('tr, [role="row"]').filter({ hasText: TEST_EMAIL });
        const removeBtn = row.locator('button, span', { hasText: /remover/i });
        await expect(removeBtn).toBeVisible({ timeout: 5000 });
        await removeBtn.click();
        // native confirm() auto-accepted, then ReasonModal
        await fillConfirmModal(page, 'Limpeza pós-teste E2E');

        await expect(page.locator(`text="${TEST_EMAIL}"`)).not.toBeVisible({ timeout: 15000 });
        await expect(countBadge).toContainText(`${beforeCount - 1}`, { timeout: 15000 });

        await page.screenshot({ path: 'playwright-report/user-removal-success.png', fullPage: true });
    });

    test.afterAll(async () => {
        await deleteAuthUserIfExists(TEST_EMAIL);
    });
});
