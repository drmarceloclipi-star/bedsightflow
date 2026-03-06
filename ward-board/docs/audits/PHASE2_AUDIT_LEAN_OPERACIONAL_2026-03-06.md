# Auditoria Lean-Operacional — BedSight Flow · Fase 2
**Data:** 2026-03-06
**Branch base:** `main` (após merge dos patches C1–C3, M1–M5)
**Metodologia:** Genba digital + VSM + discovery técnico
**Escopo:** Editor mobile, TV Dashboard, Admin / Mission Control, Pendências, Kanban, Kamishibai, Huddle/LSW, Analytics, RBAC

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Stack e Arquitetura](#2-stack-e-arquitetura)
3. [Achados por Função](#3-achados-por-função)
4. [Fluxo de Valor Atual (VSM)](#4-fluxo-de-valor-atual-vsm)
5. [Gargalos Priorizados](#5-gargalos-priorizados)
6. [Lacunas de Produto](#6-lacunas-de-produto)
7. [Lacunas Técnicas](#7-lacunas-técnicas)
8. [Avaliação como Sistema de Governança](#8-avaliação-como-sistema-de-governança)
9. [Próximos Passos P0 / P1 / P2](#9-próximos-passos-p0--p1--p2)
10. [Apêndice: Inventário de Arquivos-Chave](#10-apêndice-inventário-de-arquivos-chave)

---

## 1. Resumo Executivo

### Veredito: infraestrutura sólida — rotina operacional ainda depende de esforço humano não estruturado

Após os patches C1–C3 (riscos críticos) e M1–M5 (riscos moderados), o BedSight atingiu **nível de maturidade operacional piloto**. O modelo de domínio é rico e correto. RBAC, auditoria e funções puras estão implementados de forma defensiva.

Entretanto, **4 gaps estruturais** ainda impedem a rotina operacional autônoma:

| Prioridade | Gap | Impacto |
|-----------|-----|---------|
| 🔴 P0 | `computeShiftKey` duplicado sem verificação de convergência | Divergência silenciosa quebraria Kamishibai e Huddle |
| 🔴 P0 | Mission Control sem cache — snapshot on-demand de 60 s | Gestores recebem dados defasados durante o turno |
| 🟠 P1 | `topBlockerNow` calculado mas invisível na TV | Operador não vê o bloqueador mais frequente em tempo real |
| 🟠 P1 | Sem editor de Kamishibai na UI | Equipes multiprofissionais não conseguem registrar status |

Além desses, foram identificadas **6 lacunas de produto** e **8 lacunas técnicas** com severidade média.

**O sistema SUSTENTA:**
- Visualização em tempo real com escalações automáticas
- Entrada de dados auditada (leito, bloqueador, especialidades, alta prevista)
- Gestão de pendências com SLA e overdue
- Trilha de auditoria completa (append-only) com correlationId
- RBAC com custom claims e regras por coleção

**O sistema AINDA DEPENDE de esforço humano para:**
- Atualizar manualmente Mission Control durante o turno
- Registrar status Kamishibai por equipe (sem UI dedicada)
- Encerrar formalmente cada huddle (ação opcional, não forçada)
- Corrigir `mainBlockerBlockedAt` ausente em leitos v0 (data quality)
- Monitorar escalações sem notificação proativa

---

## 2. Stack e Arquitetura

### 2.1 Tecnologias

| Componente | Tecnologia | Versão |
|-----------|-----------|--------|
| Frontend (SPA) | React + TypeScript | 19.x |
| Build | Vite | 7.3.1 |
| Database | Firebase Firestore | ^12.9 |
| Cloud Functions | Firebase Functions v1 | region: southamerica-east1 |
| Testes unitários | Vitest | ^4.0.18 |
| Testes E2E | Playwright | ^1.58.2 |
| Mobile packaging | Capacitor | ^8.1.0 |
| Charts | Recharts | ^3.7.0 |

### 2.2 Modelo de Dados (Firestore)

```
units/{unitId}/
├── beds/{bedId}           # Estado real-time de cada leito
├── users/{uid}            # Papel do usuário na unidade
├── huddles/{shiftKey}     # Registro de huddle por turno
├── audit_logs/{logId}     # Append-only (trigger-only write)
└── settings/
    ├── ops                # UnitOpsSettings (schedule, kanbanMode, lswGraceMinutes)
    ├── board              # BoardSettings (rotação TV)
    └── mission_control    # MissionControlThresholds (overrides de escalação)

authorized_users/{uid}     # Whitelist global
users/{uid}/authz/authz    # RBAC document (units:{unitId}.role)
```

### 2.3 Padrão Arquitetural

**Domain-Driven Design + Repository Pattern:**
- `src/domain/` — lógica pura, sem I/O, 100% testável
- `src/repositories/` — interface abstrata para Firestore (Client SDK)
- `functions/src/callables/` — operações admin-only com auditoria
- `functions/src/triggers/` — `auditBedWrites` (append-only)
- `src/features/` — componentes React estratificados por funcionalidade

**Separação de responsabilidades:** clara. Computed state nunca é persistido (estados visuais Kamishibai são derivados em runtime).

### 2.4 Rotas e Superfícies

| Superfície | Usuário-alvo | Acesso |
|-----------|-------------|--------|
| TV Dashboard | Equipe da unidade (readonly) | Público (sem auth) |
| Editor Mobile | Enfermeiro / Médico (editor+) | Auth + RBAC unit member |
| Admin / Mission Control | Gestor da unidade (admin) | Auth + RBAC unit admin |
| Console Huddle/LSW | Gestor / Facilitador | Auth + RBAC unit editor+ |

---

## 3. Achados por Função

### 3.1 TV Dashboard (`src/features/tv/pages/TvDashboard.tsx`, 324 linhas)

**Fluxo de dados:**
```
BedsRepository.listenToBeds()          → state.beds
BoardSettingsRepository.listenTo()     → state.settings (rotação)
UnitSettingsRepository.subscribe()     → state.opsSettings
UnitSettingsRepository.subscribeMC()  → state.missionControlThresholds  ✓ dinâmico
HuddleRepository.listenToHuddle(curr) → state.currentHuddle
HuddleRepository.listenToHuddle(prev) → state.previousHuddle
setInterval(30s)                       → setNow() → recompute escalações
```

**6 listeners simultâneos abertos.** Custo Firestore aceitável em escala piloto (≤36 leitos), mas deve ser monitorado ao crescer.

| Achado | Arquivo:Linha | Severidade | Status |
|--------|-------------|-----------|--------|
| Thresholds de escalonamento dinâmicos | TvDashboard.tsx:114 | — | ✅ OK |
| `computeEscalations()` reutilizado (shared SSoT) | TvDashboard.tsx:145 | — | ✅ OK |
| Huddle Pendente renderizado corretamente | TvDashboard.tsx:257-281 | — | ✅ OK |
| **`topBlockerNow` não exibido na TV** | TvDashboard.tsx | 🟠 Alta | ❌ Gap |
| Refresh de relógio a 30 s | TvDashboard.tsx:42 | — | ✅ OK |

**Rotação de painéis (`TvRotationContainer.tsx`):**
- Configurável via `settings.screens` (BoardSettings)
- `durationSeconds` por tela, `enabled` por tela
- Override por query param `?screen=kanban`
- ✅ Correto

### 3.2 Editor Mobile (`src/features/editor/pages/BedDetails.tsx`, ~250 linhas)

**Campos editáveis:**

| Campo | Validação | Persistência | Auditoria |
|-------|-----------|-------------|----------|
| `patientAlias` | obrigatório se leito ativo | updateDoc | ✅ |
| `expectedDischarge` | tipo restrito | updateDoc | ✅ |
| `mainBlocker` | texto livre | updateDoc | ✅ |
| `involvedSpecialties` | múltipla seleção | updateDoc | ✅ |
| `applicableDomains` | v1, opcional | updateDoc | ✅ |

**Actor capture:** uid + email + displayName capturados em BedDetails.tsx:34-44. ✅

**Pendências:** form presente (title, domain, dueAt, note). Toggles de filtro (done, canceled). ✅

| Achado | Arquivo:Linha | Severidade | Status |
|--------|-------------|-----------|--------|
| `dueAt` exposto e editável | BedDetails.tsx:31 | — | ✅ OK |
| Badge overdue renderizado na TV | KamishibaiScreen.tsx:34 | — | ✅ OK |
| **Sem editor Kamishibai na UI** | — | 🟠 Alta | ❌ Gap |
| **Sem filtro de pendências por `domain`** | BedDetails.tsx | 🟡 Média | ❌ Gap |
| **`mainBlockerBlockedAt` sem preenchimento obrigatório** | BedDetails.tsx | 🟡 Média | ❌ Gap |

### 3.3 Admin / Mission Control

**Snapshot (`getAdminMissionControlSnapshot.ts`, 312 linhas):**

`buildSnapshot()` é função pura — recebe beds[], ops, thresholds, now → retorna MissionControlSnapshot. ✅ Testável.

**KPIs calculados:**

| KPI | Fonte | Renderizado em |
|-----|-------|----------------|
| Bloqueados (count + %) | `mainBlocker !== ''` | MissionControlTab.tsx ✅ |
| Aging máximo de bloqueador | `mainBlockerBlockedAt` ou fallback `updatedAt` | MissionControlTab.tsx ✅ |
| Altas 24h | `expectedDischarge === '24h'` | MissionControlTab.tsx ✅ |
| Freshness Kamishibai | `reviewedAt` por turno | MissionControlTab.tsx ✅ |
| Não revisados no turno | `reviewedShiftKey !== currentShift` | MissionControlTab.tsx ✅ |
| Escalonamentos ativos | `computeEscalations()` | MissionControlTab.tsx ✅ |
| Pendências abertas / vencidas | `status==='open'`, `dueAt < now` | MissionControlTab.tsx ✅ |
| **`topBlockerNow`** | aggregação em `buildSnapshot()` | TopBlockersTable.tsx apenas |

| Achado | Arquivo:Linha | Severidade | Status |
|--------|-------------|-----------|--------|
| `buildSnapshot` função pura + testada | getAdminMissionControlSnapshot.ts:82 | — | ✅ OK |
| Thresholds mergeados com defaults | getAdminMissionControlSnapshot.ts:90-105 | — | ✅ OK |
| Fallback `updatedAt` gera warning na UI | MissionControlTab.tsx:93-116 | — | ✅ OK |
| **Sem cache de snapshot (60 s manual)** | MissionControlScreen.tsx:26-29 | 🔴 Crítica | ❌ Gap |
| **`topBlockerNow` calculado, não exibido na TV** | — | 🟠 Alta | ❌ Gap |
| Thresholds customizados carregados | MissionControlTab.tsx:61 | — | ✅ OK |

### 3.4 Kamishibai

**Fluxo de estados (derivados, nunca persistidos):**

```
bed.kamishibai[domain].status           → stored ('ok' | 'blocked' | 'na')
bed.kamishibai[domain].reviewedShiftKey → stored (string)
applicableDomains[]                     → stored (opcional)
computeShiftKey(schedule, now)          → currentShiftKey (derived)
─────────────────────────────────────────────────────────────────────────
resolveKamishibaiVisualState()          → INACTIVE | NOT_APPLICABLE |
                                          UNREVIEWED_THIS_SHIFT | OK | BLOCKED
```

**5 estados visuais corretos.** `applicableDomains` respeita Variante A (domínios configuráveis por leito). ✅

| Achado | Arquivo:Linha | Severidade | Status |
|--------|-------------|-----------|--------|
| **`computeShiftKey` duplicado — client vs CF** | src/domain/shiftKey.ts vs functions/src/shared/shiftKey.ts | 🔴 Crítica | ❌ Gap |
| `reviewedShiftKey` persistido corretamente | types.ts:141 | — | ✅ OK |
| V0 compat `'na'` preservado (read-only) | types.ts:129 | — | ✅ OK |
| `applicableDomains` Variante A implementada | kamishibaiVisualState.ts:54-59 | — | ✅ OK |
| **Sem UI para registrar status Kamishibai** | — | 🟠 Alta | ❌ Gap |
| **Sem UI para registrar razão de bloqueio** | — | 🟠 Alta | ❌ Gap |

### 3.5 Pendências

**Schema (`types.ts:182-225`):** completo — id, title, domain, note, dueAt, status, createdBy, doneBy, canceledBy. ✅

**Regras de negócio:**
- Overdue = `status === 'open' && dueAt < now` (`pendencies.ts:64`)
- Delete físico: exclusivo de admin via Cloud Function `deletePendency` ✅
- arrayUnion para add, runTransaction para mark-done e cancel ✅

| Achado | Arquivo:Linha | Severidade | Status |
|--------|-------------|-----------|--------|
| Badge overdue "2 ⚠1" renderizado | KamishibaiScreen.tsx:34 | — | ✅ OK |
| Cancelamento preserva evidência | pendencies.ts + deletePendency.ts | — | ✅ OK |
| **Sem filtro por `domain` na UI** | BedDetails.tsx | 🟡 Média | ❌ Gap |
| Campo `domain` existe no schema | types.ts:188 | — | ✅ OK (sub-utilizado) |

### 3.6 Kanban (`src/features/tv/components/KanbanScreen.tsx`)

**Colunas:** Leito, Paciente, Especialidades, Previsão Alta, Bloqueador, Pendências — **hardcoded**.

**Dados:** mesma fonte que grade de leitos (Firestore listener). Sem filtragem especial.

| Achado | Arquivo:Linha | Severidade | Status |
|--------|-------------|-----------|--------|
| **`kanbanMode` flag renderizado mas sem efeito** | TvDashboard.tsx:242 | 🟡 Média | ❌ Gap |
| Badge overdue nas linhas kanban | KanbanScreen.tsx:37 | — | ✅ OK |
| Especialidades com abreviações | KanbanScreen.tsx | — | ✅ OK |

### 3.7 Huddle / LSW (`src/features/admin/components/ops/HuddleConsole.tsx`, ~250 linhas)

**Funcionalidades presentes:**
- Iniciar huddle (`startedAt`)
- Encerrar huddle (`endedAt`) — obrigatório para "Huddle Pendente" desaparecer da TV
- Checklist de 8 itens padrão HRHDS
- Top Actions (máx 3, enforçado em `huddle.ts:85`)
- Snapshot de estado ao início e fim (startSummary / endSummary)

**Segurança:** somente global admin pode setar `completionState === 'COMPLETED'` (firestore.rules:84-86). ✅

| Achado | Arquivo:Linha | Severidade | Status |
|--------|-------------|-----------|--------|
| `lswGraceMinutes` presente em `types.ts` | types.ts:405 | — | ✅ OK |
| `computeHuddleCadence()` implementado | lswCadence.ts | — | ✅ OK |
| **Encerramento opcional — sem validação de transição** | HuddleConsole.tsx | 🟡 Média | ❌ Gap |
| Checklist default 8 itens | huddle.ts:90-99 | — | ✅ OK |
| Banner "Huddle Pendente" na TV | TvDashboard.tsx:257-281 | — | ✅ OK |

### 3.8 Analytics e Cloud Functions

**8 funções de analytics — todas consultam Firestore, nenhuma usa BigQuery real:**

| Função | Propósito | Naming |
|--------|-----------|--------|
| `getAdminMissionControlSnapshot` | Snapshot on-demand | ✅ claro |
| `getAdminMissionControlPeriod` | Histórico de período | ✅ claro |
| `getAdminOverviewBQ` | Ocupação e bloqueadores | ⚠️ "BQ" enganoso |
| `getAdminKamishibaiStatsBQ` | Distribuição Kamishibai | ⚠️ "BQ" enganoso |
| `getAdminFlowMetricsBQ` | Entry/exit métricas | ⚠️ "BQ" enganoso |
| `getAdminFreshnessBQ` | Aging de revisão | ⚠️ "BQ" enganoso |
| `getAdminTopBlockersBQ` | Ranking bloqueadores | ⚠️ "BQ" enganoso |
| `getAdminTrendComparisonBQ` | Comparação períodos | ⚠️ "BQ" enganoso |

**Índices Firestore (`firestore.indexes.json`, 147 linhas):** 9 índices compostos para `audit_logs`. Cobrem queries por entityType, actor.uid, action, correlationId. ✅

---

## 4. Fluxo de Valor Atual (VSM)

### 4.1 Fluxo de Turno Ideal (Lean HRHDS)

```
Início de turno
    │
    ▼
[1] Iniciar Huddle ──→ Checklist → Top Actions → Encerrar Huddle
    │                                              │
    │                                              ▼
    │                                    Badge "Huddle Pendente" desaparece da TV
    │
    ▼
[2] Atualizar leitos (editor mobile)
    Alias │ Bloqueador │ Alta Prevista │ Especialidades
    │
    ▼
[3] Kamishibai — cada equipe revisa seu domínio
    ok │ blocked │ N/A
    │
    ▼
[4] Mission Control — gestor monitora KPIs
    Bloqueados │ Não revisados │ Escalações │ Pendências vencidas
    │
    ▼
[5] Ação corretiva → resolve bloqueador → atualiza leito
    │
    ▼
Fim de turno
```

### 4.2 Fluxo Atual Real (Observado no Código)

```
Início de turno
    │
    ▼
[1] Iniciar Huddle ← implementado (HuddleConsole)
    Encerrar Huddle ← implementado mas OPCIONAL (sem validação)
    │
    ▼
[2] Atualizar leitos ← implementado (BedDetails)
    mainBlockerBlockedAt ← não obrigatório (aging impreciso)
    │
    ▼
[3] Kamishibai ← SEM EDITOR NA UI ← ❌ BLOQUEIO
    Equipes não têm como registrar status sem backoffice
    │
    ▼
[4] Mission Control ← on-demand (60 s manual) ← LATÊNCIA
    topBlockerNow calculado mas não visível na TV ← ❌ Gap
    │
    ▼
[5] Ação corretiva ← implementada (editor mobile)
```

### 4.3 Mudas (Desperdícios) Identificados

| Muda (desperdício Lean) | Manifestação no Sistema |
|------------------------|------------------------|
| **Espera** | Mission Control atualiza a cada 60 s — gestor espera |
| **Processamento desnecessário** | Equipes registram Kamishibai fora do sistema (papel/WhatsApp) |
| **Informação oculta** | `topBlockerNow` calculado mas não exibido onde é mais útil (TV) |
| **Transporte** | Gestor acessa Admin para ver o que poderia ver na TV |
| **Defeito latente** | `computeShiftKey` duplicado — divergência possível |

---

## 5. Gargalos Priorizados

### P0 — Bloqueia governança autônoma

**G1 — `computeShiftKey` duplicado** (`src/domain/shiftKey.ts` vs `functions/src/shared/shiftKey.ts`)

Risco: algoritmo idêntico mantido em 2 lugares de forma manual. Uma mudança de horário de turno aplicada em apenas um dos locais faria o Huddle (frontend) e o Kamishibai (CF) calcularem turnos diferentes — invalidando `reviewedShiftKey`, contagens de "não revisado" e o badge "Huddle Pendente" na TV.

**G2 — Sem cache de snapshot no Mission Control**

Cada acesso ao Mission Control dispara uma Cloud Function cold-start que lê todos os leitos. Com o refresh automático de 60 s, são ~60 invocações por hora por gestor. Dados mostrados têm até 60 s de defasagem. Em cenários de escalação crítica, essa latência é inaceitável.

### P1 — Impacta qualidade da rotina

**G3 — Sem editor Kamishibai na UI**

Equipes multiprofissionais não têm interface para marcar status. A realidade operacional é que usam papel ou WhatsApp como fallback. Isso anula KPIs de "não revisado" e "impedimento Kamishibai".

**G4 — `topBlockerNow` invisível na TV**

O campo `topBlockerNow` (com nome, count e % de leitos) é calculado pelo Mission Control snapshot mas só aparece em `TopBlockersTable` (admin). A TV — superfície de maior visibilidade — não exibe esta informação. Gestores que monitoram pela TV não sabem qual bloqueador domina o turno.

---

## 6. Lacunas de Produto

### 6.1 Lacunas de Experiência (UX/UI)

| ID | Lacuna | Impacto | Esforço |
|----|--------|---------|---------|
| LP-01 | **Editor Kamishibai ausente** — equipes não têm como registrar ok/blocked/N/A | Alto | 2-3 dias |
| LP-02 | **`topBlockerNow` fora da TV** — gestor não vê bloqueador dominante sem entrar no admin | Alto | 1 dia |
| LP-03 | **`kanbanMode` sem semântica** — flag configurável mas sem efeito operacional real | Médio | 1 dia |
| LP-04 | **Sem filtro de pendências por domínio** — equipes veem pendências de todas as especialidades | Médio | 0.5 dia |
| LP-05 | **Huddle completion não forçada** — fluxo de encerramento é opcional, gera ambiguidade | Médio | 1 dia |
| LP-06 | **`mainBlockerBlockedAt` não obrigatório na UI** — aging impreciso (fallback `updatedAt` gera warning) | Médio | 0.5 dia |

### 6.2 Lacunas de Processo (Operacional)

| ID | Lacuna | Impacto |
|----|--------|---------|
| LO-01 | **Sem notificações push de escalações** — usuário descobre escalação apenas entrando no sistema | Alto |
| LO-02 | **Sem relatório de aderência de huddle** — `computeHuddleCadence()` existe, sem UI de histórico | Médio |
| LO-03 | **Sem UI de configuração de thresholds** — overrides de `mission_control` só via console Firestore | Baixo |

---

## 7. Lacunas Técnicas

| ID | Lacuna | Severidade | Arquivo(s) |
|----|--------|-----------|------------|
| LT-01 | **`computeShiftKey` duplicado** — client vs CF, sync manual, sem teste de divergência | 🔴 Crítica | `src/domain/shiftKey.ts`, `functions/src/shared/shiftKey.ts` |
| LT-02 | **Sem cache de Mission Control snapshot** — 60 s de latência por cold-start | 🔴 Crítica | `MissionControlScreen.tsx:26-29`, `getAdminMissionControlSnapshot.ts` |
| LT-03 | **Nomenclatura "*BQ" enganosa** — todas consultam Firestore, nenhuma usa BigQuery | 🟡 Média | `functions/src/callables/analytics/*BQ.ts` (6 arquivos) |
| LT-04 | **Sem testes unitários para CFs críticas** — `applyCanonicalBeds`, `softResetUnit`, `setUnitUserRole` sem cobertura | 🟡 Média | `functions/src/callables/` |
| LT-05 | **`kanbanMode` flag sem implementação** — enum declarado, nenhuma lógica diferencia comportamento | 🟡 Média | `TvDashboard.tsx:242`, `types.ts:367` |
| LT-06 | **6 listeners simultâneos na TV** — custo Firestore cresce com escala | 🟢 Baixa | `TvDashboard.tsx:88-122` |
| LT-07 | **Capacitor Android sem CI/CD de APK** — build mobile sem pipeline documentado | 🟢 Baixa | `capacitor.config.ts`, `android/` |
| LT-08 | **Sem health check de Cloud Functions no CI** — 500s permanecem em produção sem detecção | 🟢 Baixa | `.github/workflows/ci.yml` |

---

## 8. Avaliação como Sistema de Governança

### 8.1 Matriz de Maturidade por Dimensão

| Dimensão | Maturidade | Nota |
|----------|-----------|------|
| **Visualização em tempo real** | ✅ Alta | TV com rotação, dados live, semáforos, escalações |
| **Entrada de dados (leito)** | ✅ Alta | Editor mobile funcional, auditado, RBAC, actor capture |
| **Pendências operacionais** | ✅ Alta | Schema v1 completo, dueAt, overdue badge, audit trail |
| **RBAC e segurança** | ✅ Alta | Custom claims, document-level rules, audit append-only |
| **Kamishibai (cadência multiprofissional)** | 🟡 Média | Modelo correto, sem UI de entrada por equipe |
| **Huddle / LSW** | 🟡 Média | Estrutura implementada, encerramento opcional |
| **Mission Control (KPIs)** | 🟡 Média | Snapshot correto, latência de 60 s, sem cache |
| **Escalação e alertas** | 🟡 Média-Baixa | Calculada corretamente, sem delivery proativo |
| **Analytics histórico** | 🟡 Média-Baixa | Pipeline funcional (Firestore), sem BigQuery real |
| **Configurabilidade operacional** | 🟡 Média-Baixa | Thresholds existem, sem UI de configuração |
| **Governança de processo (LSW cadência)** | 🟡 Média-Baixa | `computeHuddleCadence` existe, sem relatório |

### 8.2 Pergunta Central: O BedSight Sustenta Rotina Operacional Real?

**Resposta:** Parcialmente — com qualificação importante.

**O sistema SUSTENTA:**
- Visibilidade do estado do fluxo em tempo real (TV Dashboard)
- Registro estruturado de bloqueadores, alta prevista e especialidades
- Trilha de auditoria completa (quem fez o quê e quando, com correlationId)
- Gestão de pendências com SLA e vencimento automático
- Identificação de escalações críticas em tempo real
- Protocolo de huddle com checklist e top actions

**O sistema AINDA DEPENDE de esforço humano não estruturado para:**
- Registrar status Kamishibai por equipe (sem UI dedicada → fallback para papel)
- Encerrar formalmente cada huddle (sem validação de transição)
- Verificar Mission Control periodicamente (sem push de alertas)
- Garantir que `mainBlockerBlockedAt` seja preenchido (sem obrigatoriedade na UI)
- Sincronizar manualmente dois algoritmos `computeShiftKey`

**Diagnóstico:** O sistema está no estágio de **"ferramenta de apoio à rotina"**. A transição para **"sistema de governança autônoma"** requer: (a) editor Kamishibai para equipes, (b) cache / push de Mission Control, (c) `topBlockerNow` na TV, (d) consolidação de `computeShiftKey`, e (e) notificações proativas de escalação.

---

## 9. Próximos Passos P0 / P1 / P2

### P0 — Crítico (resolve gaps de governança autônoma)

| ID | Ação | Arquivo(s)-alvo | Esforço |
|----|------|----------------|---------|
| P0-01 | **Consolidar `computeShiftKey`**: extrair para pacote compartilhado ou copiar como `shiftKey.shared.ts` + importar nas duas pontas + adicionar teste de convergência | `src/domain/shiftKey.ts`, `functions/src/shared/shiftKey.ts` | 0.5 dia |
| P0-02 | **Cache de Mission Control**: implementar documento `units/{unitId}/snapshots/latest` escrito por trigger ou scheduled function; leitura direta via listener (sem cold-start) | `getAdminMissionControlSnapshot.ts`, novo trigger | 1-2 dias |
| P0-03 | **`topBlockerNow` na TV**: adicionar card ou banner em `TvDashboard.tsx` lendo do snapshot cacheado | `TvDashboard.tsx`, `KanbanScreen.tsx` | 0.5 dia |

### P1 — Alta Prioridade (impacta qualidade da rotina)

| ID | Ação | Arquivo(s)-alvo | Esforço |
|----|------|----------------|---------|
| P1-01 | **Editor Kamishibai**: modal em `BedDetails` com toggle ok/blocked/N/A por domínio + campo razão de bloqueio | `BedDetails.tsx`, novo `KamishibaiDomainEditor.tsx` | 2-3 dias |
| P1-02 | **`mainBlockerBlockedAt` obrigatório**: tornar campo obrigatório ao salvar `mainBlocker` não vazio | `BedDetails.tsx`, `BedsRepository.ts` | 0.5 dia |
| P1-03 | **Semântica de `kanbanMode`**: implementar filtragem/ordenação diferente entre `PASSIVE` e `ACTIVE_LITE` | `KanbanScreen.tsx`, `TvDashboard.tsx` | 1 dia |
| P1-04 | **Filtro de pendências por domínio**: dropdown ou tabs em `BedDetails` para filtrar por especialidade | `BedDetails.tsx` | 0.5 dia |
| P1-05 | **Validação de transição de huddle**: impedir reset de turno sem encerramento formal; banner persistente se OVERDUE > 2h | `HuddleConsole.tsx`, `TvDashboard.tsx` | 1 dia |

### P2 — Médio Prazo (eleva governança)

| ID | Ação | Arquivo(s)-alvo |
|----|------|----------------|
| P2-01 | **Renomear CFs "*BQ"** → sem sufixo (ex: `getAdminKamishibaiStats`) — dívida de nomenclatura | `functions/src/callables/analytics/` |
| P2-02 | **Testes unitários para CFs críticas** — `applyCanonicalBeds`, `softResetUnit`, `setUnitUserRole` | `functions/src/__tests__/` |
| P2-03 | **Relatório de aderência de huddle** — dashboard com histórico de `computeHuddleCadence` por turno | Nova tela admin |
| P2-04 | **Notificações push (FCM)** — alertas proativos para escalações críticas (overdue, bloqueadores) | Nova integração |
| P2-05 | **UI de configuração de thresholds** — formulário em Admin para overrides de `mission_control` | Nova tela admin |
| P2-06 | **Health check de CFs no CI** — smoke test simples após deploy | `.github/workflows/` |

---

## 10. Apêndice: Inventário de Arquivos-Chave

| Arquivo | Linhas | Responsabilidade |
|---------|--------|-----------------|
| `src/domain/types.ts` | ~410 | Schema canônico — fonte de verdade de tipos |
| `src/domain/shiftKey.ts` | ~165 | `computeShiftKey` — frontend |
| `functions/src/shared/shiftKey.ts` | ~50 | `computeShiftKey` — Cloud Functions (duplicado) |
| `src/domain/kamishibaiVisualState.ts` | ~140 | `resolveKamishibaiVisualState` — estado derivado |
| `src/domain/escalation.ts` | ~100 | `computeEscalations` — SSoT |
| `src/domain/pendencies.ts` | ~109 | `computePendencyCounts`, badge format |
| `src/domain/missionControl.ts` | ~120 | Thresholds, `parseMissionControlThresholds` |
| `src/domain/lswCadence.ts` | ~80 | `computeHuddleCadence` |
| `src/features/tv/pages/TvDashboard.tsx` | 324 | Gestão à vista — orquestrador TV |
| `src/features/editor/pages/BedDetails.tsx` | ~250 | Editor mobile principal |
| `src/features/admin/screens/MissionControlScreen.tsx` | 56 | Orquestrador admin |
| `src/features/admin/components/analytics/MissionControlTab.tsx` | ~150 | Renderização KPIs |
| `src/features/admin/components/ops/HuddleConsole.tsx` | ~250 | Console Huddle/LSW |
| `functions/src/callables/analytics/getAdminMissionControlSnapshot.ts` | 312 | `buildSnapshot` pura + função callable |
| `functions/src/callables/applyCanonicalBeds.ts` | ~105 | Reset para lista canônica (com chunking) |
| `functions/src/callables/softResetUnit.ts` | ~80 | Reset suave de unidade (com chunking) |
| `functions/src/lib/firestoreBatch.ts` | ~30 | `chunkAndCommitBatch` helper |
| `src/repositories/BedsRepository.ts` | ~220 | Interface Firestore para leitos |
| `firestore.rules` | 115 | RBAC document-level |
| `firestore.indexes.json` | 147 | 9 índices compostos para `audit_logs` |
| `escalation-defaults.json` | 6 | SSoT de thresholds padrão |
| `.github/workflows/ci.yml` | ~39 | CI: lint + typecheck + tests |
| `.github/workflows/deploy-firebase.yml` | ~55 | Deploy: hosting + functions |

---

*Auditoria gerada automaticamente via análise estática de código + Genba digital em 2026-03-06.*
*Próxima revisão recomendada: após implementação do P0 (estimativa: 2026-03-13).*
