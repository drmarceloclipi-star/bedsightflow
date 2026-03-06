/**
 * playwright-rbac.config.ts
 * ─────────────────────────
 * Configuração Playwright dedicada para a bateria RBAC E2E.
 *
 * Uso:
 *   npx playwright test --config=playwright-rbac.config.ts
 *   npm run test:rbac
 *
 * Diferenças em relação ao playwright.config.ts padrão:
 *   - Roda apenas rbac-e2e-comprehensive.spec.ts
 *   - workers=1 (testes RBAC compartilham estado de sessão — rodar sequencialmente)
 *   - Salva HTML report em playwright-report-rbac/
 *   - trace: 'on' para evidência completa de todos os testes
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: '**/rbac-e2e-comprehensive.spec.ts',

    // Sequential: RBAC tests share emulator state (users, Firestore docs)
    // and some tests open/close browser contexts that could interfere if parallel
    fullyParallel: false,
    workers: 1,

    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,

    reporter: [
        ['html', { outputFolder: 'playwright-report-rbac', open: 'never' }],
        ['list'],
    ],

    timeout: 60_000,

    use: {
        baseURL: 'http://localhost:5173',
        // Full trace for every test — RBAC tests are the audit trail
        trace: 'on',
        screenshot: 'on',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Use the cached chromium binary (avoids re-download in restricted environments)
                launchOptions: {
                    executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'] ??
                        '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                },
            },
        },
    ],

    webServer: [
        {
            // Firebase emulators (auth:9099, firestore:8080, functions:5001)
            command: 'npm run emulators',
            port: 9099,
            reuseExistingServer: true,
            timeout: 120_000,
        },
        {
            // Vite dev server
            command: 'npm run dev',
            port: 5173,
            reuseExistingServer: true,
            timeout: 60_000,
        },
    ],
});
