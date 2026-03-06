# AUDIT — Lean Alignment (Gap Analysis Completo)

**Data:** 2026-02-28 | **Auditor:** Agente Antigravity | **Missão:** somente leitura

---

## 1. Tabela mestre de features

| Feature | Rota / Path | Componente principal | Dados consumidos | Quem escreve |
| --------- | ------------- | ---------------------- | ----------------- | -------------- |
| TV Kanban | `/tv?unit={unitId}` → slide kanban | `KanbanScreen` | `units/{unitId}/beds` (realtime) | Editor via `BedsRepository.updateBed()` |
| TV Kamishibai | `/tv?unit={unitId}` → slide kamishibai | `KamishibaiScreen` | `units/{unitId}/beds` (realtime) | Editor via `BedsRepository.updateBed()` |
| TV Summary | `/tv?unit={unitId}` → slide summary | `SummaryScreen` | `beds[]` (calc client-side) | Derivado |
| Editor (mobile) | `/editor?unit={unitId}` | `MobileDashboard` → `BedDetails` | `beds`, `units`, `settings/ops` | Usuário direto |
| Admin Kanban Mode | `/admin/unit/{unitId}` → aba Ops | `OpsScreen` | `settings/ops.kanbanMode` | Admin via `UnitSettingsRepository.setUnitKanbanMode()` |
| Admin Mission Control | `/admin/unit/{unitId}` → Analytics → tab MC | `MissionControlTab` | CF `getAdminMissionControlSnapshot` | Read-only |
| Admin Analytics | `/admin/unit/{unitId}` → Analytics → tab Exploração | `AnalyticsScreen` | CFs BQ (*BQ sufixo) | Read-only |
| Admin Settings TV | `/admin/unit/{unitId}` → aba TV | `TvSettingsScreen` | `settings/board` | Admin via `updateBoardSettings` CF |
| Admin Audit | `/admin/unit/{unitId}` → aba Audit | `AuditScreen` | `audit_logs` (realtime) | Trigger backend `auditBedWrites` |
| Admin Beds | `/admin/unit/{unitId}` → aba Beds | `BedsAdminScreen` | `beds` | Admin via CFs `applyCanonicalBeds`, `resetBedAll` |
| Admin Users | `/admin/unit/{unitId}` → aba Users | `UsersAdminScreen` | `units/{unitId}/users` | Admin via CFs `setUnitUserRole`, `removeUnitUser` |

---

## 2. Flags e modos — inventário completo

### Flag 1: `kanbanMode` (KanbanMode)

| Atributo | Valor |
| ---------- | ------- |
| **Campo** | `kanbanMode` |
| **Tipo** | `'PASSIVE' \| 'ACTIVE_LITE'` |
| **Path Firestore** | `units/{unitId}/settings/ops` (doc `ops`) |
| **Fallback** | `'PASSIVE'` (se doc não existe) |
| **Quem lê (TS)** | `TvDashboard.tsx`, `UnitSettingsRepository.ts`, `OpsScreen.tsx` |
| **Quem escreve** | `UnitSettingsRepository.setUnitKanbanMode()` via `OpsScreen` (admin only) |
| **Efeito na UI** | Texto informativo "Modo: PASSIVE/ACTIVE_LITE" no header da TV e no Editor |
| **Efeito no backend** | **Nenhum** — não bloqueia escrita, não muda lógica |
| **Evidência** | `OpsScreen.tsx:70-86`, `TvDashboard.tsx:153-157` |

### Flag 2: `rotationEnabled` (boolean)

| Atributo | Valor |
| ---------- | ------- |
| **Campo** | `rotationEnabled` |
| **Path Firestore** | `units/{unitId}/settings/board` |
| **Fallback** | `true` |
| **Quem lê** | `TvRotationContainer.tsx` |
| **Efeito** | `false` = pausa rotação na tela atual |

### Flag 3: `screens[].enabled` (boolean por screen)

| Atributo | Valor |
| ---------- | ------- |
| **Campo** | `screens[{key}].enabled` |
| **Path Firestore** | `units/{unitId}/settings/board.screens[]` |
| **Keys possíveis** | `'kanban'`, `'kamishibai'`, `'summary'` |
| **Efeito** | `false` = remove a tela da rotação completamente |

> **Não existe:** flag de `kamishibaiEnabled`, `kanbanPassiveMode` separado, ou `featureFlags` global. Tudo está nos BoardSettings ou `UnitOpsSettings`.

---

## 3. Cloud Functions — inventário completo

