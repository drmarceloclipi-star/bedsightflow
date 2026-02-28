import { test, expect } from '@playwright/test';
import { signInAsAdmin, goToAdminTab } from './helpers';

test.describe('Analytics Screen', () => {
    test.beforeEach(async ({ page }) => {
        // Sign in and go to Analytics tab for unit 'A'
        await signInAsAdmin(page);
        await goToAdminTab(page, 'analytics');
    });

    test('renders Mission Control tab by default and handles refresh', async ({ page }) => {
        // Verify Mission Control is the active tab
        const mcTabBtn = page.locator('button.analytics-tab-btn', { hasText: 'Mission Control' });
        await expect(mcTabBtn).toHaveClass(/active/);

        // Verify some content from the Mission Control tab is rendered
        // We look for a generic metric card or the "Atualizado" span indicating the screen loaded
        const lastUpdated = page.locator('.mc-last-updated');
        await expect(lastUpdated).toBeVisible();
        await expect(lastUpdated).toContainText('Atualizado:');

        // Test the refresh button
        const refreshBtn = page.locator('button.mc-refresh-btn', { hasText: '↻ Atualizar' });
        await expect(refreshBtn).toBeVisible();

        // Wait a second so that the time changes or at least the click registers 
        // without too much flakiness (the actual data refresh happens under the hood)
        await page.waitForTimeout(1000);
        await refreshBtn.click();

        // Ensure UI stays stable after refresh
        await expect(lastUpdated).toBeVisible();
    });

    test('can switch to Exploracao tab', async ({ page }) => {
        // Switch to "Exploração" tab
        const explTabBtn = page.locator('button.analytics-tab-btn', { hasText: 'Exploração' });
        await explTabBtn.click();
        await expect(explTabBtn).toHaveClass(/active/);

        // Verify content from the Exploração tab appears
        await expect(page.locator('h2.analytics-section-divider-title', { hasText: '📊 Histórico e Tendências' })).toBeVisible();
    });
});
