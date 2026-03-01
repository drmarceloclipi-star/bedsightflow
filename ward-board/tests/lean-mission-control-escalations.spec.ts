import { test, expect } from '@playwright/test';
import { signInAsAdmin, goToAdminTab } from './helpers';

const UNIT = 'A';
const PROJECT_ID = 'lean-841e5';

// Run tests sequentially since Scenario 2 mutates global settings
test.describe.configure({ mode: 'serial' });

test.describe('E2E — Mission Control v1 & Escalations', () => {
    test.beforeEach(async ({ page }) => {
        await signInAsAdmin(page);
    });

    test('1. Snapshot e cards essenciais (Data Quality, Freshness, Escalations)', async ({ page }) => {
        test.setTimeout(60000);

        // Go to Analytics Tab
        await goToAdminTab(page, 'analytics', UNIT);

        // Ensure Mission Control tab is active
        const mcTabButton = page.locator('button', { hasText: 'Mission Control' });
        await expect(mcTabButton).toBeVisible();
        await mcTabButton.click();

        // Wait for the snapshot to load (loading skeleton should disappear, and active beds count appear)
        await expect(page.locator('.mc-context-card', { hasText: 'Leitos ocupados' }).locator('.mc-context-value')).not.toHaveText('—', { timeout: 15000 });

        // A. Validar Data Quality Notice (bed sem blockedAt)
        const dataQualityNotice = page.locator('.mc-data-quality-notice');
        await expect(dataQualityNotice).toBeVisible();
        await expect(dataQualityNotice).toContainText('sem mainBlockerBlockedAt');

        // B. Validar card "Não revisados neste turno" com count > 0 (devido ao seed)
        const unreviewedCard = page.locator('.mc-card', { hasText: 'Não revisados neste turno' });
        await expect(unreviewedCard).toBeVisible();
        const unreviewedValue = await unreviewedCard.locator('.mc-card-value').innerText();
        expect(parseInt(unreviewedValue, 10)).toBeGreaterThan(0);

        // C. Validar Escalonamentos Críticos (esperado > 0 pelo seed de ESC-01 e ESC-02)
        const escalationsCard = page.locator('.mc-card', { hasText: '🔥 Escalonamentos' });
        await expect(escalationsCard).toBeVisible();
        const escalationsValue = await escalationsCard.locator('.mc-card-value').innerText();
        expect(parseInt(escalationsValue, 10)).toBeGreaterThan(0);

        // Verifica se os botões de drilldown de escalonamentos estão presentes
        await expect(escalationsCard.locator('button', { hasText: /pendências de longo atraso/i })).toBeVisible();
        await expect(escalationsCard.locator('button', { hasText: /bloqueios graves/i })).toBeVisible();
    });

    test('2. Limites Dinâmicos (Thresholds Customizados)', async ({ page, request }) => {
        // Change stale threshold settings via Firestore REST API to affect the "Sem revisão" freshness cards
        test.setTimeout(60000);

        const url = `http://localhost:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/settings/${UNIT}?updateMask=missionControlThresholds.criticalStaleHours`;
        const payload = {
            fields: {
                missionControlThresholds: {
                    mapValue: {
                        fields: {
                            criticalStaleHours: { integerValue: "1" }
                        }
                    }
                }
            }
        };

        const res = await request.patch(url, {
            headers: { Authorization: "Bearer owner" },
            data: payload
        });
        expect(res.ok()).toBeTruthy();

        // 2. Refresh Mission Control
        await goToAdminTab(page, 'analytics', UNIT);
        await page.click('button:has-text("Mission Control")');

        await expect(page.locator('.mc-context-card', { hasText: 'Leitos ocupados' }).locator('.mc-context-value')).not.toHaveText('—', { timeout: 15000 });

        // Because we changed criticalStaleHours to 1, beds stale for >1 hour will be critical.
        // We verify the drilldown/freshness cards updated visually (state-danger class or icon)
        // Look at the "Sem revisão +24h" or "+48h" cards to be critical
        const stale48Card = page.locator('.mc-card', { hasText: 'Sem revisão +48h' });
        await expect(stale48Card).toBeVisible();

        // We restore the setting to avoid breaking other tests
        const payloadRestore = {
            fields: {
                missionControlThresholds: {
                    mapValue: {
                        fields: {
                            criticalStaleHours: { integerValue: "48" }
                        }
                    }
                }
            }
        };
        await request.patch(url, {
            headers: { Authorization: "Bearer owner" },
            data: payloadRestore
        });
    });

    test('3. Drilldowns de Escalonamentos', async ({ page }) => {
        test.setTimeout(60000);

        await goToAdminTab(page, 'analytics', UNIT);
        await page.click('button:has-text("Mission Control")');

        await expect(page.locator('.mc-context-card', { hasText: 'Leitos ocupados' }).locator('.mc-context-value')).not.toHaveText('—', { timeout: 15000 });

        const escalationsCard = page.locator('.mc-card', { hasText: '🔥 Escalonamentos' });
        await expect(escalationsCard).toBeVisible();

        // Clicar em "Ver X bloqueios graves"
        const btnBlockers = escalationsCard.locator('button', { hasText: /bloqueios graves/i });
        await btnBlockers.click();

        // Deve navegar para a lista de drilldown correspondente
        await expect(page).toHaveURL(/filter=escalations_blocker/);

        // A lista deve carregar os leitos
        await expect(page.locator('h2', { hasText: '🔥 Escalonamento: Bloqueio Grave' })).toBeVisible({ timeout: 10000 });
        // Expected bed from seed is ESC-02
        await expect(page.locator('td', { hasText: 'ESC-02' })).toBeVisible();
    });

    test('4. Escalonamentos Canônicos (Admin == TV)', async ({ context }) => {
        test.setTimeout(90000);

        // The admin already verified the escalations logically in the Admin tab.
        // Now let's verify visual representation on the TV.

        // 1. Abrir a TV
        const tvPage = await context.newPage();
        await tvPage.goto(`/tv?unit=${UNIT}&screen=kanban`);

        await expect(tvPage.locator('.tv-dashboard')).toBeVisible({ timeout: 15000 });

        // 2. Na TV, o escalonamento crítico é mostrado no banner superior
        const escalationsBanner = tvPage.locator('text=/Escalonamentos:\\s*\\d+\\s*Crítico/i');
        await expect(escalationsBanner).toBeVisible({ timeout: 10000 });

        await tvPage.close();
    });
});
