# RBAC Contract — BedSight Flow

> **Documento canônico de autorização.** Qualquer mudança de política deve começar aqui.
> Versão P1 — Março 2026.

---

## Princípio Central

### Autorização vs Autenticação (Gate de entrada)

| Conceito | O que faz |
| --- | --- |
| **Gate de entrada** | `authorized_users` — lista que controla quem **pode logar** no sistema. |
| **Papéis (roles)** | Claims JWT + documentos `authz` — controlam **o que o usuário pode fazer** depois de logado. |

Esses dois conceitos são **independentes**: estar na whitelist não dá permissão; ter um papel não garante acesso ao sistema sem estar na whitelist.

### Separação de Domínios

No BedSight Flow existem **dois domínios completamente diferentes**:

#### A. Domínio da Plataforma (SaaS)

- **Super Admin** — dono da plataforma
- Atua acima das instituições
- Visão multi-instituição
- Painel próprio (`/super-admin`)
- **NÃO participa da hierarquia operacional do hospital**

#### B. Domínio da Instituição (Hospital)

- **Global Admin** — administrador da instituição
- **Unit Admin (Líder Admin)** — administrador de uma unidade
- **Editor** — operador do quadro
- **Viewer** — visualização apenas

Esses papéis pertencem à operação dentro de uma instituição específica.

---

## Separação Obrigatória

| Regra | Descrição |
| --- | --- |
| Super Admin ≠ Global Admin | Super Admin administra a plataforma, NÃO o hospital |
| Global Admin ≠ Super Admin | Global Admin não herda funções de plataforma |
| Sem mistura | Gestão de plataforma, gestão de instituição, gestão de unidade, operação e visualização são camadas separadas |

---

## Papéis e Escopo

### Super Admin (Plataforma)

- **Claim JWT:** `superAdmin: true` (setado via Cloud Function `setSuperAdminClaim`)
- **Escopo:** nível SaaS / multi-instituição
- **UI:** `/super-admin`
- **Pode:** gerenciar instituições clientes, gerenciar usuários globais, administrar aspectos da plataforma
- **Não pode:** atuar como usuário operacional do hospital, seguir hierarquia do portal institucional

### Global Admin (Instituição)

- **Claim JWT:** `admin: true` (setado via Cloud Function `setGlobalAdminClaim`)
- **Escopo:** uma única instituição, todas as unidades
- **UI:** `/admin`, `/mobile-admin`
- **Pode:** gerenciar a instituição, gerenciar unidades, supervisionar operação
- **Não pode:** gerenciar outras instituições, acessar visão multi-instituição, gerenciar camada SaaS

### Unit Admin / Líder Admin

- **Role:** `admin` no documento `/users/{uid}/authz/authz.units.{unitId}`
- **Escopo:** apenas a própria unidade
- **UI:** `/unit-admin`
- **Pode:** gerenciar recursos da unidade, supervisionar operação local
- **Não pode:** administrar a instituição inteira, acessar camada de plataforma

### Editor

- **Role:** `editor` no documento `/users/{uid}/authz/authz.units.{unitId}`
- **Escopo:** unidade(s) autorizada(s)
- **UI:** `/editor`
- **Pode:** inserir/atualizar dados operacionais, alimentar Kanban/Kamishibai
- **Não pode:** administrar instituição ou plataforma

### Viewer

- **Role:** `viewer` no documento `/users/{uid}/authz/authz.units.{unitId}`
- **Escopo:** tela/TV/dashboard em modo leitura
- **UI:** `/tv`
- **Pode:** visualizar quadros
- **Não pode:** editar dados, configurar recursos

---

## Hierarquia do Portal

### Fora da hierarquia operacional

- **Super Admin** — vai direto para `/super-admin`

### Hierarquia operacional da instituição

**Global Admin > Unit Admin > Editor > Viewer**

### Regra mestra do portal

Dentro da instituição, cada papel vê o seu nível e os níveis abaixo dele.

| Papel | Vê |
| --- | --- |
| Global Admin | Global Admin + Unit Admin + Editor + Viewer |
| Unit Admin | Unit Admin + Editor + Viewer |
| Editor | Editor + Viewer |
| Viewer | Viewer |

---

## Fonte de Verdade

| O que verificar | Onde fica |
| --- | --- |
| É super admin? | `token.claims.superAdmin === true` |
| É global admin? | `token.claims.admin === true` |
| Papéis por unidade | `/users/{uid}/authz/authz` (campo `units`) |
| Pode logar? | `authorized_users` (coleção Firestore) |

**Nunca** usar lista de e-mails hardcoded para decisão de permissão ou roteamento em runtime.

---

## Regras de Rotas (Frontend)

| Rota | Requisito |
| --- | --- |
| `/login` | Público |
| `/super-admin` | `token.claims.superAdmin === true` |
| `/admin` | `token.claims.admin === true` |
| `/mobile-admin` | `token.claims.admin === true` |
| `/unit-admin` | Autenticado (unit admin+) |
| `/editor` | Autenticado (editor+) |
| `/tv` | Autenticado (viewer+) |
| `/portal` | Autenticado (redireciona Super Admin para `/super-admin`) |

---

## Política de Huddles — Completion

| Ação | Quem pode |
| --- | --- |
| Criar huddle | Editor+ (completionState ≠ COMPLETED) |
| Atualizar huddle (DRAFT, IN_PROGRESS…) | Editor+ |
| **Setar COMPLETED** | **Super Admin ou Global Admin** |

---

## Política de Board Settings

- Super Admin ou Global Admin podem chamar `updateBoardSettings`.
- Auditado em `units/{unitId}/audit_logs`.

---

## Gestão de Plataforma (Super Admin exclusivo)

| Recurso | Quem pode |
| --- | --- |
| Criar/deletar instituições (units) | Super Admin |
| Gerenciar authorized_users (whitelist global) | Super Admin |
| Setar claim `superAdmin` | Super Admin |
| Setar claim `admin` | Super Admin ou Global Admin |

---

## Legado e Migração

### ADMIN_EMAILS (`src/config/admins.ts`)

- Lista existente **apenas para seed/bootstrap** inicial de custom claims.
- **Não usada** para roteamento, permissão ou autorização em runtime.
- Remover quando todos os admins têm custom claim setada.

### `/units/{unitId}/users/{uid}` (legacy data — não é enforcement)

- Os dados podem existir como legado; rules de leitura/escrita restritas ao admin.
