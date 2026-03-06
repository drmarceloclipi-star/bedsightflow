# RBAC Contract — BedSight Flow

> **Documento canônico de autorização.** Qualquer mudança de política deve começar aqui.
> Versão P0 — Março 2026.

---

## Conceitos

| Conceito | O que faz |
| --- | --- |
| **Gate de entrada** | `authorized_users` — lista que controla quem **pode logar** no sistema. |
| **Papéis (roles)** | Claims JWT + documentos `authz` — controlam **o que o usuário pode fazer** depois de logado. |

Esses dois conceitos são **independentes**: estar na whitelist não dá permissão; ter um papel não garante acesso ao sistema sem estar na whitelist.

---

## Papéis e Escopo

### Platform / Super-admin *(futuro — P1+)*

- Multi-instituição.
- Não implementado na UI; gerenciado manualmente.

### Platform Admin — break-glass

- **Claim JWT:** `admin: true` (setado via Cloud Function `setGlobalAdminClaim`).
- **Acesso:** tudo. Sem restrição de unidade.
- **UI:** `/admin`, `/mobile-admin`.
- **Nunca removido automaticamente.** Pelo menos 1 usuário deve ter essa claim no projeto (break-glass de emergência).
- Não há lista de e-mails com esse efeito no runtime (ver seção Legado abaixo).

### Institution Admin *(equivalente ao "admin" P0)*

- Mesmo que Platform Admin nesta fase (app é single-tenant).
- Governado pelo mesmo custom claim `admin: true`.

### Unit Admin *(P1 — não implementado)*

- Role `admin` no documento `/users/{uid}/authz/authz.units.{unitId}`.
- UI de gerenciamento de unidade (`/unit-admin`) ainda não existe.

### Unit Editor

- Role `editor` no documento `/users/{uid}/authz/authz.units.{unitId}`.
- **UI:** `/editor`, `/tv`.

### Unit Viewer

- Role `viewer` no documento `/users/{uid}/authz/authz.units.{unitId}`.
- **UI:** `/tv` (somente leitura).

---

## Fonte de Verdade

| O que verificar | Onde fica |
| --- | --- |
| É global admin? | `token.claims.admin === true` |
| Papéis por unidade | `/users/{uid}/authz/authz` (campo `units`) |
| Pode logar? | `authorized_users` (coleção Firestore) |

**Nunca** usar lista de e-mails hardcoded para decisão de permissão ou roteamento em runtime.

---

## Regras de Rotas (Frontend)

| Rota | Requisito |
| --- | --- |
| `/login` | Público |
| `/tv` | Autenticado (viewer/editor/admin) |
| `/editor` | Autenticado (editor+) |
| `/admin` | `token.claims.admin === true` |
| `/mobile-admin` | `token.claims.admin === true` |

Pós-login bem-sucedido, o usuário é redirecionado para `/tv` (ponto de entrada neutro, acessível a todos os papéis). O admin pode navegar para `/admin` via botão ou diretamente pela URL.

---

## Política de Huddles — Completion (P0)

| Ação | Quem pode |
| --- | --- |
| Criar huddle | Editor+ (completionState ≠ COMPLETED) |
| Atualizar huddle (DRAFT, IN_PROGRESS…) | Editor+ |
| **Setar COMPLETED** | **Somente global admin** (`token.claims.admin === true`) |

> P0 simplifica: Unit Admin não pode completar huddle ainda. Isso é desbloqueado no P1 quando Unit Admin receber UI e fluxo próprios.

---

## Política de Board Settings (P0)

- Somente global admin pode chamar `updateBoardSettings`.
- Não depende de `/units/{unitId}/users/{uid}` (legacy).
- Auditado em `units/{unitId}/audit_logs`.

---

## Legado e Migração

### ADMIN_EMAILS (`src/config/admins.ts`)

- Lista existente **apenas para seed/bootstrap** inicial de custom claims.
- **Não usada** para roteamento, permissão ou autorização em runtime.
- Remover no P1 após confirmar que todos os admins têm custom claim setada.

### `/units/{unitId}/users/{uid}` (legacy data — não é enforcement)

- **Firestore Rules já não usa este caminho** para verificar papéis de unidade (migrado no P0.1).
- Cloud Functions (`updateBoardSettings`) também não dependem mais deste caminho.
- Os dados podem ainda existir no Firestore como legado; a coleção tem regras de leitura/escrita restritas ao global admin para eventuais migrações.
- Limpeza dos documentos residuais fica para P1.

---

## P1 — O que NÃO está implementado ainda

- [ ] Unit Admin UI (`/unit-admin`) e role explícito.
- [ ] Limpeza de dados legados em `/units/{unitId}/users/*` (rules já migradas no P0.1).
- [ ] Whitelist `authorized_users` com docId=email (para consistência nas rules).
- [ ] Papéis Platform/Institution separados.
