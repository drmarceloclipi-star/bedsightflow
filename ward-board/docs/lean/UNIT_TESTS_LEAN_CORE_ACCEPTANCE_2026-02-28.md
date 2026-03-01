# Unit Tests — Lean Core Acceptance Gate

**Data:** 2026-02-28 | **Runner:** Vitest v4 | **Comando:** `npm run test:unit`

---

## Resultado de Aceite

| Check | Resultado |
| :--- | :--- |
| `npm run test:unit` | ✅ **110 testes, 0 falhas** |
| `npx tsc --noEmit` | ✅ **0 erros TypeScript** |

---

## Arquivos Criados

| Arquivo | Prioridade | Testes |
| :--- | :--- | :--- |
| `src/domain/fixtures.ts` | — | Fixtures compartilhadas (sem testes próprios) |
| `src/domain/shiftKey.test.ts` | **P0** | 14 |
| `src/domain/kamishibaiVisualState.test.ts` | **P0** | 25 |
| `src/domain/pendencies.test.ts` | **P1** | 23 |
| `src/domain/escalation.test.ts` | **P0** | 7 (pré-existente, estendido) |
| `src/domain/missionControl.test.ts` | **P1** | 17 (pré-existente) |
| `src/domain/huddle.test.ts` | — | 6 (pré-existente) |
| `src/features/.../EduCenterHome.test.ts` | — | 18 (pré-existente) |

**Total:** 110 testes, 7 arquivos de teste.

---

## Cobertura por Domínio

### `shiftKey.test.ts` (14 testes, P0)

| Caso | Resultado |
| :--- | :--- |
| 06:59 BRT → PM do dia anterior (madrugada < amStart) | ✅ |
| 07:00 BRT → AM (borda inclusiva exata) | ✅ |
| 18:59 BRT → AM (1 min antes de PM) | ✅ |
| 19:00 BRT → PM (borda inclusiva exata) | ✅ |
| 22:00 BRT → PM (= MOCK_NOW_BRT = CURRENT_SHIFT_KEY do seed) | ✅ |
| 03:00 BRT madrugada → PM do dia anterior | ✅ |
| Schedule custom AM=06:00, PM=18:00 | ✅ (4 casos) |
| Timezone `America/Sao_Paulo` ≠ UTC para mesmo instante UTC | ✅ |
| Resultado estável independente do locale do runner | ✅ |

### `kamishibaiVisualState.test.ts` (25 testes, P0)

| Caso | Resultado |
| :--- | :--- |
| Leito vazio (`patientAlias=""`) → INACTIVE | ✅ |
| `patientAlias=" "` whitespace → INACTIVE | ✅ |
| `kamishibaiEnabled=false` → INACTIVE em leito ativo | ✅ |
| Domínio fora de `applicableDomains` → NOT_APPLICABLE | ✅ |
| `applicableDomains` ausente → todos aplicáveis (compat v0) | ✅ |
| `status=blocked` → BLOCKED (imune a TTL) | ✅ |
| `reviewedShiftKey` = turno anterior → UNREVIEWED_THIS_SHIFT | ✅ |
| `reviewedShiftKey` ausente → UNREVIEWED_THIS_SHIFT (legado v0) | ✅ |
| Entry ausente para domínio aplicável → UNREVIEWED_THIS_SHIFT | ✅ |
| `status='na'` em leito ativo → UNREVIEWED_THIS_SHIFT (legado v0) | ✅ |
| `ok` + `reviewedShiftKey == currentShiftKey` → OK | ✅ |
| NOT_APPLICABLE vence BLOCKED (regra 3 > regra 4) | ✅ |

### `pendencies.test.ts` (23 testes, P1)

| Caso | Resultado |
| :--- | :--- |
| Leito vazio → open=0, overdue=0 | ✅ |
| Sem pendências → open=0, overdue=0 | ✅ |
| Conta apenas `status=open` (ignora done/canceled) | ✅ |
| Sem `dueAt` → open++, overdue=0 (D4) | ✅ |
| `dueAt < now` → overdue (D3) | ✅ |
| `dueAt == now` → NÃO overdue (< estrito, não <=) | ✅ |
| `dueAt` no futuro → NÃO overdue | ✅ |
| `computeUnitPendencyCounts` soma corretamente | ✅ |
| `pendencies=undefined` tratado como array vazio | ✅ |
| `hasOverdue`, `formatPendencyBadge` | ✅ (5 casos) |

### `escalation.test.ts` (7 testes, P0) — pré-existente

| Caso | Resultado |
| :--- | :--- |
| Leitos vazios ignorados | ✅ |
| Overdue critical ≥ threshold (13h ≥ 12h) → entra | ✅ |
| Abaixo do threshold → não entra | ✅ |
| `mainBlockerBlockedAt` ausente → fallback `updatedAt` | ✅ |
| Leito em overdue + blocker → total sem duplicação | ✅ |
| Done/canceled não contam | ✅ |
| Filtro de domínio em thresholds | ✅ |

### `missionControl.test.ts` (17 testes, P1) — pré-existente

| Caso | Resultado |
| :--- | :--- |
| `parseMissionControlThresholds(null/undefined)` → defaults | ✅ |
| Override parcial mantém defaults restantes | ✅ |
| NaN/string → fallback para default | ✅ |
| `blockedStatus`, `freshnessStatus`, `unreviewedShiftStatus` | ✅ (12 casos) |

---

## Fixtures Compartilhadas (`fixtures.ts`)

| Constante/Objeto | Valor |
| :--- | :--- |
| `MOCK_NOW_ISO` | `"2026-03-01T01:00:00.000Z"` (22:00 BRT) |
| `MOCK_NOW` | `new Date(MOCK_NOW_ISO)` |
| `CURRENT_SHIFT_KEY` | `"2026-02-28-PM"` |
| `PREV_SHIFT_KEY` | `"2026-02-28-AM"` |
| `bedEmpty` | `patientAlias=""` |
| `bedOkReviewedCurrentShift` | Todos os 6 domínios `ok + reviewedShiftKey=CURRENT` |
| `bedOkReviewedPrevShift` | Todos os 6 domínios `ok + reviewedShiftKey=PREV` |
| `bedBlockedWithBlockedAt` | `medical` bloqueado há 10h |
| `bedNotApplicable` | `applicableDomains` exclui `psychology`, `social` |
| `bedPendenciesOverdue` | 1 open overdue (14h atrás), 1 done |
| `bedMainBlockerCritical` | `mainBlockerBlockedAt` há 29h (≥ 24h threshold) |

---

## Observações

### Mocks de relógio

- **Nenhum relógio real é usado.** Todos os testes injetam `now` explicitamente.
- `shiftKey.test.ts`: usa `new Date(isoUTC)` com instantes UTC fixos.
- `kamishibaiVisualState.test.ts`: passa `resolvedCurrentShiftKey` explicitamente — jamais chama `currentShiftKey()` interno.
- `pendencies.test.ts` / `escalation.test.ts`: parâmetro `now: Date` injetado.

### Timezone

- `computeShiftKey` recebe `tz` explicitamente → nenhum teste depende do locale/timezone do runner CI.
- O resultado `CURRENT_SHIFT_KEY = '2026-02-28-PM'` foi validado para `MOCK_NOW_ISO` em `America/Sao_Paulo`.

### Compatibilidade v0

- `applicableDomains` ausente → todos aplicáveis ✅
- `reviewedShiftKey` ausente → UNREVIEWED ✅
- `status='na'` → UNREVIEWED ✅
