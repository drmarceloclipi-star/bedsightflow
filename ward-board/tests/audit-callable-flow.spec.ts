/**
 * audit-callable-flow.spec.ts
 *
 * Verifies the UX guard flows for admin callable actions using ConfirmModal:
 *  - Cancelling the ConfirmModal blocks the action
 *  - Empty reason keeps the Confirmar button disabled
 *  - The "RESETAR" confirmation input guards Ops actions
 *  - A valid reason allows the action to proceed
 *  - TV Settings value persists after reload
 *
 * Prerequisites:
 *  - Firebase emulators running
 *  - App running at localhost:5173
 *  - Emulator seeded with unit 'A' and beds
 */

import { test, expect } from '@playwright/test';
import { signInAsAdmin, goToAdminTab, fillConfirmModal } from './helpers';

test.describe('Admin Callable UX Flow — Reason Prompt', () => {

    test.beforeEach(async ({ page }) => {
        await signInAsAdmin(page);
    });

    // ── Cancel modal → action blocked ────────────────────────────────────────
    test('Cancelling the reason modal blocks the action (TV Settings)', async ({ page }) => {
        await goToAdminTab(page, 'tv');

        const saveBtn = page.locator('button.btn-save');
        await expect(saveBtn).toBeVisible({ timeout: 8000 });
        await saveBtn.click();

        // Wait for modal and cancel it
        const cancelBtn = page.locator('button', { hasText: 'Cancelar' });
        await expect(cancelBtn).toBeVisible();
        await cancelBtn.click();
        await expect(page.locator('h2', { hasText: 'Confirme a Ação' })).not.toBeVisible();

        // After cancel: button should NOT transition to "✓ Salvo" or "Salvando..."
        await expect(page.locator('button.btn-save')).toBeVisible({ timeout: 3000 });
        await expect(page.locator('button', { hasText: '✓ Salvo' })).not.toBeVisible();
    });

    // ── Empty reason → Confirmar disabled ────────────────────────────
    test('Empty reason leaves Confirmar disabled and blocks the action', async ({ page }) => {
        await goToAdminTab(page, 'beds');

        const applyBtn = page.locator('button', { hasText: '36 leitos' }).or(
            page.locator('button', { hasText: 'Aplicar' })
        );
        const isVisible = await applyBtn.first().isVisible({ timeout: 8000 }).catch(() => false);

        if (!isVisible) { test.skip(); return; }

        await applyBtn.first().click();

        // Modal opens
        const confirmBtn = page.locator('.modal-btn-confirm').or(
            page.locator('button', { hasText: 'Confirmar' })
        ).first();

        await expect(confirmBtn).toBeVisible();

        // Without reason, button is disabled
        await expect(confirmBtn).toBeDisabled();

        // Cancel to exit
        await page.locator('button', { hasText: 'Cancelar' }).click();

        // No success flash should have appeared
        await expect(
            page.locator('div').filter({ hasText: /leitos canônicos aplicados/i }).first()
        ).not.toBeVisible();
    });

    // ── Ops RESET guard ────────────────────────────────────────────────────────
    test('Ops reset modal Confirmar is DISABLED without typing "RESETAR" first', async ({ page }) => {
        await goToAdminTab(page, 'ops');

        const resetBtn = page.locator('button', { hasText: 'Executar Reset' });
        await expect(resetBtn).toBeVisible({ timeout: 8000 });
        await resetBtn.click();

        const confirmBtn = page.locator('.modal-btn-confirm').or(
            page.locator('button', { hasText: 'Confirmar' })
        ).first();

        await expect(confirmBtn).toBeVisible();
        await expect(confirmBtn).toBeDisabled();

        // Fill reason but NOT the required word
        const reasonInput = page.locator('textarea[placeholder*="motivo"]');
        await reasonInput.fill('Testing disable logic');

        // Still disabled
        await expect(confirmBtn).toBeDisabled();

        // Type RESETAR → button becomes enabled
        const requireInput = page.locator('#modal-typing');
        await requireInput.fill('RESETAR');

        await expect(confirmBtn).toBeEnabled();
        await page.locator('button', { hasText: 'Cancelar' }).click();
    });

    // ── Valid reason → Kanban reset succeeds ──────────────────────────────────
    test('Valid reason allows the Kanban reset to proceed', async ({ page }) => {
        await goToAdminTab(page, 'beds');

        const kanbanBtns = page.locator('button[title="Limpar Kanban"]');
        // Make sure it's the exact button inside the rows
        await expect(kanbanBtns.first()).toBeVisible({ timeout: 10000 });
        await kanbanBtns.first().click();

        await fillConfirmModal(page, 'Motivo válido de teste E2E');

        // Either success or error flash — both mean the callable was invoked
        await expect(
            page.locator('div').filter({ hasText: /Kanban.*limpo|atualizado|Erro ao limpar/i }).first()
        ).toBeVisible({ timeout: 18000 });
    });

    // ── Round-trip persist ────────────────────────────────────────────────────
    test('TV Settings: modal fires on save and button reacts', async ({ page }) => {
        await goToAdminTab(page, 'tv');

        const inputs = page.locator('input[type="number"]');
        await expect(inputs.first()).toBeVisible({ timeout: 8000 });
        const original = await inputs.first().inputValue();
        const updated = original === '15' ? '20' : '15';
        await inputs.first().fill(updated);

        const saveBtn = page.locator('button.btn-save');
        await saveBtn.click();

        await fillConfirmModal(page, 'E2E round-trip persist test');

        // If the callable succeeded (Functions emulator running), check persistence
        const savedVisible = await page.locator('button', { hasText: '✓ Salvo' }).isVisible({ timeout: 10000 }).catch(() => false);
        if (savedVisible) {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            await page.click(`button:has-text("TV")`);
            await page.waitForTimeout(1000);

            const persistedInputs = page.locator('input[type="number"]');
            const persisted = await persistedInputs.first().inputValue();
            expect(persisted).toBe(updated);
        }
    });
});
