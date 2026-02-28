# PENDENCIES_V1 — Acceptance Criteria & Evidence

**Versão:** 1.1 (Lean Refinement — Etapa 1.4)  
**Data:** 2026-02-28  
**Escopo:** Pendências Persistentes v1 — schema, CRUD, UI, CF, permissões  
**Autor:** Antigravity

---

## 1. Checklist P1–P5

| # | Critério | Status | Evidência |
|---|---|:---:|---|
| **P1** | Pendência persiste em realtime (listener ativo no BedDetails) | ✅ | `BedsRepository.listenToBed` atualiza `bed.pendencies` via `onSnapshot` — UI reflete imediatamente após `addPendency/markPendencyDone/cancelPendency` |
| **P2** | Persiste entre turnos (dados no Firestore, não em memória) | ✅ | Gravado em `units/{unitId}/beds/{bedId}.pendencies[]` via Firestore; não é estado local |
| **P3** | Overdue calculado corretamente (`dueAt < now && status==='open'`) | ✅ | `const isOverdue = !!p.dueAt && new Date(p.dueAt).getTime() < nowMs` — bed `301.2` tem 1 vencida no seed |
| **P4** | Drill-down funciona (cards → lista filtrada) | ✅ | `MissionControlTab` → `/analytics/lists?filter=pendencies_open` e `?filter=pendencies_overdue`; `AnalyticsListScreen` trata ambos os filtros |
| **P5** | Sem regressão: tsc 0 erros em ward-board + functions | ✅ | `npx tsc --noEmit` → 0 erros (ambos) |

---

## 2. Arquivos Alterados — Etapa 1.4

| Arquivo (path real) | Tipo de mudança |
|---|---|
| `src/domain/types.ts` | `PendencyStatus += 'canceled'`; `Pendency += updatedAt/updatedBy/canceledAt/canceledBy/note` |
| `src/repositories/BedsRepository.ts` | `cancelPendency()` NOVO; `markPendencyDone` → `runTransaction`; `deletePendency` → `runTransaction` + `actor` |
| `src/features/editor/pages/BedDetails.tsx` | `useAuthStatus` importado; botão cancelar (todos); botão excluir (admin); lista canceladas; `data-status`; `aria-label` |
| `functions/src/callables/analytics/getAdminMissionControlSnapshot.ts` | `WARN_PENDENCY_MISSING_ID`; filtro `status==='open' && p.id` |
| `scripts/seed-data.ts` | `PendencyDoc` + `makePendency` suportam `canceled`; `SEED_ACTOR` extraído; perfil `301.3` com pend cancelada |
| `docs/lean/PERMISSIONS_NOTE.md` | NOVO — tabela de permissões, cancel vs delete, fluxo de estados, campos de governança |

---

## 3. JSON Real — Bed com pendencies[]

Este é o **formato exato** que o Firestore armazena, gerado pelo seed para o bed `301.2`:

```json
{
  "id": "301.2",
  "unitId": "A",
  "patientAlias": "MA",
  "mainBlocker": "Estabilização hemodinâmica",
  "mainBlockerBlockedAt": "2026-02-28T05:32:12.000Z",
  "pendencies": [
    {
      "id": "seed_pend_a3f7k2x",
      "title": "Reavaliação médica urgente",
      "status": "open",
      "domain": "medical",
      "createdAt": "2026-02-27T19:32:12.000Z",
      "createdBy": { "id": "seed", "name": "System Seed" }
    },
    {
      "id": "seed_pend_b8m1q9z",
      "title": "Revisit hemoculturas pendentes",
      "status": "open",
      "domain": "nursing",
      "dueAt": "2026-02-27T19:32:12.000Z",
      "createdAt": "2026-02-27T19:32:12.000Z",
      "createdBy": { "id": "seed", "name": "System Seed" }
    }
  ],
  "kamishibai": { "...": "..." }
}
```

> `dueAt = "2026-02-27T..."` com now = `"2026-02-28T..."` → **a segunda pendência é overdue**.

**Bed `301.3` — com pendência cancelada (evidência preservada):**

```json
{
  "id": "301.3",
  "patientAlias": "RB",
  "pendencies": [
    {
      "id": "seed_pend_c2n5p1r",
      "title": "Solicitar parecer cardiologia",
      "status": "canceled",
      "domain": "medical",
      "note": "Cancelado pois paciente foi transferido antes da consulta",
      "createdAt": "2026-02-27T19:32:12.000Z",
      "createdBy": { "id": "seed", "name": "System Seed" },
      "canceledAt": "2026-02-28T16:32:12.000Z",
      "canceledBy": { "id": "seed", "name": "System Seed" },
      "updatedAt": "2026-02-28T16:32:12.000Z",
      "updatedBy": { "id": "seed", "name": "System Seed" }
    }
  ]
}
```

---

## 4. Payload Real — getAdminMissionControlSnapshot

Payload esperado após `npm run seed` (com beds `301.1`, `301.2`, `302.2` com pendências open):

```json
{
  "generatedAt": "2026-02-28T22:32:12.000Z",
  "source": "snapshot_firestore",
  "definitionsVersion": "v1",

  "openPendenciesCount": 5,
  "overduePendenciesCount": 3,
  "bedsWithOpenPendenciesCount": 3,
  "bedsWithOpenPendenciesIds": ["301.1", "301.2", "302.2"]
}
```

