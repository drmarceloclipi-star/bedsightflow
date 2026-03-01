# TestingAgent: Quality & Reliability Specialist

The TestingAgent ensures that all features are robust, bug-free, and meet the project's quality standards.

## Specializations

- **E2E Testing**: Writing and maintaining Playwright tests for critical user flows.
- **Regression Testing**: Ensuring new changes don't break existing functionality.
- **Bug Capture**: Identifying and documenting edge cases and potential failures.
- **Validation**: Providing proof of work through verified test results.

## Technical Stack

- Playwright
- TypeScript
- CI/CD integration knowledge

---

## Estado Atual — Cobertura de Testes (2026-02-28)

### Checklist P1–P5 Verificado (Pendências v1.1)

| # | Critério | Como verificar |
|---|---|---|
| P1 | Realtime (onSnapshot) | Abrir 2 abas do editor do mesmo leito → adicionar pendência em uma → ver atualização na outra |
| P2 | Persiste entre turnos | Adicionar pendência → recarregar página → pendência deve aparecer |
| P3 | Overdue correto | Seed `301.2` → campo `dueAt = ontem` → deve exibir `⚠ Vencida` |
| P4 | Drill-down Mission Control | `/analytics` → clicar card "Pendências abertas" → deve redirecionar com `?filter=pendencies_open` |
| P5 | tsc 0 erros | `npx tsc --noEmit` → 0 erros (ward-board + functions) ✅ |

### Testes E2E Existentes (Playwright)

| Arquivo | Cobertura |
|---|---|
| `tests/kanban-mode.spec.ts` | Kanban Mode toggle, realtime sync |
| `tests/kanban-sync.spec.ts` | Sincronização Kanban entre views |
| `tests/tv-settings.spec.ts` | TV Settings persistência |
| `tests/tv-settings-realtime.spec.ts` | TV Settings realtime sync |
| `tests/analytics.spec.ts` | Analytics cards e filtros |
| `tests/beds-admin.spec.ts` | Gestão de leitos (admin) |
| `tests/users-role-change.spec.ts` | Mudança de papel de usuário |
| `tests/viewer-rbac.spec.ts` | RBAC viewer (somente leitura) |
| `tests/mobile-navigation.spec.ts` | Navegação mobile |
| `tests/ops-advanced.spec.ts` | Operações avançadas |
| `tests/admin-home.spec.ts` | Home admin |

### ⚠️ Dívida de Testes v1.2 — Pendências (PRIORIDADE ALTA)

Nenhum teste E2E cobre as operações de pendências. Criar `tests/pendencies.spec.ts` com:

```typescript
// Cenários obrigatórios:
// 1. Adicionar pendência (editor)
// 2. Marcar pendência como done (editor)
// 3. Cancelar pendência (editor) → verificar que aparece em "Ver canceladas"
// 4. Tentar excluir sem admin → botão não deve aparecer
// 5. Excluir como admin → confirmar remoção física
// 6. Overdue: seed 301.2 → verificar ⚠ Vencida visível no DOM
// 7. Mission Control → drill-down pendencies_open e pendencies_overdue
```

### Dívida de Testes v1.2 — Kamishibai Renderer

Adicionar testes que verificam `data-state` correto no DOM:

- Leito vazio → `data-state="inactive"`
- `ok` sem `reviewedShiftKey` → `data-state="unreviewed"` (migração conservadora)
- `ok` com `reviewedShiftKey !== current` → `data-state="unreviewed"` (TTL expirado)
- `blocked` → `data-state="blocked"`

### Dívida de Testes v1.8 — LSW & Escalonamentos

Criar testes para cobrir os fluxos integrados:

- **Mission Control Escalonamentos**: Validar se pendências muito antigas (e.g. 15 horas) disparam os alarmes/tally markers na dashboard do Admin, listando em Escalonamentos Críticos.
- **OpScreen Huddles:** Validar adição de Top 3 Ações no OpsScreen do LSW, se as mesmas salvam e fecham adequadamente após cliques iterativos de LSW.
- **TV Dashboard Integrado:** Inserir dados de teste e verificar se os banners LSW + badge com fire alert (Escalonamento Crítico) aparece na TV de Plantão.

---

## Seed Determinístico — Lean Suite (v1.0, 2026-03-01)

> **REGRA:** Todo teste E2E da Lean Suite deve usar `npm run seed:lean` (nunca o `seed` randômico).

### Comandos

```bash
npm run emulators    # em outro terminal (pré-requisito)
npm run seed:lean    # seed determinístico p/ testes
```

### O Que Ela Garante

| ID Fixo | Cenário | `data-state` / Asserção |
| :--- | :--- | :--- |
| `bed_EMPTY` | `patientAlias=''` | `inactive` |
| `bed_UNREVIEWED` | `reviewedShiftKey` do turno anterior | `unreviewed` |
| `bed_BLOCKED` | 2 domínios blocked | `blocked` |
| `bed_NOT_APPLICABLE` | `psychology`/`social` fora de `applicableDomains` | `not-applicable` |
| `bed_PENDENCIES` | open / overdue / done / canceled | por `data-pend-status` |
| `ESCALATION-01` | `dueAt=msAgo(14)` > 12h threshold | overdue critical |
| `ESCALATION-02` | `blockedAt=msAgo(29)` > 24h threshold | blocker critical |
| `ESCALATION-03` | ambos | conta 1 no total |

### Clock para Playwright

Para sincronizar o relógio do browser com o seed:

```typescript
// No início do test ou beforeEach:
await page.clock.install({ time: new Date('2026-03-01T01:00:00.000Z') });
// → currentShiftKey = '2026-02-28-PM'
```

### IDs de Pendências Fixos

| ID | Status | `dueAt` |
| :--- | :--- | :--- |
| `PEND_A1` | open | — |
| `PEND_A2_OVERDUE` | open | vencida há 13h |
| `PEND_A3_DONE` | done | — |
| `PEND_A4_CANCELED` | canceled | — |
| `PEND_ESC01_OVERDUE` | open | vencida há 14h |

### Ref Docs

- `docs/lean/SEED_LEAN_CONTRACT_2026-02-28.md` — contrato completo de IDs e valores
- `docs/lean/SEED_LEAN_ACCEPTANCE_2026-02-28.md` — gate de aceite + output esperado
