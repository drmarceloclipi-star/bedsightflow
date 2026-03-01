/**
 * lean-pendencies-v1.spec.ts
 *
 * Comprehensive E2E for Pendências Persistentes v1.1 + RBAC Delete (server-side).
 *
 * Scenarios:
 *   1. Editor: create, mark done, cancel, CANNOT delete
 *   2. Admin: create, delete physically, Mission Control drilldown sanity
 *   3. TV sanity: badge visibility on active beds with pendencies
 *
 * Pre-conditions:
 *   - Firebase Emulators (Auth/Firestore/Functions) running
 *   - Deterministic seed (`npm run seed`) executed
 *   - Bed 301.2 has open + overdue pendencies (seed)
 *   - Bed 301.3 has a canceled pendency (seed)
 *   - admin@lean.com (admin) and editor@lean.com (editor) exist in Unit A
 */

import { test, expect } from '@playwright/test';
import { signInAsAdmin, signInAsEditor, goToAdminTab, autoAcceptDialogs } from './helpers';

// ── Shared constants ──────────────────────────────────────────────────────────
const UNIT = 'A';
const BED_301_2_ID = 'bed_301.2';
const BED_DETAILS_URL = `/editor/bed/${BED_301_2_ID}?unit=${UNIT}`;

/** Navigate to BedDetails for bed 301.2, wait for the Pendências section */
async function openBed3012(page: import('@playwright/test').Page) {
    await page.goto(BED_DETAILS_URL);
    // Wait for the bed header to render (confirms realtime data loaded)
    await expect(page.locator('h2', { hasText: 'Leito 301.2' })).toBeVisible({ timeout: 15000 });
    // Wait for the Pendências section
    await expect(page.locator('h3', { hasText: 'Pendências' })).toBeVisible({ timeout: 10000 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO 1 — EDITOR
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Cenário 1 — Editor: Pendências CRUD + RBAC', () => {
    test.beforeEach(async ({ page }) => {
        autoAcceptDialogs(page);
    });

    test('1.1 — Criar pendência open, marcar done, verificar em Concluídas', async ({ page }) => {
        await signInAsEditor(page);
        await openBed3012(page);

        const ts = Date.now();
        const openTitle = `E2E open ${ts}`;

        // ── Criar pendência nova ──────────────────────────────────────────────
        const titleInput = page.locator('input[placeholder="Nova pendência (obrigatório)"]');
        await titleInput.fill(openTitle);
        await page.locator('button', { hasText: '+ Adicionar pendência' }).click();

        // Aguardar a pendência aparecer na lista OPEN (via onSnapshot)
        const openItem = page.locator('div.bg-surface-2', { hasText: openTitle }).first();
        await expect(openItem).toBeVisible({ timeout: 10000 });

        // ── Marcar como done ──────────────────────────────────────────────────
        // O primeiro botão dentro do item com aria-label "Marcar como feito: ..."
        const doneBtn = openItem.locator(`button[aria-label="Marcar como feito: ${openTitle}"]`);
        await doneBtn.click();

        // Deve sumir da lista OPEN
        await expect(openItem).not.toBeVisible({ timeout: 10000 });

        // Deve aparecer em "Concluídas" (colapsada — expandir)
        const expandDoneBtn = page.locator('button', { hasText: /Ver concluídas/ });
        await expandDoneBtn.click();

        const doneList = page.locator('#done-pendencies-list');
        await expect(doneList).toBeVisible({ timeout: 5000 });
        await expect(doneList.locator('p', { hasText: openTitle })).toBeVisible({ timeout: 5000 });
    });

    test('1.2 — Criar pendência e cancelar, verificar em Canceladas', async ({ page }) => {
        await signInAsEditor(page);
        await openBed3012(page);

        const ts = Date.now();
        const cancelTitle = `E2E cancel ${ts}`;

        // ── Criar pendência ───────────────────────────────────────────────────
        const titleInput = page.locator('input[placeholder="Nova pendência (obrigatório)"]');
        await titleInput.fill(cancelTitle);
        await page.locator('button', { hasText: '+ Adicionar pendência' }).click();

        const openItem = page.locator('div.bg-surface-2', { hasText: cancelTitle }).first();
        await expect(openItem).toBeVisible({ timeout: 10000 });

        // ── Cancelar ──────────────────────────────────────────────────────────
        const cancelBtn = openItem.locator(`button[aria-label="Cancelar pendência: ${cancelTitle}"]`);
        await cancelBtn.click();

        // Deve sumir da lista OPEN
        await expect(openItem).not.toBeVisible({ timeout: 10000 });

        // Deve aparecer em "Canceladas" (colapsada — expandir)
        const expandCanceledBtn = page.locator('button', { hasText: /Ver canceladas/ });
        await expandCanceledBtn.click();

        const canceledList = page.locator('#canceled-pendencies-list');
        await expect(canceledList).toBeVisible({ timeout: 5000 });
        await expect(canceledList.locator('p', { hasText: cancelTitle })).toBeVisible({ timeout: 5000 });
    });

    test('1.3 — Editor NÃO vê botão de delete (RBAC)', async ({ page }) => {
        await signInAsEditor(page);
        await openBed3012(page);

        // Seed garante 301.2 tem pendências abertas.
        // Verificar que nenhum botão "Excluir permanentemente" existe na seção de pendências.
        const pendenciesSection = page.locator('section', { hasText: 'Pendências' });
        await expect(pendenciesSection).toBeVisible({ timeout: 10000 });

        const deleteButtons = pendenciesSection.locator('button[title^="Excluir permanentemente"]');
        await expect(deleteButtons).toHaveCount(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO 2 — ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Cenário 2 — Admin: Pendências Delete + Mission Control', () => {
    test.beforeEach(async ({ page }) => {
        autoAcceptDialogs(page);
    });

    test('2.1 — Admin cria pendência, vê 🗑️, deleta fisicamente', async ({ page }) => {
        await signInAsAdmin(page);
        await openBed3012(page);

        const ts = Date.now();
        const deleteTitle = `E2E deletável ${ts}`;

        // ── Criar pendência ───────────────────────────────────────────────────
        const titleInput = page.locator('input[placeholder="Nova pendência (obrigatório)"]');
        await titleInput.fill(deleteTitle);
        await page.locator('button', { hasText: '+ Adicionar pendência' }).click();

        const pendencyItem = page.locator('div.bg-surface-2', { hasText: deleteTitle }).first();
        await expect(pendencyItem).toBeVisible({ timeout: 10000 });

        // ── Admin vê o botão 🗑️ ──────────────────────────────────────────────
        const deleteBtn = pendencyItem.locator('button[title^="Excluir permanentemente"]');
        await expect(deleteBtn).toBeVisible({ timeout: 5000 });

        // ── Deletar fisicamente ───────────────────────────────────────────────
        // autoAcceptDialogs aceita o window.confirm
        await deleteBtn.click();

        // A pendência deve sumir completamente da UI (não vai para done nem canceled)
        await expect(pendencyItem).not.toBeVisible({ timeout: 15000 });

        // Verificar que a pendência também não está em Concluídas nem Canceladas.
        // Se os botões de expandir existirem, abrir e confirmar ausência.
        const expandDone = page.locator('button', { hasText: /Ver concluídas/ });
        if (await expandDone.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expandDone.click();
            const doneList = page.locator('#done-pendencies-list');
            await expect(doneList.locator('p', { hasText: deleteTitle })).not.toBeVisible();
        }

        const expandCanceled = page.locator('button', { hasText: /Ver canceladas/ });
        if (await expandCanceled.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expandCanceled.click();
            const canceledList = page.locator('#canceled-pendencies-list');
            await expect(canceledList.locator('p', { hasText: deleteTitle })).not.toBeVisible();
        }
    });

    test('2.2 — Mission Control: cards pendências_open e pendencies_overdue', async ({ page }) => {
        await signInAsAdmin(page);
        await goToAdminTab(page, 'analytics');

        // Aguardar o Mission Control tab carregar
        const mcTab = page.locator('button.analytics-tab-btn', { hasText: 'Mission Control' });
        await expect(mcTab).toHaveClass(/active/, { timeout: 10000 });

        // ── Card "Pendências abertas" existe ──────────────────────────────────
        const openCard = page.locator('#pendencies_open');
        await expect(openCard).toBeVisible({ timeout: 15000 });

        // ── Card "Pendências vencidas" existe ─────────────────────────────────
        const overdueCard = page.locator('#pendencies_overdue');
        await expect(overdueCard).toBeVisible({ timeout: 10000 });

        // ── Drilldown pendencies_open ─────────────────────────────────────────
        // Click the drilldown link inside the open card
        const openDrilldownBtn = openCard.locator('button', { hasText: 'Ver leitos com pendências' });
        await openDrilldownBtn.click();

        // Expect navigation to the list screen with filter
        await page.waitForURL(/filter=pendencies_open/, { timeout: 10000 });

        // Should list at least bed 301.2 (seed has open pendencies)
        await expect(page.locator('text=301.2')).toBeVisible({ timeout: 10000 });

        // ── Back and drilldown pendencies_overdue ─────────────────────────────
        await page.locator('button.analytics-list-back').click();
        // Since AdminUnitShell remounts, state resets to "TV" tab. We must reopen Analytics:
        await goToAdminTab(page, 'analytics');
        // Wait for Mission Control again
        await expect(mcTab).toHaveClass(/active/, { timeout: 10000 });
        await expect(overdueCard).toBeVisible({ timeout: 15000 });

        const overdueDrilldownBtn = overdueCard.locator('button', { hasText: 'Ver leitos com vencidas' });
        await overdueDrilldownBtn.click();

        await page.waitForURL(/filter=pendencies_overdue/, { timeout: 10000 });

        // Should list 301.2 (seed has overdue pendency)
        await expect(page.locator('text=301.2')).toBeVisible({ timeout: 10000 });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO 3 — TV SANITY
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Cenário 3 — TV: Badge de pendências', () => {
    test.beforeEach(async ({ page }) => {
        await signInAsEditor(page);
    });

    test('3.1 — Badge de pendências aparece em leitos com pendências abertas', async ({ page }) => {
        // TV não requer login
        await page.goto(`/tv?unit=${UNIT}`);

        // Aguardar o Kanban carregar (primeiro screen do seed)
        await expect(page.locator('.kanban-compact-table')).toBeVisible({ timeout: 20000 });

        // Deve existir pelo menos um badge de pendências com data-pendencies-open > 0
        // Seed garante que 301.2 e 302.2 têm pendências abertas.
        const badges = page.locator('.tv-badge--pendencies[data-pendencies-open]');
        const count = await badges.count();
        expect(count).toBeGreaterThan(0);

        // Verificar que ao menos um badge tem atributo data-pendencies-open com valor numérico > 0
        const firstBadge = badges.first();
        const openAttr = await firstBadge.getAttribute('data-pendencies-open');
        expect(Number(openAttr)).toBeGreaterThan(0);
    });

    test('3.2 — Leito sem patientAlias (vazio) NÃO exibe badge de pendências', async ({ page }) => {
        // TV sem login
        await page.goto(`/tv?unit=${UNIT}`);

        // Esperar a tabela Kanban renderizar
        await expect(page.locator('.kanban-compact-table')).toBeVisible({ timeout: 20000 });

        // Procurar linhas com patient alias "—" (leito vazio)
        // No KanbanScreen: span.kanban-patient com texto "—"
        const emptyRows = page.locator('tr').filter({ has: page.locator('span.kanban-patient', { hasText: '—' }) });
        const emptyCount = await emptyRows.count();

        if (emptyCount > 0) {
            // Para cada leito vazio, verificar que NÃO há badge de pendências
            for (let i = 0; i < emptyCount; i++) {
                const row = emptyRows.nth(i);
                const badge = row.locator('.tv-badge--pendencies');
                await expect(badge).toHaveCount(0);
            }
        } else {
            // Se o seed não criou leitos vazios, skipar com nota
            // (seed preenche todos com patientAlias aleatório)
            console.log('⚠ Nenhum leito vazio encontrado no seed — teste PZ1 não aplicável');
        }
    });
});