> **Nota:** `bedsWithOpenPendenciesCount` usa `.length` de `bedsWithOpenPendenciesIds`, não `openPendenciesCount`. Um bed com 3 pendências open conta como 1 bed.
>
> `301.3` **não aparece** em `bedsWithOpenPendenciesIds` porque sua única pendência é `canceled` — ignorado pelo filtro `status==='open'`.

---

## 5. Schema v1.1 — Campos Completos

```typescript
export type PendencyStatus = 'open' | 'done' | 'canceled';

export interface Pendency {
  id: string;                    // UUID no client (crypto.randomUUID)
  title: string;                 // Obrigatório
  domain?: SpecialtyKey;         // Opcional (D2: sem owner obrigatório)
  note?: string;                 // Contexto adicional
  dueAt?: TimestampLike;         // D4: ausência = open sem badge
  status: PendencyStatus;
  createdAt: TimestampLike;
  createdBy: ActorRef;
  updatedAt?: TimestampLike;     // Governança: última modificação
  updatedBy?: ActorRef;
  doneAt?: TimestampLike;
  doneBy?: ActorRef;
  canceledAt?: TimestampLike;    // Preserva evidência (≠ delete)
  canceledBy?: ActorRef;
}
```

---

## 6. Regras Operacionais v1.1

| Regra | Comportamento |
|---|---|
| `status='open'` sem `dueAt` | Aparece na lista open sem badge de prazo (D4) |
| `status='open'` com `dueAt < now` | Indicada com ⚠ "Vencida" em vermelho + `data-status="overdue"` |
| `status='done'` | Lista colapsada "Concluídas" — mostra `doneAt` + `doneBy.name` |
| `status='canceled'` | Lista colapsada "Canceladas" — `canceledAt` + `canceledBy.name` preservados |
| **Cancelar** (`cancelPendency`) | Disponível para todo editor; usa `runTransaction` |
| **Excluir** (`deletePendency`) | Somente admin — `{isAdmin && <button/>}`; `handleDeletePendency` guarda `!isAdmin` |
| `addPendency` usa `arrayUnion` | Safe para multi-usuário simultâneo |
| `markPendencyDone` usa `runTransaction` | Elimina race condition de read-then-write |

---

## 7. Política de Permissões

| Ação | Editor | Admin |
|---|:---:|:---:|
| Criar | ✅ | ✅ |
| Marcar done | ✅ | ✅ |
| **Cancelar** | ✅ | ✅ |
| **Excluir fisicamente** | ❌ | ✅ |

> Ref: `docs/lean/PERMISSIONS_NOTE.md`

---

## 8. Dados de Teste (seed v1.1)

| Bed | Pendências | Aparece em |
|---|---|---|
| `301.1` | 1 open (sem prazo) | `pendencies_open` |
| `301.2` | 2 open (1 vencida: hemoculturas) | `pendencies_open` + `pendencies_overdue` |
| `301.3` | 1 **canceled** (cardiologia) | Não aparece em nenhum filtro open |
| `302.1` | 1 done | Não aparece nos filtros open/overdue |
| `302.2` | 2 open vencidas | `pendencies_open` + `pendencies_overdue` |

---

## 9. Como Reproduzir

```bash
# 1. Iniciar emuladores
npm run emulators

# 2. Seed (em outro terminal)
npm run seed

# 3. Editor — leito com overdue
# http://localhost:5173/editor/301.2?unit=A
# → Seção "Pendências" com 2 itens: 1 normal, 1 com ⚠ Vencida em vermelho
# → Botão ✕ (cancelar) visível para todos
# → Botão 🗑️ (excluir) visível SOMENTE para admin

# 4. Editor — histórico de cancelada
# http://localhost:5173/editor/301.3?unit=A
# → Seção "Ver canceladas (1)" → expandir → mostra "Solicitar parecer cardiologia"

# 5. Mission Control
# http://localhost:5173/admin/unit/A/analytics
# → Cards "Pendências abertas" (warning) + "Pendências vencidas" (critical)
# → Clicar drill-down → lista filtrada

# 6. Listas filtradas
# http://localhost:5173/admin/unit/A/analytics/lists?filter=pendencies_open
# http://localhost:5173/admin/unit/A/analytics/lists?filter=pendencies_overdue

# 7. Verificação de tipagem
cd ward-board && npx tsc --noEmit   # → 0 erros
cd functions   && npx tsc --noEmit  # → 0 erros
```

---

## 10. Dívidas Técnicas v1.2

| Item | Impacto | Prioridade |
|---|---|---|
| Pendências na TV — badge "X pendências" no card do leito | Visibilidade (gestão à vista) | Alto |
| RBAC server-side: Cloud Function validar custom claim `admin` antes de delete | Segurança extra | Médio |
| Paginação em `bedsWithOpenPendenciesIds` (atual: limitado a 200) | Escala | Baixo |
| Campo `owner` opcional em v1.2 (D2 revisão) | Lean (responsabilidade) | Baixo |

---

## 11. Verificação tsc

```
cd ward-board && npx tsc --noEmit  →  ✅ 0 erros  (2026-02-28 19:32 -03:00)
cd functions  && npx tsc --noEmit  →  ✅ 0 erros  (2026-02-28 19:32 -03:00)
```

**Commit:** `3a3f464` — `feat(pendencies): Lean refinement v1 — canceled status + RBAC delete + governance fields`
