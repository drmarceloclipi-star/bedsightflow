import { test, expect } from '@playwright/test';
import { signInAsAdmin, signInAsEditor } from './helpers';

// Configure this entire file to run in a mobile viewport with a mobile User-Agent
test.use({
    viewport: { width: 375, height: 812 }, // iPhone X dimensions
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 by Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
});

test.describe('Mobile Navigation Flows', () => {

    test('admin login redirects to mobile-admin and displays mobile navigation', async ({ page }) => {
        // Log in as an admin
        await signInAsAdmin(page);

        // Expect to be redirected to /mobile-admin instead of /admin
        await expect(page).toHaveURL(/\/mobile-admin/);

        // Expect the Mobile Admin Home to be visible
        await expect(page.locator('.madmin-page-title')).toHaveText('Painel Admin');

        // Ensure standard desktop admin components are NOT visible
        await expect(page.locator('.admin-layout')).not.toBeVisible();

        // Enter a unit 
        const enterButton = page.locator('button', { hasText: 'Entrar →' }).first();
        await enterButton.waitFor({ state: 'visible' });
        await enterButton.click();

        // Wait for the unit shell
        await expect(page).toHaveURL(/\/mobile-admin\/unit\//);

        // Verify bottom navigation is present
        const bottomNav = page.locator('.madmin-bottom-nav');
        await expect(bottomNav).toBeVisible();
        await expect(bottomNav.locator('button', { hasText: 'TV' })).toBeVisible();
        await expect(bottomNav.locator('button', { hasText: 'Leitos' })).toBeVisible();

        // Test clicking out to the Editor from the header button
        // Mobile header has an emoji button for Editor: "📱" and TV: "📺"
        await page.locator('button[title="Abrir edição mobile"]').click();

        // Verify Editor is loaded properly
        await expect(page).toHaveURL(/\/editor\?unit=/);
        await expect(page.locator('.mobile-layout')).toBeVisible();
        await expect(page.locator('h2', { hasText: 'Leitos' })).toBeVisible();

        // Go back to the admin page
        await page.goBack();
        await expect(page).toHaveURL(/\/mobile-admin\/unit\//);
        await expect(page.locator('.madmin-bottom-nav')).toBeVisible();

        // Test clicking out to the TV from the header button
        await page.locator('button[title="Abrir exibição TV"]').click();

        // Verify TV is loaded properly and uses the standard TvDashboard (not a mobile-specific one)
        await expect(page).toHaveURL(/\/tv\?unit=/);
        // It should have the standard desktop TV header
        await expect(page.locator('.tv-dashboard .tv-header')).toBeVisible();
        await expect(page.locator('.unit-badge', { hasText: 'Unidade' })).toBeVisible();
    });

    test('editor login redirects to editor directly', async ({ page }) => {
        // Log in as a non-admin editor
        await signInAsEditor(page);

        // Expect to be redirected to /editor
        await expect(page).toHaveURL(/\/editor/);

        // The layout should be mobile natively
        await expect(page.locator('.mobile-layout')).toBeVisible();
    });

    test('direct navigation to /tv as mobile loads standard TvDashboard', async ({ page }) => {
        await signInAsAdmin(page);

        // Navigate directly to /tv
        await page.goto('/tv?unit=A');

        // Validate standard TvDashboard is active (no mobile override)
        await expect(page.locator('.tv-dashboard .tv-header')).toBeVisible();
        await expect(page.locator('.unit-badge', { hasText: 'Unidade A' })).toBeVisible();
    });
});
