# Maestro: Project Orchestrator

The Maestro is the central intelligence of the LEAN project. It holds the high-level vision, architectural standards, and coordinates the efforts of specialized subagents.

## Core Responsibilities

- **Architectural Integrity**: Ensure all changes align with the overall project structure.
- **Agent Coordination**: Delegate tasks to specialized subagents (Database, Frontend, Backend, Emulator, Testing, Mobile, UX, UI, Stitch, SecAgent, BQAgent, OpsAgent, SeedAgent, **PMAgent**).
- **Global Context**: Maintain an up-to-date understanding of the entire codebase and project goals.
- **Review & Alignment**: Verify that subagent outputs are consistent and meet the project's premium aesthetic and technical standards (e.g., ensuring all regional services use `southamerica-east1`).

## Decision Hierarchy

1. Maestro defines the "What" and "Why".
2. Subagents define the "How" within their specialized domains.
3. Maestro reviews the "How" for global consistency.

## Project Vision

LEAN / BedSight is a high-performance, modern ward management system for HRHDS, focused on **instrumentalizar gestão Lean hospitalar** (Kamishibai + Kanban + Huddle) com rastreabilidade total e premium aesthetics usando Firebase.

## Skills & Workflows

- **Local Emulator Setup**: See [local-emulator-setup.md](workflows/local-emulator-setup.md) — Start Firebase Emulators, seed data, and run the app locally.

---

## Linha do Tempo — Sessão Lean Refinement (2026-02-28)

### FASE 0 — Auditoria 360 (somente leitura)

Analisou o estado completo do sistema contra princípios Lean do HRHDS. Outputs:

| Artefato | Conteúdo |
|---|---|
| `docs/audits/AUDIT_LeanAlignment_2026-02-28.md` | Gaps vs Lean: Kamishibai, Kanban, Huddle, Mission Control |
| `docs/audits/AUDIT_Kamishibai_States_2026-02-28.md` | Estados, cores, semântica — achados críticos |
| `docs/audits/AUDIT_Firestore_Model_2026-02-28.md` | Schema legado v0: `na`, sem `reviewedShiftKey`, sem `blockedAt` |
| `docs/audits/AUDIT_MissionControl_2026-02-28.md` | KPIs falsos: aging via `updatedAt`, thresholds hardcoded |
| `docs/audits/AUDIT_Cadencia_Huddle_2026-02-28.md` | Huddle sem registro de `shiftKey`, sem evidência de turno |
| `docs/audits/AUDIT_Analytics_Freshness_Aging_2026-02-28.md` | Freshness por domínio ausente |
| `docs/audits/AUDIT_TV_Rotation_2026-02-28.md` | TV rotation sem impacto no audit Lean |

**Gaps críticos identificados:** `na` sendo cor (errado: N/A = sem dot), sem `reviewedShiftKey`, `blockedAt` inexistente, freshness fake, thresholds hardcoded, pendências sem política.

---

### ETAPA 0 — Contrato Lean (somente docs)

Criou o documento canônico que serve de fonte de verdade para toda refatoração:

- **`docs/lean/LEAN_CONTRACT_HRHDS.md`** — semântica de estados e cores, Kamishibai ativo/inativo, cadência Huddle AM/PM, separação display vs política operacional.

---

### ETAPA 0.1 — Artefatos Operacionais (somente docs)

Criou 3 artefatos operacionais derivados do contrato:

| Artefato | Conteúdo |
|---|---|
| `docs/lean/LEAN_STATE_MACHINE_HRHDS.md` | Máquina de estados: Kamishibai (6 domínios), Kanban (4 cat.), Huddle AM/PM — incluindo `entry === undefined` ≠ N/A (só N/A se `domain ∉ applicableDomains`) |
| `docs/lean/LEAN_SHIFTKEY_SPEC_HRHDS.md` | Spec de `shiftKey` = `'YYYY-MM-DD_AM'\|'YYYY-MM-DD_PM'`; lógica de turno (antes das 14h = AM); TTL verde expira ao virar turno |
| `docs/lean/LEAN_MIGRATION_MAP_v0_to_v1.md` | Mapa conservador: `ok` sem `reviewedShiftKey` → UNREVIEWED_THIS_SHIFT (sem cor); `na` → NOT_APPLICABLE (sem dot) |

---

### ETAPA 1.0 — Schema v1 (código)

**Arquivos alterados:** `src/domain/types.ts`, `src/repositories/BedsRepository.ts`  
**Novos campos no schema:**

```typescript
// KamishibaiEntry v1
reviewedShiftKey?: string   // 'YYYY-MM-DD_AM' | 'YYYY-MM-DD_PM'
reviewedAt?: TimestampLike
blockedAt?: TimestampLike   // quando bloqueio iniciou (KPI1 aging real)

// Bed v1
applicableDomains: SpecialtyKey[]       // domínios aplicáveis
mainBlockerBlockedAt?: TimestampLike    // aging do bloqueio principal
```

**Novos métodos no repo:** `registerHuddle()`, `setKamishibaiEnabled()`  
**Ref:** `docs/lean/SCHEMA_V1_CHANGELOG.md`

---

### ETAPA 1.1 — Renderer Kamishibai v1 (código + docs)

**Arquivo alterado:** componente renderer do Kamishibai  
**Lógica canônica derivada:**

