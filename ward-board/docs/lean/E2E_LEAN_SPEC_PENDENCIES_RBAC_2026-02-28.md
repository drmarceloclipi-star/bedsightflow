# E2E Lean Spec — Pendências v1.1 + RBAC Delete

**Data:** 2026-02-28
**Arquivo:** `tests/lean-pendencies-v1.spec.ts`

## Cobertura

| Cenário | Teste | Descrição |
|---|---|---|
| 1 — Editor | 1.1 | Criar pendência open → marcar done → verificar em Concluídas |
| 1 — Editor | 1.2 | Criar pendência → cancelar → verificar em Canceladas |
| 1 — Editor | 1.3 | Editor NÃO vê botão 🗑️ (RBAC) |
| 2 — Admin | 2.1 | Admin cria pendência → deleta fisicamente → some da UI e do doc |
| 2 — Admin | 2.2 | Mission Control: cards `pendencies_open` e `pendencies_overdue` + drilldown lista bed 301.2 |
| 3 — TV | 3.1 | Badge `.tv-badge--pendencies` aparece com `data-pendencies-open > 0` |
| 3 — TV | 3.2 | Leito vazio (patientAlias = "—") não exibe badge |

## Como rodar

```bash
# 1. Emulators (terminal 1)
npm run emulators

# 2. Seed (terminal 2, após emulators estarem prontos)
npm run seed

# 3. Rodar apenas este spec
npx playwright test tests/lean-pendencies-v1.spec.ts

# Ou com UI mode
npx playwright test tests/lean-pendencies-v1.spec.ts --ui
```

## Pré-condições

- Firebase Emulators rodando: Auth (`:9099`), Firestore (`:8080`), Functions (`:5001`)
- Seed determinístico executado (`npm run seed`)
- Contas seed: `admin@lean.com` (admin), `editor@lean.com` (editor)
- Bed `301.2`: 2 pendências open (1 overdue), bed `301.3`: 1 canceled

## Seletores usados (nenhum novo adicionado)

| Seletor | Origem |
|---|---|
| `input[placeholder="Nova pendência (obrigatório)"]` | BedDetails.tsx L482 |
| `button:has-text("+ Adicionar pendência")` | BedDetails.tsx L514 |
| `button[aria-label^="Marcar como feito:"]` | BedDetails.tsx L436 |
| `button[aria-label^="Cancelar pendência:"]` | BedDetails.tsx L459 |
| `button[title^="Excluir permanentemente"]` | BedDetails.tsx L467 |
| `button:has-text("Ver concluídas")` / `#done-pendencies-list` | BedDetails.tsx L524/530 |
| `button:has-text("Ver canceladas")` / `#canceled-pendencies-list` | BedDetails.tsx L564/571 |
| `#pendencies_open`, `#pendencies_overdue` | MissionControlTab.tsx L293/309 |
| `.tv-badge--pendencies[data-pendencies-open]` | KanbanScreen.tsx L37–39 |

## Guardrails anti-flake

- Zero `waitForTimeout` (sleep fixo) — todas as esperas são DOM-based
- Usa `data-*` attributes e contagens ao invés de textos variáveis
- TV: testa estado estático da primeira tela (Kanban) — não depende de rotação
- Timestamps únicos via `Date.now()` evitam colisão entre runs
