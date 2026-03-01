# Audit Seeds: Recommendation para Testes Determinísticos

## O Problema Principal

A atual implementação de `scripts/seed-data.ts` mistura a carga de dados canônicos e estáticos com geração dinâmica randômica. A criação dos leitos depende diretamente da função `hoursAgo()` que avança os estados em tempo-real, impedindo validação snapshotada nos testes E2E do Playwright ou em runtimes CI. Além disso, IDs de pendências são aleatórios.

**Não recomendamos reescrever/deletar o seed atual de imediato.** O time pode estar usando ele para UX reviews, demo e exploração manual no Emulador, atividades onde a randomicidade ajuda a simular uma ala agitada.

## Proposta: Caminho Seguro "Dual Seed"

Atualmente, `package.json` possui um script principal `"seed": "tsx scripts/seed-data.ts"`.

Recomendamos a **criação de um novo script focado apenas na estabilidade de testes Lean Suite**, que roda em paralelo e isoladamente: `scripts/seed-lean-tests.ts`.

### Passo A Passo

1. Adicionar o comando no `package.json`:

   ```json
   "seed:lean": "tsx scripts/seed-lean-tests.ts"
   ```

2. O arquivo `scripts/seed-lean-tests.ts` deve:
   * Assumir uma **data/hora simulada (mocked clock)**. Exemplo: `2026-02-28T22:00:00-03:00`.
   * Possuir um escopo menor e determinístico. O ideal é limpar os `beds`, `huddles` e `pendencies` existentes e inserir _apenas a suíte necessária_ (Fix Cases 1 a 6).
   * Não gerar _nenhum_ dado randômico (`Math.random()`).
   * Fixar os IDs dinâmicos de documentação (ex: `PENDENCY-A1`, `PENDENCY-B2`).

3. **Casos Cobertos Indispensáveis (A Garantir)**:
   * Leito vazio puro (Inactive State).
   * Leito não-revisado (Unreviewed Shift State c/ timestamp atrasado fixo).
   * Leito com bloqueios (Kamishibai `blockedAt` congelado com `ageHours` fixas).
   * Caso de Escalonamento 01: Overdue crítico (Due date < mockedNow).
   * Caso de Escalonamento 02: Blocker crítico.
   * Resumo de Huddle (Start e End Summaries fixados para testes Delta).

### O que Isso Soluciona?

A execução da suite E2E poderá agora invocar (no CI ou local paramétrico):
`npm run seed:lean` seguido de `npm run test:e2e`. Todos os snapshots estarão congelados no tempo "2026-02-28", parando o flakiness dos selectores.

### O que NÃO Garante?

* Não cobre testes manuais com data atual real (ao rodar `npm run dev`, o Playwright injeta tempo fake no navegador via `--timezone` e `page.clock.install({ time: ... })`, então a aplicação e o seed estarão perfeitamente sincronizados). UI dev sem playwright ficaria "no passado".
* Carga total (limpa apenas leitos da Unidade A, não reseta profiles e collections cross-project).

## Riscos e Mitigação

* **Risco**: Ter que dar manutenção em dois scripts (Full/random vs Lean/static).
* **Mitigação**: Os perfis de teste fixos listados na recomendação e em `V1_BED_PROFILES` devem idealmente ser extraídos para um arquivo JSON/JS isolado importável pelos dois, sendo a única diferença a forma de injeção dos timestamps (`Date.now()` vs `FixedDate()`).