```
domain ∉ applicableDomains         → NOT_APPLICABLE (sem dot)
entry === undefined                → UNREVIEWED_THIS_SHIFT (sem cor)
entry.reviewedShiftKey !== current → UNREVIEWED_THIS_SHIFT (sem cor)  // TTL expirou
entry.status === 'blocked'         → BLOCKED (vermelho)
entry.status === 'ok'              → OK (verde)
entry.status === 'na'              → NOT_APPLICABLE (sem dot)  // legado
```

**Atributos DOM:** `data-state="inactive|unreviewed|ok|blocked|na"` para telemetria/acessibilidade  
**Ref:** `docs/lean/RENDERER_V1_ACCEPTANCE_2026-02-28.md`

---

### ETAPA 1.2 — Huddle AM/PM (código + docs)

**Gravação por turno:** ao confirmar huddle → `registerHuddle()` grava `shiftKey` + `huddleAt` no documento da unidade  
**Pendente de huddle:** TV exibe badge quando `huddleShiftKey !== currentShiftKey`  
**Ref:** `docs/lean/HUDDLE_V1_ACCEPTANCE_2026-02-28.md`

---

### ETAPA 1.3 — Mission Control v1 (código + docs)

**Arquivo alterado:** `functions/src/callables/analytics/getAdminMissionControlSnapshot.ts`

**Correções críticas:**

| Gap (Audit) | Correção implementada |
|---|---|
| `blockedAt` inexistente | Agora usa `mainBlockerBlockedAt` para aging KPI1 |
| Freshness fake (via `updatedAt`) | Freshness por domínio via `max(reviewedAt)` |
| "Não revisados neste turno" ausente | `unreviewedBedIds[]` baseado em `reviewedShiftKey !== current` |
| Thresholds hardcoded | `unitSettings.thresholds` com fallback para defaults |

**Payload novo:**

```json
{ "blockedBedIds": [...], "unreviewedBedIds": [...],
  "openPendenciesCount": 5, "overduePendenciesCount": 3,
  "bedsWithOpenPendenciesIds": [...] }
```

**Ref:** `docs/lean/MISSION_CONTROL_V1_ACCEPTANCE_2026-02-28.md`

---

### ETAPA 1.4 — Pendências v1 — Lean Refinement (código + docs)

**Contexto:** 3 gaps críticos do audit que invalidavam a funcionalidade de pendências:

1. Sem política operacional → virava "to-do bonitinho"
2. Qualquer editor podia deletar → apagador de evidência
3. Sem campos de governança → sem rastreabilidade

**Arquivos alterados:**

| Arquivo | Mudança |
|---|---|
| `src/domain/types.ts` | `PendencyStatus += 'canceled'`; `Pendency += updatedAt/updatedBy/canceledAt/canceledBy/note` |
| `src/repositories/BedsRepository.ts` | `cancelPendency()` NOVO via `runTransaction`; `markPendencyDone` → `runTransaction`; `deletePendency` → `runTransaction` + `actor` |
| `src/features/editor/pages/BedDetails.tsx` | Botão cancelar (todos); delete (admin-only via `isAdmin`); lista canceladas colapsada; `data-status`; `aria-label` |
| `functions/.../getAdminMissionControlSnapshot.ts` | `WARN_PENDENCY_MISSING_ID`; filtro `status==='open' && p.id` |
| `scripts/seed-data.ts` | `makePendency` suporta `canceled`; perfil `301.3` com pend cancelada |
| `docs/lean/PERMISSIONS_NOTE.md` | NOVO — RBAC, cancel vs delete, fluxo de estados |

**Schema Pendency v1.1:**

```typescript
type PendencyStatus = 'open' | 'done' | 'canceled';
interface Pendency {
  id: string; title: string; status: PendencyStatus;
  domain?: SpecialtyKey; note?: string; dueAt?: TimestampLike;
  createdAt: TimestampLike; createdBy: ActorRef;
  updatedAt?: TimestampLike; updatedBy?: ActorRef;
  doneAt?: TimestampLike; doneBy?: ActorRef;
  canceledAt?: TimestampLike; canceledBy?: ActorRef;
}
```

**RBAC:**

| Ação | Editor | Admin |
|---|:---:|:---:|
| Criar / Done / Cancelar | ✅ | ✅ |
| Excluir fisicamente | ❌ | ✅ |

**tsc --noEmit:** ✅ 0 erros (ward-board + functions)  
**Commits:** `3a3f464` + `e990615`  
**Ref:** `docs/lean/PENDENCIES_V1_ACCEPTANCE_2026-02-28.md` (v1.1)

---

## Estado Atual do Sistema (2026-02-28 19:37 -03:00)

| Etapa | Status |
|---|:---:|
| 0 — Auditoria 360 | ✅ |
| 0 — Contrato Lean | ✅ |
| 0.1 — State Machine + ShiftKey + Migration Map | ✅ |
| 1.0 — Schema v1 | ✅ |
| 1.1 — Renderer Kamishibai | ✅ |
| 1.2 — Huddle AM/PM | ✅ |
| 1.3 — Mission Control v1 | ✅ |
| 1.4 — Pendências v1 Lean Refinement | ✅ |

## Dívidas Técnicas v1.2 (próximas etapas)

| Item | Impacto | Responsável |
|---|---|---|
| Badge de pendências na TV (gestão à vista) | Alto — visibilidade | FrontendAgent |
| RBAC server-side para `deletePendency` (CF + custom claim) | Médio — segurança | SecAgent + BackendAgent |
| Playwright E2E cobrindo pendências (add, cancel, done, admin-delete) | Médio — qualidade | TestingAgent |
| `totalBedsCount` verificar contagem canônica (seed mostra 33, não 36) | Baixo — KPI | SeedAgent + DatabaseAgent |