| Função | Tipo | Auth necessária | Audita? |
| -------- | ------ | ----------------- | --------- |
| `updateBoardSettings` | HTTPS Callable | unit admin | Sim (via `auditBedWrites` indiretamente? A confirmar) |
| `applyCanonicalBeds` | HTTPS Callable | global admin | Sim |
| `resetBedKanban` | HTTPS Callable | unit admin | Sim |
| `resetBedKamishibai` | HTTPS Callable | unit admin | Sim |
| `resetBedAll` | HTTPS Callable | unit admin | Sim |
| `setUnitUserRole` | HTTPS Callable | unit admin | Sim |
| `removeUnitUser` | HTTPS Callable | unit admin | Sim |
| `softResetUnit` | HTTPS Callable | unit admin | Sim |
| `setGlobalAdminClaim` | HTTPS Callable | global admin | — |
| `auditBedWrites` | Firestore Trigger | (automático) | É o próprio auditor |
| `getAdminOverviewBQ` | HTTPS Callable | autenticado | Não |
| `getAdminFlowMetricsBQ` | HTTPS Callable | autenticado | Não |
| `getAdminKamishibaiStatsBQ` | HTTPS Callable | autenticado | Não |
| `getAdminTopBlockersBQ` | HTTPS Callable | autenticado | Não |
| `getAdminFreshnessBQ` | HTTPS Callable | autenticado | Não |
| `getAdminTrendComparisonBQ` | HTTPS Callable | autenticado | Não |
| `getAdminMissionControlSnapshot` | HTTPS Callable | autenticado | Não |
| `getAdminMissionControlPeriod` | HTTPS Callable | autenticado | Não |

---

## 4. Cobertura de testes E2E

| Feature | Arquivo de teste | Cenários cobertos |
| --------- | ----------------- | ------------------- |
| Kanban Mode (PASSIVE/ACTIVE_LITE) | `kanban-mode.spec.ts` | Toggle desktop, sync real-time Editor+TV, toggle mobile, flash message memory leak |
| TV Settings (rotação, duração) | `tv-settings.spec.ts`, `tv-settings-realtime.spec.ts` | Mudar duração, habilitar/desabilitar tela, sync real-time |
| Admin Home | `admin-home.spec.ts` | Navegação entre abas |
| Kanban sync (editor→TV) | `kanban-sync.spec.ts` | Escrita do editor aparece na TV |
| Analytics overview | `analytics.spec.ts` | Carregamento da tela de analytics |
| Audit logs | `audit-completeness.spec.ts`, `audit-callable-flow.spec.ts`, `audit-immutability.spec.ts`, `audit-log-generation.spec.ts` | Criação de logs, imutabilidade, completude |
| Beds admin | `beds-admin.spec.ts` | Criação/edição de leitos |
| Users | `user-addition.spec.ts`, `users-role-change.spec.ts` | Adição/remoção de usuários, troca de papel |
| RBAC viewer | `viewer-rbac.spec.ts` | Bloqueio de escrita para viewer |
| Mobile navigation | `mobile-navigation.spec.ts` | Navegação mobile |
| Ops advanced | `ops-advanced.spec.ts` | Operações destrutivas (soft reset, etc.) |

**Cobertura por feature:**

| Feature Lean | Coberto por teste? | Gap |
| ------------- | ------------------- | ----- |
| Kamishibai toggle (ok/blocked/na) | ❌ Não | Sem teste de escrita de kamishibai via editor |
| Kamishibai renderização na TV | ❌ Não | Sem teste visual de dots |
| Mission Control KPIs | ❌ Não | Sem teste de thresholds de alerta |
| Analytics Exploração (BQ) | Parcial (apenas carregamento) | Sem teste de dados reais |
| Audit de kamishibai | Parcial | `audit-completeness.spec.ts` cobre bed writes em geral |
| TV Rotation | ✅ `tv-settings-realtime.spec.ts` | Coberto (rotação e duração) |
| KanbanMode sync | ✅ `kanban-mode.spec.ts` | Bem coberto (desktop + mobile + real-time) |

---

## 5. Seeds do emulador — o que é populado

**Arquivo:** `scripts/seed-data.ts`

| Dado | Seeded | Detalhes |
| ------ | -------- | --------- |
| Auth users | ✅ | 6 usuários (admin, editor, viewer, doctor, nurse, clarinha) |
| `authorized_users` | ✅ | Todos os 6 |
| `units/A` | ✅ | Unidade A, 36 leitos, 6 especialidades |
| `units/A/users` | ✅ | Todos os 6 vinculados |
| `units/A/settings/board` | ✅ | Rotação habilitada, 3 telas |
| `units/A/beds/{bed_*}` | ✅ | 36 leitos com kamishibai, blockers randomizados, freshness variada |
| `units/A/settings/ops` | ❌ | **NÃO seedo** — KanbanMode não é populado pelo seed |
| `units/A/audit_logs` | ❌ | Não seedad — gerado em runtime pelo trigger |

---

## 6. Respostas às 6 perguntas de conclusão da auditoria

### 1. Quais estados/cor existem hoje e onde são definidos?

**Kamishibai:** `'ok'` (verde) | `'blocked'` (vermelho) | `'na'` (cinza) — definido em `src/domain/types.ts:12`
**Kanban previsão de alta:** `'24h'`=verde | `'2-3_days'`=amarelo | `'>3_days'`=vermelho | `'later'`=sem cor — definido em `KanbanScreen.tsx:11-18`
**Não existe** estado "sem cor / inativo" explícito para Kamishibai — `'na'` é usado tanto para "especialidade não aplicável" quanto para "leito sem paciente".

### 2. Como o Kamishibai é ligado/desligado hoje?

