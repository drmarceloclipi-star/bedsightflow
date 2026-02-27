import { test, expect } from '@playwright/test';

test.describe('Viewer Role RBAC Restrictions', () => {

    test('Viewer cannot access admin pages and receives clear error when trying to edit a bed', async ({ browser }) => {
        const viewerContext = await browser.newContext({
            viewport: { width: 430, height: 932 }, // Mobile viewport
        });
        const viewerPage = await viewerContext.newPage();

        // 1. Log in as Viewer
        await viewerPage.goto('/login');

        await viewerPage.click('button:has-text("Entrar com Google")');
        await viewerPage.waitForURL(/localhost:9099/);

        // In the emulator auth UI, click "Add new account"
        await viewerPage.click('button:has-text("Add new account")');

        // Fill the email and name
        await viewerPage.fill('input[id="email-input"]', 'viewer@lean.com');
        await viewerPage.fill('input[id="display-name-input"]', 'Viewer User');

        // Click "Sign In"
        await viewerPage.click('button:has-text("Sign In")');

        // Wait for navigation to /mobile
        await viewerPage.waitForURL(/\/mobile/);

        // 2. Try to access an Admin route
        await viewerPage.goto('/admin');

        // Because of the RouteGuard, viewer gets redirected to login (and from login, likely to /mobile or stays in login)
        // Let's just wait for the network idle or URL change to confirm they are not on '/admin'
        await viewerPage.waitForURL((url) => {
            return !url.pathname.startsWith('/admin');
        });

        const currentUrl = viewerPage.url();
        expect(currentUrl).not.toContain('/admin');

        // 3. Go to mobile dashboard and try to edit a bed
        await viewerPage.goto('/mobile');
        await viewerPage.waitForSelector('text="301.1"');

        // Open bed 301.1
        await viewerPage.click('text="301.1"');

        // Wait for the textarea
        const textAreaSelector = 'textarea[placeholder="Descreva o que está impedindo a alta..."]';
        await viewerPage.waitForSelector(textAreaSelector);

        // Try filling the text area
        const uniqueId1 = `Unauthorized edit ${Date.now()}`;
        await viewerPage.fill(textAreaSelector, uniqueId1);

        // Trigger save by blurring
        await viewerPage.locator(textAreaSelector).blur();

        // 4. Assert that the specific "Permissão negada" banner appears
        const errorBanner = viewerPage.locator('text="Permissão negada. Apenas editores podem fazer alterações."');
        await expect(errorBanner).toBeVisible({ timeout: 5000 });

        // Capture evidence of error message
        await viewerPage.screenshot({ path: 'viewer-error-banner.png' });

        await viewerContext.close();
    });
});
