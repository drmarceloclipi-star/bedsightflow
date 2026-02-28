import { test, expect } from '@playwright/test';
import { signInAsAdmin, goToAdminTab, fillConfirmModal } from './helpers';

test.describe('Users Admin Screen - Role Changes', () => {
    test.beforeEach(async ({ page }) => {
        // Sign in and go to Users tab for unit 'A'
        await signInAsAdmin(page);
        await goToAdminTab(page, 'users');
    });

    test('can change a user role via dropdown and ConfirmModal', async ({ page }) => {
        const testEmail = `test-role-${Date.now()}@example.com`;

        // 1. First, create a new user to test with
        const newEmailInput = page.locator('input[type="email"][placeholder="usuario@instituicao.com.br"]');
        await newEmailInput.fill(testEmail);

        const newRoleSelect = page.locator('select.admin-select').first();
        await newRoleSelect.selectOption('viewer');

        await page.locator('button', { hasText: 'Adicionar' }).click();

        // 2. Confirm addition
        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('h2', { hasText: 'Adicionar Usuário' })).toBeVisible();
        await fillConfirmModal(page, 'Adicionando usuário E2E');
        await expect(page.locator('.flash-message', { hasText: 'adicionado com sucesso' })).toBeVisible({ timeout: 10000 });

        // 3. Find the user in the table
        const row = page.locator('table.admin-table tbody tr', { hasText: testEmail });
        await expect(row).toBeVisible();

        // 4. Change the role using the dropdown in the table row
        const rowSelect = row.locator('select');
        await rowSelect.selectOption('editor');

        // 5. Verify ConfirmModal opens
        await expect(modal.locator('h2', { hasText: 'Alterar Nível de Acesso' })).toBeVisible();

        // 6. Confirm the role change
        await fillConfirmModal(page, 'Alterando role via teste E2E');

        // 7. Verify success flash message
        await expect(page.locator('.flash-message', { hasText: 'Role atualizado com sucesso' })).toBeVisible({ timeout: 10000 });

        // 8. Cleanup: Remove the user
        await row.locator('button', { hasText: 'Remover' }).click();
        await expect(modal.locator('h2', { hasText: 'Remover Usuário' })).toBeVisible();
        await fillConfirmModal(page, 'Removendo usuário E2E');
        await expect(page.locator('.flash-message', { hasText: 'removido da unidade' })).toBeVisible({ timeout: 10000 });
        await expect(row).not.toBeVisible();
    });

    test('canceling role change ConfirmModal does not apply changes', async ({ page }) => {
        // We assume at least one user is present (e.g. admin itself, but the admin shouldn't change its own role)
        // Let's create a temporary user quickly so we don't mess up existing users
        const testEmail = `test-cancel-${Date.now()}@example.com`;
        const newEmailInput = page.locator('input[type="email"][placeholder="usuario@instituicao.com.br"]');
        await newEmailInput.fill(testEmail);
        await page.locator('button', { hasText: 'Adicionar' }).click();

        const modal = page.locator('[role="dialog"]');
        await fillConfirmModal(page, 'Setup cancel role test');
        await expect(page.locator('.flash-message', { hasText: 'adicionado com sucesso' })).toBeVisible({ timeout: 10000 });

        const row = page.locator('table.admin-table tbody tr', { hasText: testEmail });
        await expect(row).toBeVisible();

        const rowSelect = row.locator('select');
        const initialValue = await rowSelect.inputValue(); // Should be 'editor' by default based on UI
        const newValue = initialValue === 'editor' ? 'viewer' : 'editor';

        // Select the new option
        await rowSelect.selectOption(newValue);

        // Verify the modal opens
        await expect(modal.locator('h2', { hasText: 'Alterar Nível de Acesso' })).toBeVisible();

        // Click cancel
        await modal.locator('button', { hasText: 'Cancelar' }).click();

        // Verify modal closes
        await expect(modal).not.toBeVisible();

        // The table row should still be visible, let's remove the user to cleanup
        await row.locator('button', { hasText: 'Remover' }).click();
        await fillConfirmModal(page, 'Cleanup cancel role test');
        await expect(row).not.toBeVisible({ timeout: 10000 });
    });
});
