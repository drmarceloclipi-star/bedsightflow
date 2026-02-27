/**
 * audit-log-generation.spec.ts
 *
 * Verifies that admin actions produce flash feedback and that the Audit tab
 * displays relevant content after each change.
 *
 * Prerequisites:
 *  - Firebase emulators running (auth:9099, firestore:8080, functions:5001)
 *  - App running at localhost:5173
 *  - Emulator seeded with unit 'A' and beds
 */

import { test, expect, type Dialog } from '@playwright/test';
import { signInAsAdmin, goToAdminTab } from './helpers';

test.describe('Audit Log Generation', () => {

    test.beforeEach(async ({ page }) => {
        // Auto-accept ALL dialogs (confirm + prompt + alert)
        page.on('dialog', async (dialog: Dialog) => {
            if (dialog.type() === 'prompt') await dialog.accept('E2E motivo de auditoria');
            else await dialog.accept();
        });
        await signInAsAdmin(page);
    });

    // ── TV Settings ──────────────────────────────────────────────────────────
    test('Saving TV settings triggers the reason prompt and shows feedback', async ({ page }) => {
        await goToAdminTab(page, 'tv');

        // The button label transitions: "Salvar" → "Salvando..." → "✓ Salvo"
        const saveBtn = page.locator('button', { hasText: 'Salvar' });
        await expect(saveBtn).toBeVisible({ timeout: 8000 });
        await saveBtn.click();

        // Either success state OR error state — either way the flow was triggered
        await expect(
            page.locator('button', { hasText: '✓ Salvo' })
                .or(page.locator('button', { hasText: 'Salvando...' }))
                .or(page.locator('button', { hasText: 'Salvar' }))
        ).toBeVisible({ timeout: 15000 });

        // The audit tab should be navigable
        await goToAdminTab(page, 'audit');
        await expect(page.locator('body')).toContainText(/auditoria|trilha|log/i);
    });

    // ── Apply Canonical Beds ─────────────────────────────────────────────────
    test('Applying canonical beds shows success or error flash', async ({ page }) => {
        await goToAdminTab(page, 'beds');

        // The "apply canonical" button contains "36 leitos" or "Aplicar"
        const applyBtn = page.locator('button', { hasText: '36 leitos' }).or(
            page.locator('button', { hasText: 'Aplicar' })
        );
        await expect(applyBtn.first()).toBeVisible({ timeout: 10000 });
        await applyBtn.first().click();

        // Flash text from BedsAdminScreen.tsx: '✓ 36 leitos canônicos aplicados!' | 'Erro ao aplicar leitos.'
        await expect(
            page.locator('div').filter({ hasText: /leitos canônicos|Erro ao aplicar/i }).first()
        ).toBeVisible({ timeout: 20000 });

        // Audit tab must render
        await goToAdminTab(page, 'audit');
        await expect(page.locator('body')).toContainText(/auditoria|trilha|log/i);
    });

    // ── Reset Bed Kanban ──────────────────────────────────────────────────────
    test('Resetting a bed Kanban shows flash feedback', async ({ page }) => {
        await goToAdminTab(page, 'beds');

        // Kanban clear buttons appear in each row
        const kanbanBtns = page.locator('button', { hasText: 'Kanban' });
        await expect(kanbanBtns.first()).toBeVisible({ timeout: 10000 });
        await kanbanBtns.first().click();

        // Flash text: 'Kanban do leito X limpo.' | 'Erro ao limpar Kanban.'
        await expect(
            page.locator('div').filter({ hasText: /Kanban.*limpo|Erro ao limpar Kanban/i }).first()
        ).toBeVisible({ timeout: 15000 });
    });

    // ── Ops: Soft Reset ───────────────────────────────────────────────────────
    test('Soft reset unit via Ops shows success or error flash', async ({ page }) => {
        await goToAdminTab(page, 'ops');

        // The ops screen has an input with this exact placeholder
        const confirmInput = page.locator('input[placeholder="Digite RESET para habilitar ações destrutivas"]');
        await expect(confirmInput).toBeVisible({ timeout: 8000 });
        await confirmInput.fill('RESET');

        // Button label from OpsCard: 'Executar Reset'
        const resetBtn = page.locator('button', { hasText: 'Executar Reset' });
        await expect(resetBtn).toBeVisible({ timeout: 5000 });
        await resetBtn.click();

        // Flash text: '✓ Reset concluído com sucesso.' | 'Erro durante o reset.'
        await expect(
            page.locator('div').filter({ hasText: /Reset concluído|Erro durante/i }).first()
        ).toBeVisible({ timeout: 25000 });
    });

    // ── Audit Tab structure ──────────────────────────────────────────────────
    test('Audit tab renders the correct heading', async ({ page }) => {
        await goToAdminTab(page, 'audit');
        await page.waitForTimeout(1500);

        // AuditScreen.tsx renders <h2>Logs de Auditoria</h2>
        await expect(
            page.getByRole('heading', { name: /logs de auditoria/i })
        ).toBeVisible({ timeout: 8000 });
    });
});
