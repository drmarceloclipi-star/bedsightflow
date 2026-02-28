import { test, expect } from '@playwright/test';
import { signInAsAdmin, goToAdminTab, fillConfirmModal } from './helpers';

test.describe('Ops Advanced Screen', () => {
    test.beforeEach(async ({ page }) => {
        // Sign in and go to Ops tab for unit 'A'
        await signInAsAdmin(page);
        await goToAdminTab(page, 'ops');
    });

    test('can perform soft reset via ConfirmModal requiring RESETAR', async ({ page }) => {
        // Find and click the reset button
        const resetBtn = page.locator('button', { hasText: 'Executar Reset' });
        await expect(resetBtn).toBeVisible();
        await resetBtn.click();

        // Verify ConfirmModal opens
        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('h2', { hasText: 'Resetar dados da unidade' })).toBeVisible();

        // Verify "Confirmar" is disabled initially
        const confirmBtn = modal.locator('button', { hasText: 'Executar Reset' });
        await expect(confirmBtn).toBeDisabled();

        // Fill ConfirmModal with the required typing
        await fillConfirmModal(page, 'Resetando via E2E', 'RESETAR');

        // Verify success flash message
        await expect(page.locator('[role="status"]', { hasText: '✓ Reset concluído com sucesso.' })).toBeVisible({ timeout: 10000 });
    });

    test('can reapply canonical beds via ConfirmModal requiring REAPLICAR', async ({ page }) => {
        // Find and click the reapply button
        const reapplyBtn = page.locator('button', { hasText: 'Reaplicar Leitos' });
        await expect(reapplyBtn).toBeVisible();
        await reapplyBtn.click();

        // Verify ConfirmModal opens
        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('h2', { hasText: 'Reaplicar leitos padrão (36)' })).toBeVisible();

        // Verify "Confirmar" is disabled initially
        const confirmBtn = modal.locator('button', { hasText: 'Reaplicar Leitos' });
        await expect(confirmBtn).toBeDisabled();

        // Fill ConfirmModal
        await fillConfirmModal(page, 'Reaplicando leitos via E2E', 'REAPLICAR');

        // Verify success flash message
        await expect(page.locator('[role="status"]', { hasText: '✓ 36 leitos canônicos reaplicados.' })).toBeVisible({ timeout: 10000 });
    });

    test('can export snapshot JSON without a modal', async ({ page }) => {
        // Setup download listener
        const downloadPromise = page.waitForEvent('download');

        // Find and click the export button
        const exportBtn = page.locator('button', { hasText: 'Exportar snapshot' });
        await expect(exportBtn).toBeVisible();
        await exportBtn.click();

        // Wait for download to start
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain('ward-board-A-');
        expect(download.suggestedFilename()).toContain('.json');

        // Verify success flash message
        await expect(page.locator('[role="status"]', { hasText: '✓ Snapshot exportado com sucesso.' })).toBeVisible({ timeout: 10000 });

        // Modal should NOT have opened
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('cancelling a ConfirmModal does not execute the action', async ({ page }) => {
        const resetBtn = page.locator('button', { hasText: 'Executar Reset' });
        await resetBtn.click();

        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible();

        // Click Cancel
        await modal.locator('button', { hasText: 'Cancelar' }).click();

        // Modal closes, no flash message appears
        await expect(modal).not.toBeVisible();
        await expect(page.locator('[role="status"]')).not.toBeVisible();
    });
});
