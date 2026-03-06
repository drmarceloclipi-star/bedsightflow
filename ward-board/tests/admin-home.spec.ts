import { test, expect } from '@playwright/test';
import { signInAsAdmin, autoAcceptDialogs } from './helpers';

test.describe('Admin Home Screen', () => {
    test.beforeEach(async ({ page }) => {
        await signInAsAdmin(page);
        await page.goto('/admin');
    });

    test('shows units list and can navigate to a unit', async ({ page }) => {
        // Wait for the admin home page to load
        await expect(page.locator('h1', { hasText: 'Painel Administrativo' })).toBeVisible();

        // Should be on the Units tab by default
        const unitsTab = page.locator('button[role="tab"]', { hasText: 'Unidades' });
        await expect(unitsTab).toHaveAttribute('aria-selected', 'true');

        // Look for the "Entrar →" button on the first unit card
        const enterButton = page.locator('button', { hasText: 'Entrar →' }).first();
        await expect(enterButton).toBeVisible();

        // Click and verify navigation to the unit
        await enterButton.click();
        await page.waitForURL(/\/admin\/unit\/.+/);
        await expect(page.locator('.admin-tabs')).toBeVisible(); // Tab bar of AdminUnitShell
    });

    test('can switch to global users tab and add a new authorized user', async ({ page }) => {
        // Switch to "Usuários Globais" tab
        const usersTab = page.locator('button[role="tab"]', { hasText: 'Usuários Globais' });
        await usersTab.click();
        await expect(usersTab).toHaveAttribute('aria-selected', 'true');

        // Check if the add user form is visible
        const emailInput = page.locator('input[placeholder="usuario@gmail.com"]');
        await expect(emailInput).toBeVisible();

        const testEmail = `test-global-${Date.now()}@example.com`;

        // Add a new user
        await emailInput.fill(testEmail);
        await page.locator('button', { hasText: 'Autorizar' }).click();

        // Verify the user appears in the table
        const userRow = page.locator('table.admin-table tbody tr', { hasText: testEmail });
        await expect(userRow).toBeVisible({ timeout: 10000 });
    });

    test('can remove a global authorized user via ConfirmModal', async ({ page }) => {
        // Switch to "Usuários Globais" tab
        const usersTab = page.locator('button[role="tab"]', { hasText: 'Usuários Globais' });
        await usersTab.click();

        // First add a user to ensure we have one to remove
        const testEmail = `test-remove-${Date.now()}@example.com`;
        const emailInput = page.locator('input[placeholder="usuario@gmail.com"]');
        await emailInput.fill(testEmail);
        await page.locator('button', { hasText: 'Autorizar' }).click();

        // Find the user row and click "Remover"
        const userRow = page.locator('table.admin-table tbody tr', { hasText: testEmail });
        await expect(userRow).toBeVisible({ timeout: 10000 });
        const removeButton = userRow.locator('button', { hasText: 'Remover' });
        await removeButton.click();

        // Verify ConfirmModal appears
        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('h2', { hasText: 'Remover Acesso' })).toBeVisible();
        await expect(modal.locator('text=' + testEmail)).toBeVisible();

        // Confirm the removal
        await modal.locator('textarea[placeholder*="motivo"]').fill('Motivo teste E2E');
        await modal.locator('button', { hasText: 'Remover Usuário' }).click();

        // Verify the modal closes and the user disappears from the list
        await expect(modal).not.toBeVisible();
        await expect(userRow).not.toBeVisible();
    });

    test('can logout clicking "Sair"', async ({ page }) => {
        // Remove native dialog popups just in case, though this is a straight redirect
        autoAcceptDialogs(page);

        const logoutButton = page.locator('button.admin-back-btn', { hasText: 'Sair' });
        await expect(logoutButton).toBeVisible();
        await logoutButton.click();

        // Should redirect to login
        await page.waitForURL(/\/login/);
        await expect(page.locator('button:has-text("Entrar Localmente")')).toBeVisible();
    });

    test('can open and cancel the "Nova Unidade" modal', async ({ page }) => {
        // Click the "+ Nova Unidade" button
        const newUnitButton = page.locator('button', { hasText: '+ Nova Unidade' });
        await expect(newUnitButton).toBeVisible();
        await newUnitButton.click();

        // Modal should appear
        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('h2', { hasText: 'Nova Unidade' })).toBeVisible();
        await expect(modal.locator('#unitName')).toBeVisible();

        // Cancel button closes the modal
        await modal.locator('button', { hasText: 'Cancelar' }).click();
        await expect(modal).not.toBeVisible();
    });

    test('can close the "Nova Unidade" modal with Escape', async ({ page }) => {
        const newUnitButton = page.locator('button', { hasText: '+ Nova Unidade' });
        await newUnitButton.click();

        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('h2', { hasText: 'Nova Unidade' })).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible();
    });

    test('can create a new unit', async ({ page }) => {
        const testUnitName = `Unidade Teste ${Date.now()}`;

        // Open the modal
        await page.locator('button', { hasText: '+ Nova Unidade' }).click();

        const modal = page.locator('[role="dialog"]');
        await expect(modal.locator('#unitName')).toBeVisible();

        // Fill in the unit name
        await modal.locator('#unitName').fill(testUnitName);

        // Select a specialty (the first one alphabetically — there's at least one)
        const firstCheckbox = modal.locator('input[type="checkbox"]').first();
        await firstCheckbox.check();

        // Submit
        await modal.locator('button', { hasText: 'Criar Unidade' }).click();

        // Modal should close
        await expect(modal).not.toBeVisible({ timeout: 10000 });

        // New unit should appear in the list
        const unitCard = page.locator('.admin-card', { hasText: testUnitName });
        await expect(unitCard).toBeVisible({ timeout: 10000 });
    });
});