Via `BoardSettings.screens[{key:'kamishibai'}].enabled = false` (oculta slide da TV). **Não há flag de "kamishibai desabilitado" que impeça gravação de dados.** Os dados kamishibai existem nos leitos independentemente.

### 3. Como Mission Control depende desses estados?

Mission Control usa **somente** `kamishibai.*.status === 'blocked'` para contar `kamishibaiImpedimentBedsCount`. Ignora `'ok'` e `'na'` completamente.

### 4. Quais métricas existem hoje e como são calculadas?

Ver `AUDIT_Analytics_Freshness_Aging_2026-02-28.md` — Tabela 1. Resumo: 9 métricas live (Firestore) + 6 métricas históricas (BigQuery, atualmente com falha 500).

### 5. Onde as regras/thresholds estão codificadas?

**100% hardcoded no frontend** em `MissionControlTab.tsx:16-91`. Sem configuração Firestore, sem env vars. Thresholds: bloqueados (20%/35%), freshness (1/3/5 leitos por tier).

### 6. Quais mudanças futuras são "alto risco" (muito acoplamento)?

| Mudança pretendida | Risco | Componentes acoplados |
| -------------------- | ------- | ----------------------- |
| Adicionar estado "sem cor / inativo" no Kamishibai | ALTO | `types.ts`, `KamishibaiScreen.tsx`, `getAdminMissionControlSnapshot.ts`, `AnalyticsListScreen.tsx`, `seed-data.ts`, todos os testes |
| Mudar `KamishibaiStatus` para binário (`verde/vermelho`) + ausente | ALTO | Mesmo conjunto acima + `resetBedKamishibai.ts` |
| Adicionar `blockedAt` dedicado | MÉDIO | `BedsRepository.updateBed()`, `getAdminMissionControlSnapshot.ts`, `AnalyticsListScreen.tsx` |
| Fazer `kanbanMode` ACTIVE_LITE enforçar regras no backend | ALTO | Todas as Cloud Functions de escrita de bed, Firestore rules, OpsScreen |
| Adicionar `reviewedAt` por domínio kamishibai | MÉDIO-ALTO | `types.ts`, `BedsRepository`, `KamishibaiScreen.tsx`, `getAdminMissionControlSnapshot.ts` |
| Migrar Analytics BQ para funcionar | MÉDIO | 6 Cloud Functions, BigQuery schema, pipeline export |

---

## 7. GAP LIST completo — Lean do hospital vs sistema atual

### 7.1 Kamishibai Lean

| # | Lean exige | Sistema atual | Gap |
| --- | ----------- | --------------- | ----- |
| K1 | Binário: verde (OK) / vermelho (bloqueado) / **sem cor** (inativo/vazio) | 3 estados: ok/blocked/na — `na` = ambíguo | Estado "leito vazio" = `na` mas deveria ser ausência visual |
| K2 | Verde = "revisado e OK neste turno" | Verde (`ok`) persiste de turnos anteriores sem TTL | Verde pode estar "estragado" |
| K3 | Revisão obrigatória em cadência (Huddle AM/PM) | Nenhum campo `reviewedAt`, `lastHuddleAt` ou `reviewedThisShift` | Impossível saber quando foi revisado |
| K4 | Escalonamento: vermelho + responsável + próxima ação | `blocked` sem responsável específico ou plano de ação | Apenas texto livre em `mainBlocker` |

### 7.2 Kanban / Alta

| # | Lean exige | Sistema atual | Gap |
| --- | ----------- | --------------- | ----- |
| K5 | Política local de alta (critérios específicos da unidade) | Apenas enum de tempo: 24h/2-3d/>3d/later | Sem campo "critérios de alta pendentes" |
| K6 | Pendências de alta que sobrevivem ao dia | Nenhuma estrutura de pendências (`tasks`, `checklist`) | Pendências só existem em `mainBlocker` (campo livre) |
| K7 | Tracking de "alta realizada" | Nenhum campo `dischargeConfirmedAt` | Alta = leito esvazia (`patientAlias = ''`), sem evento registrado |

### 7.3 Huddle / Rituais

| # | Lean exige | Sistema atual | Gap |
| --- | ----------- | --------------- | ----- |
| H1 | Registro de "revisão AM/PM" | ❌ Ausente completamente | Maior gap — sem suporte a cadência |
| H2 | Checklists diários por leito | ❌ Ausente | — |
| H3 | Pendências que sobrevivem ao dia | ❌ Ausente | `mainBlocker` reseta ao editar |
| H4 | Escalonamento com responsável | ❌ Ausente | — |
| H5 | Diferenciação de dados por turno na TV | ❌ Ausente | TV mostra estado atual sem contexto de turno |

### 7.4 Mission Control / Analytics

| # | Lean exige | Sistema atual | Gap |
| --- | ----------- | --------------- | ----- |
| M1 | KPI de Aging de bloqueador preciso | Usa `updatedAt` como proxy | Aging impreciso |
| M2 | Diferenciação turno A vs B em analytics | ❌ Ausente | — |
| M3 | Throughput histórico funcional | BigQuery com 500 | Indisponível |
| M4 | Thresholds configuráveis por unidade | Hardcoded no frontend | — |
