import { test, expect } from '@playwright/test';
import { signInAsAdmin, goToAdminTab } from './helpers';

test.describe('Kanban Mode - Missões 1 e 2', () => {

    test.beforeEach(async ({ page }) => {
        await signInAsAdmin(page);
    });

    test('CT02.2 / CT02.4 - Toggle Kanban Mode no Desktop e bloqueio de UI de Soft Reset', async ({ page }) => {
        await page.goto('/admin/unit/A');
        await goToAdminTab(page, 'ops');

        const togglePassive = page.locator('button:has-text("PASSIVE")').first();
        const toggleActiveLite = page.locator('button:has-text("ACTIVE_LITE")').first();

        // Garantir estado inicial PASSIVE
        if (await toggleActiveLite.evaluate((el: HTMLElement) => el.className.includes('text-primary')).catch(() => false)) {
            await togglePassive.click();
            try { await expect(page.locator('div[role="status"]:has-text("Modo operacional salvo com sucesso.")')).toBeVisible({ timeout: 2000 }); } catch { }
            await page.waitForTimeout(500); // Wait for writes and flashes to clear
        }

        // Ação: Alterar para ACTIVE_LITE
        await toggleActiveLite.click();

        // Validações
        await expect(page.locator('text=Habilita regras mínimas de governança').first()).toBeVisible({ timeout: 5000 });
        await expect(page.locator('div[role="status"]:has-text("Modo operacional salvo com sucesso.")')).toBeVisible();
        await expect(toggleActiveLite).toHaveClass(/text-primary|bg-primary/);

        // Reverter para PASSIVE
        await togglePassive.click();
        await expect(page.locator('div[role="status"]:has-text("Modo operacional salvo com sucesso.")')).toBeVisible({ timeout: 5000 });
        await expect(togglePassive).toHaveClass(/text-primary|bg-primary/);
    });

    test('CT04.1 / CT04.2 - Sincronização Real-time Editor e TV', async ({ page }) => {
        const adminPage = page;
        const context = adminPage.context();
        const editorPage = await context.newPage();
        const tvPage = await context.newPage();

        // Go to Admin Ops
        await adminPage.goto('/admin/unit/A');
        await goToAdminTab(adminPage, 'ops');

        // Force PASSIVE initially
        const togglePassive = adminPage.locator('button:has-text("PASSIVE")').first();
        const toggleActiveLite = adminPage.locator('button:has-text("ACTIVE_LITE")').first();
        if (await toggleActiveLite.evaluate((el: HTMLElement) => el.className.includes('bg-primary')).catch(() => false)) {
            await togglePassive.click();
            await expect(adminPage.locator('div[role="status"]:has-text("Modo operacional salvo com sucesso.")')).toBeVisible({ timeout: 10000 });
            await adminPage.waitForTimeout(1000);
        }

        await editorPage.goto('/editor?unit=A');
        await editorPage.waitForSelector('text=ativos', { timeout: 15000 });
        const firstBed = editorPage.locator('.bg-surface-1').nth(0);
        await firstBed.click();

        // Prepare TV
        await tvPage.goto('/tv?unit=A');
        await tvPage.waitForSelector('.tv-dashboard, .mobile-dashboard', { timeout: 15000 });

        // Ensure both see PASSIVE initially
        await expect(editorPage.locator('text=Modo: PASSIVE').first()).toBeVisible({ timeout: 10000 });
        await expect(tvPage.locator('text=Modo: PASSIVE').first()).toBeVisible({ timeout: 10000 });

        // Admin changes to ACTIVE_LITE
        await toggleActiveLite.click();
        await expect(adminPage.locator('div[role="status"]:has-text("Modo operacional salvo com sucesso.")')).toBeVisible({ timeout: 10000 });
        await expect(toggleActiveLite).toHaveClass(/text-primary|bg-primary/);

        // Both Editor and TV should update automatically without reload
        await expect(editorPage.locator('text=Modo: ACTIVE_LITE').first()).toBeVisible({ timeout: 10000 });
        await expect(tvPage.locator('text=Modo: ACTIVE_LITE').first()).toBeVisible({ timeout: 10000 });

        // Admin changes back to PASSIVE
        await togglePassive.click();
        await expect(adminPage.locator('div[role="status"]:has-text("Modo operacional salvo com sucesso.")')).toBeVisible({ timeout: 10000 });
        await expect(togglePassive).toHaveClass(/text-primary|bg-primary/);

        await expect(editorPage.locator('text=Modo: PASSIVE').first()).toBeVisible({ timeout: 10000 });
        await expect(tvPage.locator('text=Modo: PASSIVE').first()).toBeVisible({ timeout: 10000 });

        await editorPage.close();
        await tvPage.close();
    });

    test('CT02.3 / CT05.2 - Mobile Admin Toggle e topbar Mobile TV', async ({ browser }) => {
        const mobileContext = await browser.newContext({
            viewport: { width: 375, height: 812 },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
        });
        const mobilePage = await mobileContext.newPage();

        await signInAsAdmin(mobilePage);

        await mobilePage.goto('/mobile-admin/unit/A');

        const togglePassive = mobilePage.locator('button:has-text("PASSIVE")').first();
        const toggleActiveLite = mobilePage.locator('button:has-text("ACTIVE_LITE")').first();

        // Garantir estado inicial PASSIVE
        if (await toggleActiveLite.evaluate((el: HTMLElement) => el.className.includes('text-primary')).catch(() => false)) {
            await togglePassive.click();
            try { await expect(mobilePage.locator('div[role="status"]:has-text("Modo operacional salvo com sucesso.")')).toBeVisible({ timeout: 2000 }); } catch { }
            await mobilePage.waitForTimeout(500);
        }

        // Mudar para ACTIVE_LITE
        await toggleActiveLite.click();
        await expect(mobilePage.locator('div[role="status"]:has-text("Modo operacional salvo com sucesso.")')).toBeVisible({ timeout: 5000 });
        await expect(toggleActiveLite).toHaveClass(/text-primary|bg-primary/);

        // Voltar para PASSIVE
        await togglePassive.click();
        await expect(mobilePage.locator('div[role="status"]:has-text("Modo operacional salvo com sucesso.")')).toBeVisible({ timeout: 5000 });
        await expect(togglePassive).toHaveClass(/text-primary|bg-primary/);

        // CT05.2 - Checar TV mobile não exibe "Modo:"
        await mobilePage.goto('/tv?unit=A');
        await mobilePage.waitForSelector('.mobile-dashboard', { timeout: 15000 });
        await expect(mobilePage.locator('.mobile-header').locator('text=Modo:')).not.toBeVisible();

        await mobileContext.close();
    });

    test('CT05.1 - Flash Message Memory Leak prevention (Rapid toggles)', async ({ page }) => {
        await page.goto('/admin/unit/A');
        await goToAdminTab(page, 'ops');

        const togglePassive = page.locator('button:has-text("PASSIVE")').first();
        const toggleActiveLite = page.locator('button:has-text("ACTIVE_LITE")').first();

        // Rapidly toggle multiple times
        await toggleActiveLite.click();
        await togglePassive.click();
        await toggleActiveLite.click();
        await togglePassive.click();

        // Wait for final state and ensure the previous timeouts don't hide the current message too quickly
        const finalAlert = page.locator('div[role="status"]:has-text("Modo operacional salvo com sucesso.")');
        await expect(finalAlert).toBeVisible({ timeout: 10000 });

        // Keep checking visibility for 2 seconds - it shouldn't disappear due to early timeouts
        await page.waitForTimeout(2000);
        await expect(finalAlert).toBeVisible();

        // It should eventually disappear (after about 4 seconds total)
        await expect(finalAlert).not.toBeVisible({ timeout: 6000 });
    });
});
