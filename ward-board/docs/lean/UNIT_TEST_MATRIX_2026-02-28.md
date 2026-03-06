# Matriz de Testes Unitários e Componentes (2026-02-28)

Este documento centraliza as suítes de teste de unidade e componentes recomendadas para validar as regras e contratos core do sistema Lean.

---

## 1. Domínio: shiftKey (TTL por turno)

* **Path Alvo:** `src/domain/shiftKey.ts`
* **Prioridade:** P0
* **Fonte do Contrato:** Regra de Negócio (Gestão Visual por Turnos / TTL)

**Casos de Teste:**

* `computeShiftKey()` retorna `YYYY-MM-DD-AM` entre AM_START inclusive e PM_START exclusivo.
* `computeShiftKey()` retorna `YYYY-MM-DD-PM` a partir de PM_START inclusive.
* Madrugada (< AM_START) retorna `PM` do dia anterior.
* Borda exata: `07:00` entra no AM; `06:59` ainda é PM anterior; `19:00` entra no PM.
* Schedule custom (ex: AM=06:00, PM=18:00) altera o resultado corretamente.
* Timezone fixa (`America/Sao_Paulo`) não depende do timezone do device (mock Intl / helper).

---

## 2. Domínio: Kamishibai visual state (state machine)

* **Path Alvo:** `src/domain/kamishibaiVisualState.ts` (ou equivalente)
* **Prioridade:** P0
* **Fonte do Contrato:** Regra de Negócio (Contrato Lean Core / State Machine)

**Casos de Teste:**

* Leito vazio (`patientAlias==''`) → `INACTIVE` para qualquer domínio.
* `kamishibaiEnabled=false` → `INACTIVE` mesmo em leito ativo.
* Domínio não aplicável → `NOT_APPLICABLE` (Variante A: `!applicableDomains.includes(domain)`).
* `status='blocked'` → `BLOCKED` independente de `reviewedShiftKey`.
* `status='ok'` e `reviewedShiftKey != currentShiftKey` → `UNREVIEWED_THIS_SHIFT`.
* `status='ok'` e `reviewedShiftKey == currentShiftKey` → `OK`.
* Legado v0: `reviewedShiftKey` ausente → `UNREVIEWED_THIS_SHIFT` (conservador).
* Legado v0: `status='na'` em leito ativo → `UNREVIEWED_THIS_SHIFT` (conservador).
* Legado v0: `status='na'` em leito vazio → `INACTIVE`.

---

## 3. Domínio: Pendências (contagem + overdue + leito vazio)

* **Path Alvo:** `src/domain/pendencies.ts`
* **Prioridade:** P1
* **Fonte do Contrato:** Mission Control / Dashboard TV

**Casos de Teste:**

* `computePendencyCounts()` ignora leito vazio (open=0, overdue=0).
* Conta apenas `status='open'` (ignora done/canceled).
* `overdue` só conta se `dueAt` existe e `dueAt < now`.
* `dueAt == now` não é overdue.
* `TimestampLike` conversion (`toMs`) funciona com string ISO e Timestamp-like (mock).
* `computeUnitPendencyCounts()` soma corretamente e respeita o guard de leito vazio.

---

## 4. Domínio: Escalonamento canônico (Single Source of Truth)

* **Paths Alvo:** `src/domain/escalation.ts` e `functions/src/shared/escalation.ts`
* **Prioridade:** P0
* **Fonte do Contrato:** Consistência de Dados (TV, Admin, Listas concordam)

**Casos de Teste:**

* `computeEscalations()` considera apenas leitos ativos.
* Overdue critical: pendency open + dueAt vencido há >= threshold → entra em `overdueCriticalBedIds`.
* Overdue critical: pendency sem dueAt → não entra.
* Main blocker critical: mainBlocker não vazio + ageHours >= threshold → entra em `blockerCriticalBedIds`.
* Usa `mainBlockerBlockedAt` preferencialmente, fallback para `updatedAt` se ausente.
* Bed com ambos aparece nas duas listas, mas `total` é união (sem duplicatas).
* Missing thresholds doc → defaults são aplicados corretamente.
* Filtro por domain configurável funciona adequadamente.
* Nunca conta "unreviewed" como escalation.

---

## 5. Mission Control: Thresholds e Determinação de Status

* **Paths Alvo:** `src/domain/missionControl.ts` (helpers)
* **Prioridade:** P1
* **Fonte do Contrato:** Requisitos de Operação (Parametrização de Alertas)

**Casos de Teste:**

* Merge defaults + overrides do Firestore: override parcial não apaga defaults restantes.
* `blockedStatus(pct)` respeita thresholds configurados.
* `freshnessStatus(count, tier)` respeita thresholds configurados.
* `unreviewedShiftStatus(count)` respeita thresholds configurados.
* Fallback seguro ativado para entradas ou valores absurdos (negativos, NaN).

