import { test, expect } from '@playwright/test';
import { signInAsEditor, signInAsAdmin } from './helpers';

const UNIT = 'A';

// Run these tests sequentially to avoid global DB state mutations interfering with each other (e.g., Scenario 2 disabling Kamishibai while Scenario 1 is waiting for it)
test.describe.configure({ mode: 'serial' });

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO 1 — TV KAMISHIBAI (Estados Visuais)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Cenário 1 — TV Kamishibai: Estados Visuais', () => {
    test.beforeEach(async ({ page }) => {
        // Logar como editor para acessar a TV (rota protegida)
        await signInAsEditor(page);
    });

    test('1.1 — Verifica estados (Empty/Inactive, TTL/Unreviewed, Blocked, N/A)', async ({ page }) => {
        test.setTimeout(180000);
        page.on('console', msg => console.log('TV Console:', msg.text()));
        page.on('pageerror', err => console.log('TV Error:', err.message));
        await page.goto(`/tv?unit=${UNIT}`);

        // O KamishibaiScreen deve aparecer eventualmente (pode haver rotação)
        // Setamos um timeout generoso para aguardar a rotação caso inicie no Kanban
        const kamishibaiContainer = page.locator('.kamishibai-container');

        // Debug: take screenshot after 5s to see what is actually rendering
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'tv-debug-1.1.png', fullPage: true });

        await expect(kamishibaiContainer).toBeVisible({ timeout: 120000 });

        // Bed 302.3: Leito vazio garantido no seed (sem patientAlias)
        // Tabela procura na linha onde contém o número do leito
        const bed3023Row = page.locator('tr', { has: page.locator('.kamishibai-bed-num', { hasText: '302.3' }) });
        await expect(bed3023Row).toBeVisible();
        // Todos os cells (exceto o nome do leito) devem ter data-state="inactive"
        const bed3023Cells = bed3023Row.locator('td[data-domain]');
        const count3023 = await bed3023Cells.count();
        expect(count3023).toBe(6); // 6 domínios
        for (let i = 0; i < count3023; i++) {
            await expect(bed3023Cells.nth(i)).toHaveAttribute('data-state', 'inactive');
        }

        // Bed 301.4: Verde LEGADO (status='ok', sem reviewedShiftKey para o turno atual) -> TTL test
        const bed3014Row = page.locator('tr', { has: page.locator('.kamishibai-bed-num', { hasText: '301.4' }) });
        await expect(bed3014Row).toBeVisible();
        // Deve constar como 'unreviewed' e não mostrar cor verde (apenas o empty boundary)
        const med3014 = bed3014Row.locator('td[data-domain="medical"]');
        await expect(med3014).toHaveAttribute('data-state', 'unreviewed');
        await expect(med3014.locator('.kamishibai-empty')).toBeVisible();

        // Bed 301.2: Tem medical='blocked' e physio/social = Não Aplicável
        const bed3012Row = page.locator('tr', { has: page.locator('.kamishibai-bed-num', { hasText: '301.2' }) });
        await expect(bed3012Row).toBeVisible();
        // Medical = blocked
        const med3012 = bed3012Row.locator('td[data-domain="medical"]');
        await expect(med3012).toHaveAttribute('data-state', 'blocked');
        await expect(med3012.locator('.kamishibai-dot--blocked')).toBeVisible();
        // Physio = not_applicable
        const physio3012 = bed3012Row.locator('td[data-domain="physio"]');
        await expect(physio3012).toHaveAttribute('data-state', 'not_applicable');
        await expect(physio3012.locator('.kamishibai-placeholder--na')).toBeVisible();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO 2 — TOGGLE KAMISHIBAI (Admin Ops)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Cenário 2 — Toggle Kamishibai (kamishibaiEnabled)', () => {
    test.beforeEach(async ({ page }) => {
        await signInAsAdmin(page);
    });

    // Cleanup: garantir que o toggle volte para "Ativado" no final
    test.afterAll(async ({ browser }) => {
        const page = await browser.newPage();
        await signInAsAdmin(page);
        await page.goto(`/admin/unit/${UNIT}`);
        await page.click('button[role="tab"]:has-text("Ops")');
        await expect(page.locator('h2', { hasText: 'Operações' })).toBeVisible();
        // Tenta achar o toggle "Quadro Kamishibai" (único checkbox na tela)
        const checkbox = page.locator('input[type="checkbox"]');
        const container = page.locator('label:has(input[type="checkbox"])');
        await expect(checkbox).toBeAttached({ timeout: 10000 });
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
            await container.click();
            await page.waitForTimeout(1000); // espera salvar
        }
        await page.close();
    });

    test('2.1 — Desabilitar Kamishibai na aba Ops e verificar reflexo na TV', async ({ page, context }) => {
        test.setTimeout(90000);

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        // Vai para a tela de OpSettings e desabilita
        await page.goto(`/admin/unit/${UNIT}`);
        await page.click('button[role="tab"]:has-text("Ops")');
        await expect(page.locator('h2', { hasText: 'Operações' })).toBeVisible();

        await page.waitForTimeout(3000); // Give it time to load opsSettings
        await page.screenshot({ path: 'ops-screen-debug.png', fullPage: true });

        const checkbox = page.locator('input[type="checkbox"]');
        const container = page.locator('label:has(input[type="checkbox"])');

        // Garantir que carregou e está checado
        await expect(checkbox).toBeAttached({ timeout: 10000 });
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
            await container.locator('label').click();
            await page.waitForTimeout(1000); // espera salvar
        }

        // Agora desabilita clicando na label, pois o input é sr-only
        await container.click();
        await page.waitForTimeout(2000); // espera salvar no firebase TV (todos inativos)
        await expect(page.locator('text=Kamishibai desativado com sucesso.')).toBeVisible({ timeout: 10000 });

        // Passo 2: Validar TV (todos inativos)
        // Usar nova aba para não perder admin
        const tvPage = await context.newPage();
        await tvPage.goto(`/tv?unit=${UNIT}&screen=kamishibai`);
        const kamishibaiContainer = tvPage.locator('.kamishibai-container');
        await expect(kamishibaiContainer).toBeVisible({ timeout: 30000 });

        // Kamishibai desativado transforma todos os dots em INACTIVE, idêntico a um bed vazio.
        // Vamos verificar o bed 301.2 que tinha blockeds
        const bed3012Row = tvPage.locator('tr', { has: tvPage.locator('.kamishibai-bed-num', { hasText: '301.2' }) });
        await expect(bed3012Row).toBeVisible();

        const med3012 = bed3012Row.locator('td[data-domain="medical"]');
        await expect(med3012).toHaveAttribute('data-state', 'inactive');
        await expect(med3012.locator('.kamishibai-empty')).toBeVisible(); // Sem cor/placeholder

        await tvPage.close();

        // Passo 3: Reabilitar
        await container.click();
        await expect(page.locator('text=Kamishibai ativado com sucesso.')).toBeVisible({ timeout: 10000 });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO 3 — EDITOR KAMISHIBAI
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Cenário 3 — Editor: Registrando Kamishibai e refletindo na TV', () => {
    test.beforeEach(async ({ page }) => {
        await signInAsEditor(page);
    });

    test('3.1 — Editor clica em status OK e vê reflexo verde (reviewedShiftKey = current)', async ({ page, context }) => {
        test.setTimeout(180000);
        // Iniciar com uma aba de TV aberta e deixá-la carregar
        const tvPage = await context.newPage();
        await tvPage.goto(`/tv?unit=${UNIT}&screen=kamishibai`);
        await expect(tvPage.locator('.kamishibai-container')).toBeVisible({ timeout: 30000 });

        // Bed 301.4 antes de nós tocarmos -> Médico está 'unreviewed' no TV
        const tvRow3014 = tvPage.locator('tr', { has: tvPage.locator('.kamishibai-bed-num', { hasText: '301.4' }) });
        await expect(tvRow3014).toBeVisible();
        await expect(tvRow3014.locator('td[data-domain="medical"]')).toHaveAttribute('data-state', 'unreviewed');

        // Ir para Editor no leito 301.4
        await page.goto(`/editor/bed/bed_301.4?unit=${UNIT}`);

        // Aguardar header carregar
        await expect(page.locator('h2', { hasText: 'Leito 301.4' })).toBeVisible({ timeout: 10000 });

        // Procurar botão de status OK do domínio Médico no BedDetails
        const medOkBtn = page.locator('button[aria-label="Definir status ok para MÉDICA"]');
        await expect(medOkBtn).toBeVisible();

        // Clicar para definir status como OK
        await medOkBtn.click();

        // Dá um pequeno tempo prático para a escrita no Firestore sincronizar
        await page.waitForTimeout(2000);

        // Checar na TV se o data-state mudou para "ok" e a bola verde `.kamishibai-dot--ok` apareceu
        await expect(tvRow3014.locator('td[data-domain="medical"]')).toHaveAttribute('data-state', 'ok', { timeout: 10000 });
        await expect(tvRow3014.locator('td[data-domain="medical"] .kamishibai-dot--ok')).toBeVisible();

        await tvPage.close();
    });
});
