# Maestro: Project Orchestrator

The Maestro is the central intelligence of the LEAN project. It holds the high-level vision, architectural standards, and coordinates the efforts of specialized subagents.

## Core Responsibilities

- **Architectural Integrity**: Ensure all changes align with the overall project structure.
- **Agent Coordination**: Delegate tasks to specialized subagents (Database, Frontend, Backend, Emulator, Testing, Mobile, UX, UI, Stitch, SecAgent, BQAgent, OpsAgent, SeedAgent, PMAgent, ScribeAgent, **AntiSamdAgent**).
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
| --- | --- |
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
| --- | --- |
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

```text
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
| --- | --- |
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
| --- | --- |
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
| --- | :---: | :---: |
| Criar / Done / Cancelar | ✅ | ✅ |
| Excluir fisicamente | ❌ | ✅ |

**tsc --noEmit:** ✅ 0 erros (ward-board + functions)  
**Commits:** `3a3f464` + `e990615`  
**Ref:** `docs/lean/PENDENCIES_V1_ACCEPTANCE_2026-02-28.md` (v1.1)

---

---

### ETAPA 1.9 — Seed Determinístico Lean (2026-03-01)

**Missão:** Eliminar flakiness de E2E eliminando `Math.random()` e `Date.now()` do processo de seed de testes.

**Arquivos criados/alterados:**

| Arquivo | Mudança |
| :--- | :--- |
| `scripts/seed-lean-tests.ts` | NOVO — seed com clock fixo; zero random; IDs legíveis |
| `package.json` | NOVO script `"seed:lean": "tsx scripts/seed-lean-tests.ts"` |
| `docs/lean/SEED_LEAN_CONTRACT_2026-02-28.md` | NOVO — contrato e IDs fixos |
| `docs/lean/SEED_LEAN_ACCEPTANCE_2026-02-28.md` | NOVO — gate de aceite e output esperado |
| `agents/SeedAgent.md` | Atualizado — nova seção `seed:lean v1.0` |

**Clock fixo:**

```typescript
const MOCK_NOW_ISO = '2026-03-01T01:00:00.000Z'; // 2026-02-28T22:00:00 BRT
const CURRENT_SHIFT_KEY = '2026-02-28-PM';
```

**Beds criados (IDs fixos):** `bed_EMPTY`, `bed_UNREVIEWED`, `bed_BLOCKED`, `bed_NOT_APPLICABLE`, `bed_PENDENCIES`, `ESCALATION-01`, `ESCALATION-02`, `ESCALATION-03`

**Pendências fixas:** `PEND_A1` (open), `PEND_A2_OVERDUE`, `PEND_A3_DONE`, `PEND_A4_CANCELED`, `PEND_B1`, `PEND_ESC01_OVERDUE`, `PEND_ESC03_OVERDUE`

**Huddles fixos:** `HUDDLE_2026-02-27-PM`, `HUDDLE_2026-02-28-AM` (com `startSummary`+`endSummary` para delta)

**Regra de uso:** `npm run seed` = dev/demo (random). `npm run seed:lean` = E2E/CI (determinístico).

---

## Estado Atual do Sistema (2026-03-03 23:55 -03:00)

| Etapa | Status |
| :--- | :---: |
| 0 — Auditoria 360 | ✅ |
| 0 — Contrato Lean | ✅ |
| 0.1 — State Machine + ShiftKey + Migration Map | ✅ |
| 1.0 — Schema v1 | ✅ |
| 1.1 — Renderer Kamishibai | ✅ |
| 1.2 — Huddle AM/PM | ✅ |
| 1.3 — Mission Control v1 | ✅ |
| 1.4 — Pendências v1 Lean Refinement | ✅ |
| 1.5 — TV Pendencies & Polish | ✅ |
| 1.6 — Escalonamento v1 | ✅ |
| 1.7 — Leader Standard Work v1 (Huddle) | ✅ |
| 1.8.1 — Escalonamento Canônico (Single Source of Truth) | ✅ |
| 1.9 — Seed Determinístico Lean (`seed:lean`) | ✅ |
| 1.10 — Testes, UX e Hardening | ✅ |
| 2.x — Full Rollback (Restauração do Unit Admin) | ✅ |

### ETAPA 2.x — Full Rollback de Emergência (2026-03-03)

**Decisão Arquitetural:** O sistema passou por um rollback completo (código e banco de dados) retornando ao último commit da Etapa 1.10 (`27148ee`), devido à necessidade de negócios de restaurar a figura central do **Unit Admin**.

**Impacto:**

- As etapas experimentais de UX Mobile, unificação de ícones, e simplificação RBAC (remoção de Unit Admin) foram **desfeitas** e guardadas na branch `backup-hoje`.
- A autorização de `unitAdmin` foi **reinjetada forçosamente via banco de dados** para os 8 usuários de produção via script ad-hoc.
- O Maestro e os Subagentes (Backend, SecAgent) voltaram a considerar o `Unit Admin` como cargo oficial da plataforma e com permissões operacionais completas na unidade.

### Resumo das Etapas Recentes (1.5 a 1.9)

#### 1.5 — TV Pendencies & Polish

- **Core:** Distinção visual e regras para a Gestão à Vista. O badge da TV não é mais atrelado indiscriminadamente.
- **Regra Forte:** Pendência de leito *vazio* não sobe na TV (filtro `patientAlias not-empty`).
- **Design System:** Oficializadas regras para a TV (`font-weight: 700`, bordas mais grossas).

#### 1.6 — Escalonamento v1 (Visual + Governança)

- **Core:** Introdução do conceito "🔥 Escalonamentos" usando cálculo puramente visual (sem BQ, sem CRON, computation em runtime).
- **Thresholds:** Pendências > 12h = Escalonamento Crítico. Bloqueio principal > 24h = Main Blocker Critical.
- **UI:** Card novo no *Mission Control* do Admin + Drilldown clicável para o *AnalyticsListScreen*.

#### 1.7 — Leader Standard Work v1 (LSW)

- **Core:** Checklists semanais/diários de Huddle AM/PM (Review turno > Kanban <24h > Kamishibai > Pendências > Não Revisados > Escalonamentos > Top Ações).
- **UI:** `OpsScreen.tsx` foi atualizado para hospedar o Console LSW para gestão dos turnos. Novo Repository e Domain construídos explicitamente.
- **Ações:** Registo "Top 3 Ações" do turno com dono e status. Review cruza de AM para PM, e vice-versa.
- **TV Banners:** TV agora conta com 3 banners: (1) Último Huddle foi conduzido? (2) Quais as top ações do momento? (3) Feedback de status contínuo.

#### 1.8.1 — Hardening: Escalonamento Canônico Único

- **Core:** Eliminação do risco de divergência (TV vs Mission Control list screen vs Snapshot).
- **Implementação:** Construído um módulo puramente funcional (`domain/escalation.ts`) e consumido por Cloud Functions (`shared/escalation.ts`) e Frontend.
- **Qualidade:** Dados seed hardcodados simulando *Perfeito Encaixe* para Escalonamentos Críticos para evitar métricas vazias sem proof-of-concept.

#### 1.9 — Seed Determinístico Lean

- **Core:** Novo script `seed:lean` com clock fixo `2026-02-28T22:00:00 BRT`, zero `Math.random()`, IDs fixos e legíveis.
- **Cobertura:** 8 beds cobrindo todos os estados Lean (INACTIVE, UNREVIEWED, BLOCKED, NOT_APPLICABLE, OK, PENDENCIES, ESCALATIONS).
- **Huddles:** 2 huddles com `startSummary`+`endSummary` para validar delta entre início e fim de turno.
- **Regra:** `npm run seed` = dev/demo. `npm run seed:lean` = E2E/CI determinístico.

#### 1.10 — Testes, UX e Hardening

- **Testes Mission Control:** E2E completo para Aging KPI, Freshness (Max ReviewedAt) e Alarmes. Testes Unitários de Functions (P0).
- **UX Admin (Mobile & Desktop):** Cabeçalho expandido p/ as extremidades, Menu EduCenter simplificado para botões de interrogação (?), Layout do Kanban App dividido entre Mission Control e Analytics List.
- **Bugfixes:** Erros de CORS/COOP e Permissão Insuficiente ao logar localmente com editores varridos da navegação React.

#### 1.11 — Estabilização Local & E2E Auth Flow (2026-03-06)

- **Login Local Native:** A autenticação local evadiu o bypass problemático do Google Auth Emulator. `LoginScreen.tsx` serve um form de Email/Senha explícito sob sub-condição `isLocalhost`.
- **E2E Playwright:** O `helpers.ts` (`signInViaEmulator`) foi migrado inteiramente para fill explícito de Credentials, garantindo paralelismo seguro local e limpando o viés do botão do Google. 138/141 testes estão passando isolados.
- **Seed com Provider Padrão:** O `seed-lean-tests.ts` foi retificado (`admin.auth().createUser()` com force deletion) em vez do `updateUser()` ambíguo, aniquilando falsos positivos de `auth/wrong-password`.
- **Conflito de Portas de Emuladores:** Identificação e morte de processos orfãos/sujos rodando na :8080 :9099 pertencentes a projetos irmãos (Precepta), limpando falhas graves do tipo `auth/user-not-found` ao errar o target `lean-841e5`.

## Dívidas Técnicas Restantes

| Item | Impacto | Responsável |
| :--- | :--- | :--- |
| RBAC server-side para `deletePendency` (CF + custom claim) | Médio — segurança | SecAgent + BackendAgent |
| Integrar `npm run seed:lean` no CI antes de `npm run test:e2e` | Alto — estabilidade | OpsAgent + TestingAgent |

---

## Bugfix: totalBeds Dessincronizado (2026-03-06)

**Sintoma:** `units/{id}` exibia `totalBeds: 0` no Admin e Editor, mesmo com leitos presentes na subcoleção `beds/`.

**Causa raiz:** `applyCanonicalBeds` (Cloud Function) criava/deletava leitos em batch mas nunca atualizava o campo `totalBeds` no documento pai da unidade. O campo era gravado apenas no log de auditoria, não no documento.

**Arquivos corrigidos:**

| Arquivo | Correção |
| :--- | :--- |
| `functions/src/callables/applyCanonicalBeds.ts` | `batch.update(unitRef, { totalBeds })` adicionado ao batch de operações |
| `src/repositories/BedsRepository.ts` | `bulkUpsertBeds` agora atualiza `totalBeds` via batch |
| `src/components/EditorLayout.tsx` | Removido fallback hardcoded `'A'` para unitId |
| `src/features/editor/pages/MobileDashboard.tsx` | Redireciona para primeira unidade disponível quando `unitId` ausente |

**Dado de produção corrigido:** Script `fix-total-beds-prod.ts` executado — `bRXkIBXfYnW9KJ7WsemU` (Unidade A): `0 → 36 leitos`.

**Commit:** `6241683` — requer `firebase deploy --only functions` para ativar a correção da Cloud Function em produção.
