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
        // For local emulator auth, we can simulate the click on "Entrar com Google"
        // and then handle the popup or redirect if possible,
        // OR we can directly inject the auth state if we know how the app handles it.
        // The easiest way for emulator in Playwright is to interact with the emulator UI if redirected,
        // but the app is using redirect and the Google auth emulator interceptor.

        await editorPage.click('button:has-text("Entrar com Google")');
        // Wait for the popup or redirect to Firebase Auth Emulator
        await editorPage.waitForURL(/localhost:9099/);

        // In the emulator auth UI, click the account to sign in with, or click "Add new account"
        // and provide 'editor@lean.com'. We try to click "Add new account"
        await editorPage.click('button:has-text("Add new account")');

        // Fill the email and name
        await editorPage.fill('input[id="email-input"]', 'editor@lean.com');
        await editorPage.fill('input[id="display-name-input"]', 'Editor User');

        // Click "Sign In"
        await editorPage.click('button:has-text("Sign In")');

        // 2. Wait for navigation to /mobile
        await editorPage.waitForURL(/\/mobile/);

        // Ensure we are selecting Unit A if required (the URL might just be /mobile, but the content should load beds)
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
