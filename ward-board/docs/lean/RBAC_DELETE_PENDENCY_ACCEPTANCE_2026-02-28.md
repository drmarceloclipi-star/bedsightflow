# RBAC Delete Pendency — Acceptance Criteria & Evidence

**Date:** 2026-02-28
**Feature:** Hardening RBAC Server-side para `deletePendency` (editor denied, admin allowed).

## 1. Acceptance Criteria

| ID | Criterion | How to Verify | Status |
| --- | --- | --- | --- |
| RB1 | Editor não deleta (UI/Server) | Botão 🗑️ oculto para editor. Chamada isolada falha. | ✅ |
| RB2 | Falha via CF para Editor | Payload forjado chamando `deletePendency` como editor retorna `permission-denied`. | ✅ |
| RB3 | Admin deleta (Físico) | Admin clica em excluir, CF confirma e Pendency sai do DB (array no leito). | ✅ |
| RB4 | Cancelamento livre | Client operation `cancelPendency` no BedDetails continua funcionando para editores. | ✅ |
| RB5 | tsc 0 erros | `npx tsc --noEmit` passa liso em host e functions. | ✅ |
| RB6 | Passa E2E | `npx playwright test tests/pendencies-delete-rbac.spec.ts` 0 failures. | ✅ |

## 2. API / Payload Examples

**Payload base:**

```json
{
  "unitId": "uti-adulto",
  "bedId": "301.2",
  "pendencyId": "pend_xxxxx"
}
```

**Response (Admin):**

```json
{
  "success": true,
  "deletedId": "pend_xxxxx"
}
```

**Response (Editor):**

```json
// Error: HttpsError
{
  "code": "permission-denied",
  "message": "Only admins can perform this action."
}
```

## 3. Evidence

- [x] Cloud Function implementada e exportada.
- [x] Frontend remove array update client side e usa `httpsCallable`.
- [x] E2E rodou comprovando ACL.
