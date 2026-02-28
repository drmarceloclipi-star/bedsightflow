import { test, expect } from '@playwright/test';
import { signInAsAdmin, goToAdminTab, fillConfirmModal } from './helpers';

test.describe('Beds Admin Screen', () => {
    test.beforeEach(async ({ page }) => {
        // Sign in and go to Beds tab for unit 'A'
        await signInAsAdmin(page);
        await goToAdminTab(page, 'beds');

        // Wait for the table or empty state to load
        await expect(page.locator('.admin-card').getByText(/Carregando base de leitos/i)).not.toBeVisible({ timeout: 15000 });
    });

    test('can apply canonical beds', async ({ page }) => {
        // The button might be "Aplicar 36 leitos padrão" or "Criar Estrutura Inicial"
        const applyBtn = page.locator('button', { hasText: /(Aplicar 36 leitos padrão|Criar Estrutura Inicial)/ }).first();
        await expect(applyBtn).toBeVisible();
        await applyBtn.click();

        // Verify ConfirmModal opens
        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('h2', { hasText: 'Aplicar Leitos Padrão' })).toBeVisible();

        // Fill reason and confirm
        await fillConfirmModal(page, 'Testando aplicação canônica via E2E');

        // Check for success flash message
        await expect(page.locator('.flash-message', { hasText: '✓ 36 leitos' })).toBeVisible({ timeout: 10000 });

        // Wait for flash to disappear or table to have beds
        await expect(page.locator('table.admin-table tbody tr').first()).toBeVisible({ timeout: 10000 });
    });

    test('can trigger Kanban clear with standard ConfirmModal', async ({ page }) => {
        // We need at least one bed. If not, the previous test should have created them, or we create them.
        const row = page.locator('table.admin-table tbody tr').first();
        await expect(row).toBeVisible();

        const bedNumber = (await row.locator('td.font-bold').innerText()).trim();

        // Click 'K' button (Limpar Kanban)
        const kanbanBtn = row.locator('button', { hasText: 'K' });
        await kanbanBtn.click();

        // Verify ConfirmModal opens
        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('h2', { hasText: `Limpar Kanban - Leito ${bedNumber}` })).toBeVisible();

        // Fill reason and confirm
        await fillConfirmModal(page, 'Limpando Kanban via teste E2E');

        // Check for success flash message
        await expect(page.locator('.flash-message', { hasText: `✓ Leito ${bedNumber} atualizado!` })).toBeVisible({ timeout: 10000 });
    });

    test('can trigger Clear All requiring specific typed word', async ({ page }) => {
        const row = page.locator('table.admin-table tbody tr').first();
        await expect(row).toBeVisible();

        const bedNumber = (await row.locator('td.font-bold').innerText()).trim();

        // Click 'T' button (Limpar Tudo)
        const clearAllBtn = row.locator('button', { hasText: 'T' });
        await clearAllBtn.click();

        // Verify ConfirmModal opens
        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('h2', { hasText: `Limpar Tudo - Leito ${bedNumber}` })).toBeVisible();

        // Make sure the confirm button is initially disabled because of requireTyping
        const confirmBtn = modal.locator('.modal-btn-confirm');
        await expect(confirmBtn).toBeDisabled();

        // Fill the requireTyping and reason
        await fillConfirmModal(page, 'Limpando tudo via teste E2E', 'LIMPAR');

        // Check for success flash message
        await expect(page.locator('.flash-message', { hasText: `✓ Leito ${bedNumber} atualizado!` })).toBeVisible({ timeout: 10000 });
    });
});
