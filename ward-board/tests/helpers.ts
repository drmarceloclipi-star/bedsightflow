/**
 * helpers.ts
 *
 * Shared Playwright helpers for Ward Board E2E tests.
 * - Admin login via Firebase Auth Emulator
 * - Tab navigation using the emoji-prefixed labels in AdminUnitShell
 * - ReasonModal interaction (replaces window.prompt)
 */

import { expect, type Page, type Dialog } from '@playwright/test';

// ─── Tab label map matching AdminUnitShell.tsx ─────────────────────────────

export const ADMIN_TAB_LABELS: Record<string, string> = {
    tv: 'TV',
    beds: 'Leitos',
    users: 'Acesso',
    ops: 'Operações',
    audit: 'Auditoria',
    analytics: 'Analytics',
    education: 'Educativo',
    'mission-control': 'M. Control'
};

// ─── Auth ──────────────────────────────────────────────────────────────────

/**
 * Signs in via the Firebase Auth Emulator UI.
 * After login the app may redirect to /editor; this helper then
 * waits for a stable non-emulator URL before returning.
 */
export async function signInViaEmulator(
    page: Page,
    email: string,
    _displayName?: string,
) {
    // Log console errors to terminal
    page.on('console', msg => {
        if (msg.type() === 'error') console.log(`BROWSER ERROR: ${msg.text()}`);
    });

    await page.goto('/login', { waitUntil: 'networkidle' });

    // Fill the local login form
    const emailInput = page.locator('input[name="email"]');
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(email);

    // Default password as used by seed-lean-tests.ts
    await page.fill('input[name="password"]', 'password123');

    await page.click('button[type="submit"]:has-text("Entrar Localmente")');

    // Wait until login completes and app redirects us to either portal, admin, editor, etc.
    await page.waitForURL(/\/portal|\/admin|\/unit-admin|\/mobile-admin|\/editor|\/tv/, { timeout: 15000 });
}

export const signInAsAdmin = (page: Page) =>
    signInViaEmulator(page, 'global-admin@lean.com', 'Global Admin');

export const signInAsUnitAdmin = (page: Page) =>
    signInViaEmulator(page, 'unit-admin@lean.com', 'Unit Admin');

export const signInAsEditor = (page: Page) =>
    signInViaEmulator(page, 'editor@lean.com', 'Editor User');

// ─── Navigation ────────────────────────────────────────────────────────────

/**
 * Navigates to the admin shell for unitId and clicks the given tab.
 * Uses the exact emoji-prefixed labels from AdminUnitShell.tsx.
 */
export async function goToAdminTab(page: Page, tabKey: string, unitId = 'A') {
    if (!page.url().includes(`/admin/unit/${unitId}`)) {
        // Attempt soft-navigation from AdminHome to avoid Firebase Auth dropping session on reload
        const unitCard = page.locator('.admin-card').filter({ hasText: `ID: ${unitId}` });
        await unitCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });

        if (await unitCard.isVisible()) {
            await unitCard.locator('button', { hasText: 'Entrar →' }).click();
        } else {
            await page.goto(`/admin/unit/${unitId}`);
        }
    }

    // Determine category and switch to it if needed
    const exploreTabs = ['analytics', 'audit', 'education'];
    const targetCategory = exploreTabs.includes(tabKey) ? 'Explorar' : 'Controle';
    await page.click(`button.admin-category-btn:has-text("${targetCategory}")`);

    // Wait until the tab bar is rendered
    const tabLabel = ADMIN_TAB_LABELS[tabKey] ?? tabKey;
    await page.waitForSelector(`button[role="tab"]:has-text("${tabLabel}")`, { timeout: 10000 });
    await page.click(`button[role="tab"]:has-text("${tabLabel}")`);
}

// ─── Dialog handling ────────────────────────────────────────────────────────

/**
 * Sets up automatic dialog handling for native browser dialogs:
 *  - confirm  → accepted
 *  - prompt   → accepted with the given reason string
 *  - alert    → accepted
 *
 * Returns a function to remove the listener.
 */
export function autoAcceptDialogs(page: Page, reason = 'Motivo de teste E2E') {
    const handler = async (dialog: Dialog) => {
        if (dialog.type() === 'confirm') {
            await dialog.accept();
        } else if (dialog.type() === 'prompt') {
            await dialog.accept(reason);
        } else {
            await dialog.accept();
        }
    };
    page.on('dialog', handler);
    return () => page.off('dialog', handler);
}

// ─── ReasonModal interaction ────────────────────────────────────────────────

/**
 * Fills and confirms the ReasonModal that replaced window.prompt.
 * Waits for the modal to appear, types the reason, and clicks "Confirmar".
 *
 * The modal input has placeholder "Ex: Novo membro da equipe de enfermagem".
 */
export async function fillReasonModal(page: Page, reason = 'Motivo de teste E2E') {
    const input = page.locator('input[placeholder*="Ex:"]');
    await input.waitFor({ state: 'visible', timeout: 8000 });
    await input.fill(reason);
    await page.locator('button', { hasText: 'Confirmar' }).last().click();
}

/**
 * Fills and confirms the ConfirmModal, optionally typing a requireWord first.
 */
export async function fillConfirmModal(
    page: Page,
    reason = 'Motivo teste E2E',
    requiredWord?: string,
) {
    if (requiredWord) {
        const requiredWordInput = page.locator('#modal-typing');
        await requiredWordInput.waitFor({ state: 'visible', timeout: 8000 });
        await requiredWordInput.fill(requiredWord);
    }

    const reasonInput = page.locator('#modal-reason');
    await reasonInput.waitFor({ state: 'visible', timeout: 5000 });
    await reasonInput.fill(reason);

    const confirmBtn = page.locator('.modal-btn-confirm');
    await expect(confirmBtn).not.toBeDisabled({ timeout: 5000 });
    await confirmBtn.click();
}
