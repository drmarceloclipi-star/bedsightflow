import { test, expect } from '@playwright/test';
import { signInAsEditor } from './helpers';

test('Login should redirect to /editor', async ({ page }) => {
    page.on('console', msg => console.log('Console:', msg.text()));
    await signInAsEditor(page);
    await expect(page).toHaveURL(/\/editor/);
    console.log("SUCCESSFULLY LOGGED IN AND REDIRECTED TO /editor");
});
