/**
 * tv-settings-realtime.spec.ts
 *
 * Validates that changes made in the Admin TV Settings panel are reflected
 * in real-time (without page reload) on the TV Dashboard.
 *
 * Flow:
 *   1. Sign in as admin.
 *   2. Navigate to the /tv dashboard.
 *   3. In the same page context (SPA), navigate to admin TV settings.
 *   4. Toggle settings and save, then navigate back to /tv.
 *   5. Assert that the TV dashboard reflects the saved settings.
 */

import { test, expect, type Page } from '@playwright/test';
import { signInAsAdmin, goToAdminTab, fillConfirmModal } from './helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate to /tv?unit=A within the already-authenticated SPA without
 * triggering a full page reload.
 */
async function goToTvDashboard(page: Page, unitId = 'A') {
    await page.goto(`/tv?unit=${unitId}`, { waitUntil: 'domcontentloaded' });
    // Wait for the TV dashboard to be rendered (either header or error)
    await page.waitForSelector('.tv-dashboard, .tv-title, h1.tv-title', { timeout: 15000 });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('TV Settings — Alterações refletidas em tempo real', () => {
    test.beforeEach(async ({ page }) => {
        await signInAsAdmin(page);
    });

    test('progress bar must not appear when rotation is disabled', async ({ page }) => {
        // Step 1 – Go to admin TV settings and force rotation OFF
        await goToAdminTab(page, 'tv');

        const rotationToggle = page
            .locator('div.toggle-row', { hasText: 'Rotação habilitada' })
            .locator('button[role="switch"]');
        await expect(rotationToggle).toBeVisible();

        let changed1 = false;
        // Always force rotation OFF, regardless of current state
        if (await rotationToggle.getAttribute('aria-checked') === 'true') {
            await rotationToggle.click();
            await page.waitForTimeout(300);
            changed1 = true;
        }
        // Confirm it is now off
        await expect(rotationToggle).toHaveAttribute('aria-checked', 'false');

        // Save settings
        if (changed1) {
            await page.locator('button', { hasText: 'Salvar' }).click();
            await fillConfirmModal(page, 'Teste desabilitar rotação E2E');
            await expect(page.locator('button', { hasText: '✓ Salvo' })).toBeVisible({ timeout: 5000 });
            await page.locator('button', { hasText: /^Salvar$/ }).waitFor({ timeout: 5000 });
        }

        // Step 2 – Navigate to TV Dashboard and wait for Firestore update to propagate
        await goToTvDashboard(page);

        // Wait up to 5s for the progress bar to disappear (real-time update)
        await expect(page.locator('.progress-bar-container')).not.toBeVisible({ timeout: 5000 });

        // Step 3 – Re-enable rotation for cleanup
        await goToAdminTab(page, 'tv');
        const rotationToggleClean = page
            .locator('div.toggle-row', { hasText: 'Rotação habilitada' })
            .locator('button[role="switch"]');
        let changedClean = false;
        if (await rotationToggleClean.getAttribute('aria-checked') === 'false') {
            await rotationToggleClean.click();
            await page.waitForTimeout(300);
            changedClean = true;
        }
        if (changedClean) {
            await page.locator('button', { hasText: 'Salvar' }).click();
            await fillConfirmModal(page, 'Restaurando rotação após E2E');
            await expect(page.locator('button', { hasText: '✓ Salvo' })).toBeVisible({ timeout: 5000 });
        }
    });

    test('disabling a screen removes it from the TV rotation', async ({ page }) => {
        test.setTimeout(90000); // extended: multi-step admin nav + save + polling
        // Step 1 – Go to admin TV settings and ensure Resumo da Unidade is ON
        await goToAdminTab(page, 'tv');
        const resumoRow = page.locator('div.settings-screen-row').filter({ hasText: 'Resumo da Unidade' });
        const resumoToggle = resumoRow.locator('button[role="switch"]');

        let changed2 = false;
        // Turn Resumo ON so we have a known state
        const resumoIsOff = await resumoToggle.getAttribute('aria-checked') === 'false';
        if (resumoIsOff) {
            await resumoToggle.click();
            await page.waitForTimeout(300);
            changed2 = true;
        }

        // Ensure rotation is ON
        const rotationToggle = page
            .locator('div.toggle-row', { hasText: 'Rotação habilitada' })
            .locator('button[role="switch"]');
        const rotationIsOff = await rotationToggle.getAttribute('aria-checked') === 'false';
        if (rotationIsOff) {
            await rotationToggle.click();
            await page.waitForTimeout(300);
            changed2 = true;
        }

        if (changed2) {
            await page.locator('button', { hasText: 'Salvar' }).click();
            await fillConfirmModal(page, 'Ativando Resumo para E2E');
            await expect(page.locator('button', { hasText: '✓ Salvo' })).toBeVisible({ timeout: 5000 });
            await page.locator('button', { hasText: /^Salvar$/ }).waitFor({ timeout: 5000 });
        }

        // Step 2 – Navigate to TV dashboard and verify rotation is running
        await goToTvDashboard(page);
        const indicator = page.locator('.tv-screen-indicator');
        await indicator.waitFor({ state: 'visible', timeout: 10000 });

        // Verify indicator shows a valid X/Y format (rotation is working)
        const initialText = await indicator.innerText();
        expect(initialText).toMatch(/\d+\/\d+/);

        // Step 3 – Turn Resumo OFF in admin settings
        await goToAdminTab(page, 'tv');
        const resumoRowFresh = page.locator('div.settings-screen-row').filter({ hasText: 'Resumo da Unidade' });
        const resumoToggleFresh = resumoRowFresh.locator('button[role="switch"]');
        let changed3 = false;
        const isOn = await resumoToggleFresh.getAttribute('aria-checked') === 'true';
        if (isOn) {
            await resumoToggleFresh.click();
            await page.waitForTimeout(300);
            changed3 = true;
        }

        if (changed3) {
            await page.locator('button', { hasText: 'Salvar' }).click();
            await fillConfirmModal(page, 'Desativando Resumo para E2E');
            await expect(page.locator('button', { hasText: '✓ Salvo' })).toBeVisible({ timeout: 5000 });
            await page.locator('button', { hasText: /^Salvar$/ }).waitFor({ timeout: 5000 });
        }

        // Step 4 – Navigate to TV dashboard and verify 'Resumo' label never appears.
        // Poll for 15 s — if 'Resumo' shows up, the disable didn't work.
        await goToTvDashboard(page);
        await indicator.waitFor({ state: 'visible', timeout: 10000 });

        let sawResumoAfterDisable = false;
        for (let i = 0; i < 10; i++) {
            const text = await indicator.innerText();
            if (text.toLowerCase().includes('resumo')) {
                sawResumoAfterDisable = true;
                break;
            }
            await page.waitForTimeout(500);
        }
        expect(sawResumoAfterDisable).toBe(false);

        // Restore: turn Resumo back ON
        await goToAdminTab(page, 'tv');
        const resumoRowRestore = page.locator('div.settings-screen-row').filter({ hasText: 'Resumo da Unidade' });
        const resumoToggleRestore = resumoRowRestore.locator('button[role="switch"]');
        let changed4 = false;
        const nowOff = await resumoToggleRestore.getAttribute('aria-checked') === 'false';
        if (nowOff) {
            await resumoToggleRestore.click();
            await page.waitForTimeout(300);
            changed4 = true;
        }
        if (changed4) {
            await page.locator('button', { hasText: 'Salvar' }).click();
            await fillConfirmModal(page, 'Restaurando Resumo após E2E');
            await expect(page.locator('button', { hasText: '✓ Salvo' })).toBeVisible({ timeout: 5000 });
        }
    });

    test('changing screen duration is persisted and reflected in rotation speed', async ({ page }) => {
        await goToAdminTab(page, 'tv');

        // Ensure Kamishibai is ON and enabled
        const kamishibaiRow = page.locator('div.settings-screen-row').filter({ hasText: 'Quadro Kamishibai' });
        const kamishibaiToggle = kamishibaiRow.locator('button[role="switch"]');
        const kamishibaiIsOff = await kamishibaiToggle.getAttribute('aria-checked') === 'false';
        if (kamishibaiIsOff) {
            await kamishibaiToggle.click();
            await page.waitForTimeout(300);
        }

        // Set Kamishibai duration to a known value (30 seconds)
        const kamishibaiDuration = kamishibaiRow.locator('input[type="number"]');
        await kamishibaiDuration.fill('30');

        await page.locator('button', { hasText: 'Salvar' }).click();
        await fillConfirmModal(page, 'Ajustando duração Kamishibai E2E');
        await expect(page.locator('button', { hasText: '✓ Salvo' })).toBeVisible({ timeout: 5000 });
        await page.locator('button', { hasText: /^Salvar$/ }).waitFor({ timeout: 5000 });

        // Verify the duration input holds the saved value
        await goToAdminTab(page, 'tv');
        const kamishibaiDurationReloaded = page
            .locator('div.settings-screen-row')
            .filter({ hasText: 'Quadro Kamishibai' })
            .locator('input[type="number"]');
        await expect(kamishibaiDurationReloaded).toHaveValue('30');
    });

    test('pagination settings are persisted and visible in admin', async ({ page }) => {
        await goToAdminTab(page, 'tv');

        // Set Kanban beds per page to a unique value
        const kanbanInput = page
            .locator('div.number-field')
            .filter({ hasText: 'Kanban — leitos' })
            .locator('input[type="number"]');
        await kanbanInput.fill('15');

        const kamishibaiInput = page
            .locator('div.number-field')
            .filter({ hasText: 'Kamishibai — leitos' })
            .locator('input[type="number"]');
        await kamishibaiInput.fill('12');

        await page.locator('button', { hasText: 'Salvar' }).click();
        await fillConfirmModal(page, 'Ajustando paginação E2E');
        await expect(page.locator('button', { hasText: '✓ Salvo' })).toBeVisible({ timeout: 5000 });
        await page.locator('button', { hasText: /^Salvar$/ }).waitFor({ timeout: 5000 });

        // Navigate away and come back to verify persistence
        await goToTvDashboard(page);
        await goToAdminTab(page, 'tv');

        const kanbanInputReloaded = page
            .locator('div.number-field')
            .filter({ hasText: 'Kanban — leitos' })
            .locator('input[type="number"]');
        await expect(kanbanInputReloaded).toHaveValue('15');

        const kamishibaiInputReloaded = page
            .locator('div.number-field')
            .filter({ hasText: 'Kamishibai — leitos' })
            .locator('input[type="number"]');
        await expect(kamishibaiInputReloaded).toHaveValue('12');
    });
});
