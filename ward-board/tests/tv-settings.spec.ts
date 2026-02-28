import { test, expect } from '@playwright/test';
import { signInAsAdmin, goToAdminTab, fillConfirmModal } from './helpers';

test.describe('Admin TV Settings Screen', () => {
    test.beforeEach(async ({ page }) => {
        // Sign in and go to TV tab for unit 'A'
        await signInAsAdmin(page);
        await goToAdminTab(page, 'tv');
    });

    test('should allow toggling screens and changing durations', async ({ page }) => {
        // Verify we are on TV settings by checking the main header
        await expect(page.locator('h2', { hasText: 'Configurações de TV' })).toBeVisible();

        // Check if the rotation toggle is present
        const rotationToggle = page.locator('div.toggle-row', { hasText: 'Rotação habilitada' }).locator('button[role="switch"]');
        await expect(rotationToggle).toBeVisible();

        // Check screen toggles
        const kanbanRow = page.locator('div.settings-screen-row').filter({ hasText: 'Quadro Kanban' });
        const kamishibaiRow = page.locator('div.settings-screen-row').filter({ hasText: 'Quadro Kamishibai' });
        const resumoRow = page.locator('div.settings-screen-row').filter({ hasText: 'Resumo da Unidade' });

        await expect(kanbanRow).toBeVisible();
        await expect(kamishibaiRow).toBeVisible();
        await expect(resumoRow).toBeVisible();

        // Toggle Kanban off
        const kanbanToggle = kanbanRow.locator('button[role="switch"]');
        const kanbanIsOn = await kanbanToggle.getAttribute('aria-checked') === 'true';
        if (kanbanIsOn) {
            await kanbanToggle.click();
        }

        // When Kanban is off, its duration input should be disabled
        const kanbanDuration = kanbanRow.locator('input[type="number"]');
        await expect(kanbanDuration).toBeDisabled();

        // Turn Kanban back on
        await kanbanToggle.click();
        await expect(kanbanDuration).toBeEnabled();

        // Change duration of Kamishibai
        const kamishibaiDuration = kamishibaiRow.locator('input[type="number"]');
        if (await kamishibaiDuration.isEnabled()) {
            await kamishibaiDuration.fill('45');
        }
    });

    test('should allow changing pagination settings', async ({ page }) => {
        // Pagination section
        const kanbanBedsInput = page.locator('div.number-field').filter({ hasText: 'Kanban — leitos' }).locator('input[type="number"]');
        const kamishibaiBedsInput = page.locator('div.number-field').filter({ hasText: 'Kamishibai — leitos' }).locator('input[type="number"]');

        await kanbanBedsInput.fill('20');
        await kamishibaiBedsInput.fill('16');

        await expect(kanbanBedsInput).toHaveValue('20');
        await expect(kamishibaiBedsInput).toHaveValue('16');
    });

    test('should open ConfirmModal on save, and handle cancellation', async ({ page }) => {
        const saveButton = page.locator('button', { hasText: 'Salvar' });
        await saveButton.click();

        // Verify ConfirmModal opens
        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('h2', { hasText: 'Salvar Configurações de TV' })).toBeVisible();

        // Cancel the modal
        await modal.locator('button', { hasText: 'Cancelar' }).click();

        // Verify modal closes and save button is still "Salvar"
        await expect(modal).not.toBeVisible();
        await expect(saveButton).toHaveText('Salvar');
    });

    test('should successfully save settings through ConfirmModal', async ({ page }) => {
        // Change a setting to trigger a save
        const rotationToggle = page.locator('div.toggle-row', { hasText: 'Rotação habilitada' }).locator('button[role="switch"]');
        await rotationToggle.click();

        const saveButton = page.locator('button', { hasText: 'Salvar' });
        await saveButton.click();

        // Use helper to fill ConfirmModal (no typed keyword needed for TV settings)
        await fillConfirmModal(page, 'Testando atualização de TV via E2E');

        // Note: Due to React state updates & mock/live Firebase, the easiest assertion
        // is that the button transitions to "✓ Salvo" or "Salvando..."
        // In local emulation with real latency, it might immediately be ✓ Salvo or
        // we might catch "Salvando...". Let's wait for "✓ Salvo".
        await expect(page.locator('button', { hasText: '✓ Salvo' })).toBeVisible({ timeout: 5000 });

        // Then it should eventually revert to "Salvar"
        await expect(page.locator('button', { hasText: /^Salvar$/ })).toBeVisible({ timeout: 5000 });
    });
});
