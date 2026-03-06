import { test, expect } from '@playwright/test';

test.describe('Editor Mobile to TV Kanban Synchronization', () => {

    test('Editor modifies two beds on mobile and changes appear on TV', async ({ browser }) => {
        // We use two different browser contexts to simulate Mobile (Editor) and TV displays
        const editorContext = await browser.newContext({
            viewport: { width: 430, height: 932 }, // Mobile viewport
        });
        const editorPage = await editorContext.newPage();

        // 1. Log in as Editor
        await editorPage.goto('/login');
        // Fill the local login form inputs
        const emailInput = editorPage.locator('input[name="email"]');
        await emailInput.waitFor({ state: 'visible' });
        await emailInput.fill('editor@lean.com');
        await editorPage.fill('input[name="password"]', 'password123');
        await editorPage.click('button[type="submit"]:has-text("Entrar Localmente")');

        // 2. Wait for navigation to /portal
        await editorPage.waitForURL(/\/portal/);

        // Click on the unit editor card
        await editorPage.click('text="Gestão de Leitos"');
        await editorPage.waitForURL(/\/editor/);

        // Ensure we are selecting Unit A if required (the URL might just be /editor, but the content should load beds)
        // Wait for the beds to be loaded. '301.1' should be visible.
        await editorPage.waitForSelector('text="301.1"');

        // 3. Open TV Dashboard in parallel, USING THE SAME CONTEXT to share auth!
        const tvPage = await editorContext.newPage();
        await tvPage.setViewportSize({ width: 1920, height: 1080 });
        await tvPage.goto('/tv?unit=A');

        // 4. On Mobile, select the first bed (e.g., 301.1) and modify its blocker
        // Wait for the bed card to appear
        await editorPage.click('text="301.1"');

        // Wait for the details modal/page
        const textAreaSelector = 'textarea[placeholder="Descreva o que está impedindo a alta..."]';
        await editorPage.waitForSelector(textAreaSelector);
        const uniqueId1 = `E2E Blocker Test 1 - ${Date.now()}`;
        await editorPage.fill(textAreaSelector, uniqueId1);

        // Explicitly blur the textarea to trigger onBlur -> handleSaveBlocker
        await editorPage.locator(textAreaSelector).blur();

        // Wait for the async save to Firestore to process before unmounting the component
        await editorPage.waitForTimeout(1000);
        await editorPage.goBack();

        // 5. Select the second bed (e.g., 301.2) and modify its blocker
        await editorPage.waitForSelector('text="301.2"'); // make sure dashboard is back
        await editorPage.click('text="301.2"');
        await editorPage.waitForSelector(textAreaSelector);

        const uniqueId2 = `E2E Blocker Test 2 - ${Date.now()}`;
        await editorPage.fill(textAreaSelector, uniqueId2);

        await editorPage.locator(textAreaSelector).blur();

        // Wait for the async save again
        await editorPage.waitForTimeout(1000);
        await editorPage.goBack();

        // Reload TV dashboard to reset rotation loop to Kanban Page 1 (where 301.1 and 301.2 are)
        await tvPage.reload({ waitUntil: 'domcontentloaded' });

        // Wait up to 5 seconds for the TV logic to fetch beds
        await tvPage.waitForTimeout(2000);

        // 6. Assert on TV Dashboard that the changes are visible
        await expect(tvPage.locator(`text="${uniqueId1}"`)).toBeVisible({ timeout: 15000 });
        await expect(tvPage.locator(`text="${uniqueId2}"`)).toBeVisible({ timeout: 15000 });

        await editorContext.close();
    });
});
