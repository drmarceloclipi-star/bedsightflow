# SecAgent: Security & Authorization Specialist

The SecAgent is responsible for all security concerns in the LEAN system, including authentication, role-based access control, and Firestore security rules.

## Specializations

- **RBAC**: Defining and enforcing roles (admin, nurse, viewer) across the application.
- **Firestore Rules**: Writing, validating, and auditing security rules for all collections.
- **Firebase Auth**: Managing authentication flows, whitelists, and email-to-role mapping.
- **Threat Modeling**: Identifying potential attack vectors and hardening the system.
- **Session Security**: Ensuring tokens, claims, and sessions are handled safely.

## Technical Stack

- Firebase Authentication (ensure region consistency)
- Firestore Security Rules (`southamerica-east1`)
- Firebase Custom Claims
- TypeScript (auth helpers)

---

## Política de Permissões Atual — Pendências v1.1 (2026-02-28)

Ref: `docs/lean/PERMISSIONS_NOTE.md`

| Ação | Editor autenticado | Admin (`claim.admin=true`) |
| --- | :---: | :---: |
| Criar pendência (`addPendency`) | ✅ | ✅ |
| Marcar done (`markPendencyDone`) | ✅ | ✅ |
| **Cancelar** (`cancelPendency`) | ✅ | ✅ |
| **Excluir fisicamente** (`deletePendency`) | ❌ | ✅ |

### Princípio: Cancel > Delete

- **Cancelar** preserva evidência (Lean: auditabilidade > conveniência).
- **Excluir** é operação administrativa que destrói o rastro — restrita a `admin`.

### Enforcement Atual (v1)

- **Client-side**: `useAuthStatus()` → `isAdmin` → condiciona `{isAdmin && <button 🗑️/>}`.
- **`handleDeletePendency`**: guarda `if (!isAdmin) return` antes de chamar o repository.

### Débito de Segurança v1.2 (registrado)

> O enforcement atual é **somente client-side**. Para produção, implementar validação server-side:
>
> - Cloud Function intermediária que verifica `context.auth.token.admin === true` antes de executar o delete físico.
> - Alternativa: Firestore Rules restritivas no campo `pendencies` (complexo com array embarcado).

### Hook de Autenticação

```typescript
// src/hooks/useAuthStatus.ts
const { isAdmin } = useAuthStatus();
// isAdmin = true se custom claim 'admin' === true
// ou se email está em HARDCODED_ADMIN_EMAILS (fallback dev)
```

---

## Incidente e Rollback (2026-03-03)

**Decisão:** O sistema sofreu um rollback de versão via git e Firestore para restaurar a gestão e os papéis de `unitAdmin`. Devido a uma decisão de negócios urgente, as "Simplificações de RBAC" desenvolvidas hoje (Etapa 2.2) que eliminavam o papel de admin da unidade foram descartadas em prol da segurança e funcionalidades da versão anterior (commit `27148ee` - Etapa 1.10).
Ocorreu também a execução do script `functions/restore-unit-admins.js` para recriar as entradas de `role: "unitAdmin"` manualmente no banco de dados para os 8 perfis do comitê.
