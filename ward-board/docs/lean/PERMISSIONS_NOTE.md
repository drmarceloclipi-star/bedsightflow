# PERMISSIONS_NOTE.md — Política de Permissões: Pendências v1

> Ref: `LEAN_CONTRACT_HRHDS.md` | `PENDENCIES_V1_ACCEPTANCE_2026-02-28.md`  
> Vigência: v1 (2026-02-28 →)  
> Princípio: **cancel > delete** — evidência nunca se apaga sem motivo.

---

## Tabela de Permissões

| Ação                        | Editor autenticado | Admin (`claim.admin=true`) |
| --------------------------- | :----------------: | :------------------------: |
| Criar pendência             | ✅                 | ✅                         |
| Marcar como done            | ✅                 | ✅                         |
| **Cancelar** (→ `canceled`) | ✅                 | ✅                         |
| **Excluir** fisicamente     | ❌                 | ✅                         |

---

## Justificativa: Cancel ≠ Delete

| Critério            | Cancelar (`canceled`) | Excluir (`deletePendency`) |
| ------------------- | --------------------- | -------------------------- |
| Rastro de auditoria | ✅ preservado         | ❌ destruído               |
| `canceledAt/By`     | ✅ gravado            | —                          |
| Histórico visível   | ✅ colapsado na UI    | ❌ invisível               |
| Reversível          | ❌ (imutável v1)      | ❌                         |
| Quem pode usar      | Todo editor           | Somente admin              |

**Por que proibir delete para editor?**

Em Lean hospitalar, a pendência é um sinal de fluxo. Apagar sem rastro equivale a esconder um problema sem resolver — destrói a cultura de melhoria contínua e impossibilita auditorias de qualidade.

---

## Implementação

### Client-side (React)

```tsx
// BedDetails.tsx
const { isAdmin } = useAuthStatus(); // hook → verifica custom claim 'admin'

// Cancelar — disponível para todos os editores autenticados
<button onClick={() => handleCancelPendency(p.id)} aria-label={`Cancelar: ${p.title}`}>✕</button>

// Excluir — renderizado condicionalmente apenas para admin
{isAdmin && (
  <button onClick={() => handleDeletePendency(p.id)} aria-label={`Excluir: ${p.title}`}>🗑️</button>
)}
```

### Repository

```ts
// BedsRepository.ts
async cancelPendency(unitId, bedId, pendencyId, actor): Promise<void>  // → status='canceled'
async deletePendency(unitId, bedId, pendencyId, actor): Promise<void>  // → remoção física
```

> **Nota:** O enforcement de RBAC é no client (UI). Para ambientes de produção, recomenda-se complementar com regras Firestore restritivas ou Cloud Function intermediária que valide o custom claim antes de executar delete.

---

## Fluxo de estados

```text
                  ┌────────────┐
    [criar]  ───▶ │    OPEN    │
                  └─────┬──────┘
               ┌────────┴─────────┐
            [done]           [cancel]
               │                  │
               ▼                  ▼
         ┌──────────┐       ┌──────────────┐
         │   DONE   │       │   CANCELED   │
         └──────────┘       └──────────────┘
          (histórico)         (histórico)
               │                  │
               └────────┬─────────┘
                   [delete — admin]
                         │
                         ▼
                    (removido)
```

---

## Campos de Governança

Todo evento de transição de status grava:

| Campo        | Quando                | Valor                                 |
| ------------ | --------------------- | ------------------------------------- |
| `createdAt`  | na criação            | ISO 8601 / FieldValue.serverTimestamp |
| `createdBy`  | na criação            | `{ id, name }` do actor               |
| `updatedAt`  | em qualquer transição | ISO 8601                              |
| `updatedBy`  | em qualquer transição | `{ id, name }` do actor               |
| `doneAt`     | ao marcar done        | ISO 8601                              |
| `doneBy`     | ao marcar done        | `{ id, name }` do actor               |
| `canceledAt` | ao cancelar           | ISO 8601                              |
| `canceledBy` | ao cancelar           | `{ id, name }` do actor               |
