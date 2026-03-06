# Functions Lean Gate — Acceptance Document

**Data:** 2026-02-28  
**Gate:** Integração de Cloud Functions — P0 Unit Tests  
**Resultado:** ✅ APROVADO

---

## Comando Executado

```bash
cd ward-board/functions
npm test -- --testPathPatterns="shared/__tests__|deletePendency"
```

## Resultado dos Testes

```text
Test Suites: 3 passed, 3 total
Tests:       51 passed, 51 total
Snapshots:   0 total
Time:        ~2.0 s
```

**0 failures. 0 skipped.**

## TypeScript — `tsc --noEmit`

```bash
cd ward-board/functions
npx tsc --noEmit
# exit 0, sem output = zero erros TS
```

**0 erros TypeScript.**

---

## Suites Implementadas

### 1. `src/shared/__tests__/escalation.test.ts` — 17 testes

Testa `computeEscalations()` como função pura (zero Firestore, zero emulador).

| Grupo | Casos |
| --- | --- |
| Sem leitos | retorna zeros |
| Atrasado crítico | conta corretamente |
| Bloqueado crítico | conta com `mainBlockerBlockedAt` |
| Filtro de domínio | apenas domínios aplicáveis |
| Fallback | sem `mainBlockerBlockedAt` → usa blockedAt |
| Agregação | múltiplos leitos combinados |

### 2. `src/shared/__tests__/missionControlSnapshot.test.ts` — 20 testes

Testa `buildSnapshot()` como função pura extraída de `getAdminMissionControlSnapshot`.

| Grupo | Casos |
| --- | --- |
| `mainBlockerBlockedAt` | usa quando presente, emite `console.warn` quando ausente e cai para `blockedAt` |
| Escalações via SSoT | `buildSnapshot` delega para `computeEscalations` compartilhado |
| `kamishibaiEnabled=false` | zera `unreviewedBedsCount`, preserva pendências |
| Pendências | contagem correta de open/overdue |
| Madrugada BRT | `MOCK_NOW = 2026-03-01T01:00:00Z` → shift key `2026-02-28-PM` |

> **P0 crítico:** prova que `mainBlockerBlockedAt` é a fonte primária do tempo de bloqueio; fallback gera warning observável no log.

### 3. `src/callables/pendencies/__tests__/deletePendency.test.ts` — 14 testes

Testa `deletePendency` com mocks completos (sem emulador Firestore).

| Grupo | Casos |
| --- | --- |
| Auth guard | `unauthenticated` sem auth |
| invalid-argument | faltando `unitId`, `bedId`, `pendencyId` |
| RBAC | `permission-denied` usuario comum; admin de unidade permitido; global admin permitido; `token.admin=true` permitido; editor negado |
| not-found | leito não existe; pendência não encontrada |
| Happy path | retorna `{ success, deletedId }`; remove apenas o item correto do array; permite deletar pendência `done/canceled` |

---

## Prova dos Requisitos P0

| Requisito | Verificação |
| --- | --- |
| `mainBlockerBlockedAt` quando existe | ✅ Suite 2, grupo `mainBlockerBlockedAt` |
| `console.warn` quando `mainBlockerBlockedAt` ausente | ✅ Suite 2, "emits warn when mainBlockerBlockedAt missing" |
| Escalações via `computeEscalations` compartilhado | ✅ Suite 2, "uses computeEscalations as SSoT" |
| `kamishibaiEnabled=false` zera métricas kamishibai | ✅ Suite 2, grupo `kamishibaiEnabled=false` |
| RBAC `deletePendency` | ✅ Suite 3, 5 casos de RBAC |
| `not-found` para leito/pendência ausente | ✅ Suite 3, 2 casos not-found |

---

## Arquivos Modificados/Criados

| Arquivo | Tipo | Descrição |
| --- | --- | --- |
| `functions/src/shared/__tests__/escalation.test.ts` | **NEW** | P0 unit tests `computeEscalations` |
| `functions/src/shared/__tests__/missionControlSnapshot.test.ts` | **NEW** | P0/P1 unit tests `buildSnapshot` |
| `functions/src/callables/pendencies/__tests__/deletePendency.test.ts` | **NEW** | P0 unit tests `deletePendency` (mock-only) |
| `functions/src/callables/analytics/getAdminMissionControlSnapshot.ts` | **MODIFIED** | Extração de `buildSnapshot()` como função pura exportada; handler `onCall` delega para ela (zero mudança de comportamento) |