---

## 6. Snapshot Backend: Mapeamento e Cálculos ("puro")

* **Paths Alvo:** `functions/src/callables/analytics/getAdminMissionControlSnapshot.ts` (ou `functions/src/shared/snapshot.ts`)
* **Prioridade:** P0
* **Fonte do Contrato:** Fonte de Verdade Mission Control Admin

**Casos de Teste:**

* `activeBedsCount` conta só `patientAlias.trim()!==''`.
* `blockedBedsCount` conta só `hasPatient && mainBlocker.trim()!==''`.
* Aging usa `mainBlockerBlockedAt` quando existe; usa proxy para gerar `warnings[]` + `blockedAgingFallbackBedIds` se faltar.
* Freshness usa `max(reviewedAt)` por leito; bucket de 48h (conservador) se nenhum `reviewedAt` existir.
* `kamishibaiEnabled=false` zera métricas de kamishibai/unreviewed no payload.
* `thresholdsUsed` no payload corresponde ao merge defaults + overrides.
* `escalations` do payload bate exatamente com `computeEscalations()`.
* Contadores de Pendências batem com `computePendencyCounts()` (ou lógica server-side equivalente).

---

## 7. Huddle: reviewOfShiftKey e Start/End Summary

* **Paths Alvo:** `src/domain/huddle.ts` (+ helpers), `src/repositories/MissionControlRepository.ts`
* **Prioridade:** P1
* **Fonte do Contrato:** Requisitos de Histórico do Turno e KPI Relativos

**Casos de Teste:**

* `reviewOfShiftKey`: AM revisa PM anterior (dia anterior PM); PM revisa AM do mesmo dia; respeita borda de madrugada.
* `MissionControlRepository.getHuddleSnapshotSummary()` mapeia corretamente campos do payload MC para summary.
* Fail-safe no Callable HuddleSnapshotSummary retorna `undefined` ou fail elegante sem disparar unhandled throw.
* `HuddleRepository.upsertHuddleStart()` grava `startSummary` quando disponível sem bloquear a criação se snapshot falhar.
* `HuddleRepository.setHuddleEnded()` grava `endSummary` e atualiza atomicamente `settings/ops.lastHuddleShiftKey`.
* Lógica de Delta calcula a diferença numérica corretamente garantindo "direção boa/ruim" clara (ex: overdue menor é bom, discharge maior é bom).

---

## 8. Pendências RBAC: Delete Server-Side

* **Paths Alvo:** `functions/src/callables/pendencies/deletePendency.ts`
* **Prioridade:** P0
* **Fonte do Contrato:** Compliance e Permissões Operacionais

**Casos de Teste:**

* Usuário Editor (role != admin) recebe erro `permission-denied`.
* Admin remove o item correto do array em transação atômica.
* Exclusão de Pendency inexistente retorna erro `not-found`.
* Exclusão para Bed inexistente retorna erro `not-found`.
* Input faltando as chaves (missing unitId/bedId/pendencyId) retorna erro `invalid-argument`.
* (Critério opcional a validar caso estipulado): Exigir string e validar payload de *reason*.

---

## 9. Component Tests

* **Paths Alvo:** Focados em componentes UI/Widget.
* **Prioridade:** P2
* **Fonte do Contrato:** Visual UX (apenas o indispensável e não-quebrável).

**9.1 `PendencyBadge` (TV)**

* Leito vazio não renderiza o badge.
* open>0, overdue=0 renderiza `.tv-badge--pendencies` com aria-label correto.
* overdue>0 soma `.tv-badge--overdue` para aria-label contendo as pendências já atrasadas.

**9.2 `HuddleConsole`**

* Bloqueia via UI (e render) inserção a partir da 4ª ação aberta no quadro (<= 3 permitidas).
* Renderiza componentes start/end summaries e valores de delta sem erros.

**9.3 `MissionControlTab`**

* Intercepta estado unreviewed/kamishibai cards se `kamishibaiEnabled=false`.
* Renderiza avisos de alerta visual para os items `warnings[]` / "data quality notice".

---

## 10. Seeds (Testes de Consistência e Setup)

* **Paths Alvo:** Rotinas de DB Seeding (ex: `seed.ts` ou equivalentes em scripts)
* **Prioridade:** P0
* **Fonte do Contrato:** Ambiente estável de Sandbox e E2E Testing

**Casos de Teste:**

* `npm run seed` cria docs mínimos de configurações como `settings/ops` (schedule) e `settings/mission_control`.
* Os "seeds" contêm amostras forçadas (ex: blockedAt missing, reviewedAt missing, overdue pendency, canceled) garantindo as queries listadas existirem.
* Constantes e mocks gerados para casos "ESCALATION-01" / "ESCALATION-02" engatilham gatilhos de escalation e batem flags visualmente.
