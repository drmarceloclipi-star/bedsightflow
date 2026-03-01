import { test, expect } from '@playwright/test';
import { signInAsAdmin, signInAsEditor, autoAcceptDialogs } from './helpers';

test.describe('Pendency Deletion RBAC', () => {

    test.beforeEach(async ({ page }) => {
        // Listen for console messages
        page.on('console', msg => {
            console.log(`BROWSER [${msg.type()}] ${msg.text()}`);
        });

        // Listen for network requests to emulator
        page.on('request', request => {
            if (request.url().includes('8080') || request.url().includes('9099') || request.url().includes('5001')) {
                console.log(`NETWORK >> ${request.method()} ${request.url()}`);
            }
        });

        page.on('response', response => {
            if (response.url().includes('8080') || response.url().includes('9099') || response.url().includes('5001')) {
                console.log(`NETWORK << ${response.status()} ${response.url()}`);
            }
        });

        // Auto-accept confirmation dialogs
        autoAcceptDialogs(page, 'Test reason');
    });

    test('Editor can add a pendency but CANNOT see the delete button', async ({ page }) => {
        await signInAsEditor(page);

        // Go to a specific unit editor
        await page.goto('/editor?unit=A');

        // Click the first bed card
        // Based on MobileDashboard.tsx: div class bg-surface-1 inside grid
        const firstBed = page.locator('.mobile-dashboard .grid > div').first();
        await firstBed.waitFor({ state: 'visible', timeout: 15000 });
        await firstBed.click();

        // Ensure we are in the bed details view
        // Based on BedDetails.tsx: h2 class text-2xl font-serif
        await expect(page.locator('h2', { hasText: /Leito/ })).toBeVisible({ timeout: 15000 });

        // Add a pendency
        // Based on BedDetails.tsx: input placeholder="Nova pendência (obrigatório)"
        const pendencyTitleInput = page.locator('input[placeholder="Nova pendência (obrigatório)"]');
        await pendencyTitleInput.fill('Pendency by Editor');
        // Based on BedDetails.tsx: button with text "+ Adicionar pendência"
        await page.locator('button', { hasText: '+ Adicionar pendência' }).click();

        // Verify the pendency appears
        // Based on BedDetails.tsx: it's a div.flex.items-start.gap-2.bg-surface-2.rounded-lg.p-3
        const pendencyItem = page.locator('div.bg-surface-2', { hasText: 'Pendency by Editor' }).first();
        await expect(pendencyItem).toBeVisible({ timeout: 10000 });

        // Verify delete button is not present
        // Based on BedDetails.tsx: aria-label="Excluir permanentemente: ..." title="Excluir permanentemente (admin)"
        const deleteBtn = pendencyItem.locator('button[title^="Excluir permanentemente"]');
        await expect(deleteBtn).toHaveCount(0);
    });

    test('Admin CAN see the delete button and successfully delete a pendency', async ({ page }) => {
        await signInAsAdmin(page);

        // Go to a specific unit editor
        await page.goto('/editor?unit=A');

        // Click the first bed card
        const firstBed = page.locator('.mobile-dashboard .grid > div').first();
        await firstBed.waitFor({ state: 'visible', timeout: 15000 });
        await firstBed.click();

        // Ensure we are in the bed details view
        await expect(page.locator('h2', { hasText: /Leito/ })).toBeVisible({ timeout: 15000 });

        // Add a pendency
        const uniqueTitle = `Pendency by Admin ${Date.now()}`;
        const pendencyTitleInput = page.locator('input[placeholder="Nova pendência (obrigatório)"]');
        await pendencyTitleInput.fill(uniqueTitle);
        await page.locator('button', { hasText: '+ Adicionar pendência' }).click();

        // Verify the pendency appears
        const pendencyItem = page.locator('div.bg-surface-2', { hasText: uniqueTitle }).first();
        await expect(pendencyItem).toBeVisible({ timeout: 10000 });

        // Verify delete button is present (Admin only)
        const deleteBtn = pendencyItem.locator('button[title^="Excluir permanentemente"]');
        await expect(deleteBtn).toBeVisible();

        // Click delete
        await deleteBtn.click();

        // Wait for it to disappear
        await expect(pendencyItem).not.toBeVisible({ timeout: 15000 });
    });

});
