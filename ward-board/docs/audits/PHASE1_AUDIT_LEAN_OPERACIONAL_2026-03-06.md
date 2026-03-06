# BedSight Flow — Auditoria Fase 1: Diagnóstico Lean-Operacional

**Data:** 2026-03-06
**Auditor:** Agente Claude (Fase 1 — somente leitura + análise)
**Metodologia:** Genba Digital + VSM + Gap Analysis + Discovery Técnico
**Escopo:** Codebase completa `ward-board/` — commit `47f4b43`

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Stack e Arquitetura](#2-stack-e-arquitetura)
3. [Mapeamento do Fluxo de Valor Atual (VSM)](#3-mapeamento-do-fluxo-de-valor-atual-vsm)
4. [Achados por Função / Perspectiva](#4-achados-por-função--perspectiva)
   - 4.1 [TV Dashboard (Gestão à Vista)](#41-tv-dashboard-gestão-à-vista)
   - 4.2 [Editor Mobile (Entrada de Dados)](#42-editor-mobile-entrada-de-dados)
   - 4.3 [Admin / Mission Control](#43-admin--mission-control)
   - 4.4 [Kamishibai (Cadência Multiprofissional)](#44-kamishibai-cadência-multiprofissional)
   - 4.5 [Pendências](#45-pendências)
   - 4.6 [Kanban](#46-kanban)
   - 4.7 [Huddle / LSW Console](#47-huddle--lsw-console)
   - 4.8 [Analytics e Dados](#48-analytics-e-dados)
   - 4.9 [RBAC e Segurança](#49-rbac-e-segurança)
   - 4.10 [Educação (EduCenter)](#410-educação-educenter)
5. [Gargalos Priorizados (Pareto Lean)](#5-gargalos-priorizados-pareto-lean)
6. [Lacunas de Produto](#6-lacunas-de-produto)
7. [Lacunas Técnicas](#7-lacunas-técnicas)
8. [Avaliação do Sistema como Governança de Fluxo](#8-avaliação-do-sistema-como-governança-de-fluxo)
9. [Próximos Passos P0 / P1 / P2](#9-próximos-passos-p0--p1--p2)

---

## 1. Resumo Executivo

### Veredito: BedSight está em transição crítica — infraestrutura sólida, rotina operacional ainda frágil

O BedSight Flow tem uma fundação técnica bem construída: modelo de domínio rico, RBAC funcional, auditoria append-only, Kamishibai com TTL de turno, gestão de pendências v1 e um Mission Control com KPIs configuráveis. O sistema **não é mais um MVP**; passou por uma iteração significativa (v1) entre fevereiro e março de 2026 que implementou a maioria das estruturas Lean fundamentais.

No entanto, a análise do código revela que o sistema **ainda depende de esforço humano não estruturado** para sustentar a rotina operacional real. Os principais pontos de dependência humana residuais são:

| Ponto de Dependência Humana | Risco |
| --- | --- |
| Huddle sem verificação de conclusão automática na TV | Alto — TV não distingue huddle "iniciado" de "concluído" |
| Mission Control atualizado apenas por refresh manual | Alto — dados de KPI ficam desatualizados durante plantão |
| Analytics histórico (Pipeline BigQuery) inoperante | Alto — tomada de decisão gerencial cega para tendências |
| Kamishibai exige entrada ativa por turno de CADA domínio | Médio — dependência de 6 equipes independentes por leito |
| `kanbanMode: ACTIVE_LITE` não tem efeito operacional real | Médio — flag sem semântica de processo implementada |
| Sem notificações push para alertas de escalação | Médio — profissional precisa abrir o sistema para ver alertas |
| Freshness calculada por `updatedAt` do leito (não por revisão) | Médio — falso-verde ao editar qualquer campo do leito |

**Conclusão de uma linha:** O BedSight sustenta *visualização* operacional em tempo real, mas ainda não sustenta *governança* de fluxo autônoma — a cadência de ritos Lean depende de disciplina externa ao sistema.

---

## 2. Stack e Arquitetura

### 2.1 Tecnologias

| Camada | Tecnologia | Versão |
| -------- | ----------- | -------- |
| Frontend | React + TypeScript | 19.x / ~5.9 |
| Build | Vite | 7.x |
| Backend / DB | Firebase Firestore | ^12.9 |
| Auth | Firebase Auth | Custom Claims (RBAC) |
| Cloud Functions | Firebase Functions v1 | `southamerica-east1` |
| Analytics histórico | Firestore `audit_logs` (funções com sufixo "BQ") | — |
| Mobile packaging | Capacitor (Android) | ^8.1 |
| Charts | Recharts | ^3.7 |
| Testes unitários | Vitest | ^4.0 |
| Testes E2E | Playwright | ^1.58 |
| Styling | CSS custom (design tokens, `--state-*`, `--bg-*`) | — |

> **Nota:** As funções sufixadas "BQ" (`getAdminFlowMetricsBQ`, etc.) consultam Firestore `audit_logs`, **não** BigQuery real. O nome é enganoso e constitui uma lacuna de documentação técnica.

### 2.2 Modelo de dados (Firestore)

```text
/units/{unitId}
  /beds/{bedId}             ← Documento principal por leito
  /settings/board           ← Configuração TV (rotação, telas, duração)
  /settings/ops             ← Configuração operacional (turno, kamishibai, huddle)
  /settings/mission_control ← Thresholds de KPIs (override dos defaults)
  /audit_logs/{logId}       ← Append-only, gerado por trigger Firestore
  /huddles/{shiftKey}       ← Documento de huddle por turno

/users/{uid}/authz/authz    ← Autorização RBAC por unidade
/authorized_users/{userId}  ← Whitelist global de acesso
```

**Modelo `Bed` (campos relevantes para fluxo):**

- `patientAlias` — identificação do paciente (vazio = leito vazio)
- `expectedDischarge` — `'24h' | '2-3_days' | '>3_days' | 'later'`
- `mainBlocker` — texto livre do bloqueador principal (Kanban KPI1)
- `mainBlockerBlockedAt` — timestamp do início do bloqueio (aging)
- `involvedSpecialties[]` — especialidades envolvidas
- `kamishibai: Record<SpecialtyKey, KamishibaiEntry>` — status por domínio
- `applicableDomains[]` — domínios aplicáveis (v1, ausente = todos)
- `pendencies[]` — pendências operacionais persistentes (v1)

### 2.3 Arquitetura de fluxo de dados

```text
[Editor Mobile]
     │  updateBed() → Firestore
     ↓
[Firestore Realtime]
     ├──→ [TV Dashboard] (onSnapshot)
     ├──→ [Admin/MissionControl] (Cloud Function on-demand)
     └──→ [auditBedWrites trigger] → /audit_logs

[Admin OPS] → HuddleRepository → /huddles/{shiftKey}
           → UnitSettingsRepository → /settings/ops.lastHuddleShiftKey

[Analytics CFs] → audit_logs query → retorna métricas históricas
```

### 2.4 Rotas e superfícies

| Rota | Usuário-alvo | Dispositivo |
| ------ | ------------- | ------------- |
| `/editor` | Enfermeiro/equipe assistencial | Mobile (smartphone) |
| `/tv` | Toda equipe de unidade | TV/monitor kiosk |
| `/admin` | Coordenador/gerente | Desktop |
| `/mobile-admin` | Coordenador | Mobile (smartphone) |

---

## 3. Mapeamento do Fluxo de Valor Atual (VSM)

### 3.1 Fluxo de turno ideal (Lean HRHDS)

```text
INÍCIO DE TURNO (07:00 / 19:00)
    │
    ├─[1] Passagem de plantão + revisão do turno anterior
    │      ↓ Sistema deveria: exibir resumo do turno anterior automático
    │      ↓ Sistema faz: banner "Huddle Pendente" na TV
    │
    ├─[2] Abertura do Huddle (coordenador)
    │      ↓ Sistema faz: HuddleConsole em /admin → OPS → "Iniciar Huddle"
    │      ↓ Captura: startSummary (snapshot Mission Control no início)
    │
    ├─[3] Revisão Kanban (altas iminentes, bloqueadores)
    │      ↓ Sistema faz: TV Kanban screen, Mission Control KPI1/KPI4
    │      ↓ Gap: KPI1 requer refresh manual para atualizar
    │
    ├─[4] Revisão Kamishibai (status multiprofissional por leito)
    │      ↓ Sistema faz: TV Kamishibai, dots de UNREVIEWED_THIS_SHIFT
    │      ↓ Gap: requer entrada ativa de 6 equipes independentes
    │
    ├─[5] Definição de Top 3 ações do turno
    │      ↓ Sistema faz: HuddleConsole → topActions (max 3)
    │
    ├─[6] Registro formal de encerramento do Huddle
    │      ↓ Sistema faz: "Encerrar Huddle" → captura endSummary
    │      ↓ CRÍTICO: apenas "Encerrar" atualiza lastHuddleShiftKey
    │
    └─[7] Execução do turno
           │
           ├─ Editor atualiza leitos em tempo real → TV reflete imediatamente ✓
           ├─ Pendências criadas/concluídas durante turno ✓
           ├─ Escalonamentos críticos identificados (sem notificação push) △
           └─ Mission Control precisa de refresh manual para ver KPIs atualizados △

FIM DE TURNO
    └─ Próximo turno revisa: AM revisa PM anterior / PM revisa AM atual ✓
```

### 3.2 Fluxo atual real (observado no código)

| Passo | O que o sistema oferece | Dependência humana residual |
| ------- | ------------------------ | ---------------------------- |
| 1. Início de turno | Banner "Huddle Pendente" na TV | Alguém precisa VER a TV |
| 2. Abrir huddle | Console em /admin/ops | Admin precisa navegar ativamente |
| 3. Revisar Kanban | TV Kanban (tempo real) + MC (manual) | Refresh manual do MC |
| 4. Revisar Kamishibai | TV Kamishibai (dots por turno) | 6 equipes inserindo dados |
| 5. Top 3 ações | HuddleConsole.topActions | Admin digita manualmente |
| 6. Encerrar huddle | Botão "Encerrar" → endSummary | Encerramento formal obrigatório para atualizar cadência |
| 7. Escalonamentos | MC mostra 🔥 críticos | Sem push — precisa abrir sistema |

### 3.3 Muda (desperdícios) identificados

| Tipo Muda | Manifestação | Impacto |
| ----------- | ------------- | --------- |
| **Espera** | MC exige refresh manual — dados desatualizados | Decisão baseada em snapshot antigo |
| **Superprodução** | 6 domínios kamishibai por leito mesmo para leitos simples | Esforço de entrada sem valor agregado |
| **Defeito** | Analytics histórico inoperante (500 errors) | Gestão sem visibilidade histórica |
| **Movimento** | Coordenador navega /admin → Analytics → MC → refresh | Cliques excessivos para chegar ao KPI |
| **Processamento excessivo** | `kanbanMode: ACTIVE_LITE` sem efeito real | Configuração sem semântica executável |
| **Subprocessamento** | Freshness via `updatedAt` do leito inteiro | Falso-verde — qualquer edit reinicia contador |
| **Inventário** | Logs de audit em Firestore sem índices compostos configurados | Filtros falham com FAILED_PRECONDITION |

---

## 4. Achados por Função / Perspectiva

### 4.1 TV Dashboard (Gestão à Vista)

**Avaliação geral: ✅ Funcional, com gaps de completude**

**O que funciona bem:**

- Rotação automática entre 3 telas (Kanban, Kamishibai, Summary) com durações configuráveis
- Dados em tempo real via `onSnapshot` com reconexão automática em caso de erro
- Banner "Huddle Pendente" baseado em `lastHuddleShiftKey` vs `currentShiftKey()`
- Indicador de escalações 🔥 via `computeEscalations()` (mesma lógica da Cloud Function — SSoT)
- Pendências por leito com badges de overdue no Kanban e Kamishibai
- Relógio atualizado a cada 30s (não a cada render)
- Suporte a dark/light mode via ThemeContext

**Gaps identificados:**

- `G-TV-01`: Huddle banner mostra "pendente" mesmo quando huddle foi *iniciado* mas não *encerrado* formalmente. O indicador correto deveria ser "Huddle em andamento" vs "Huddle não iniciado".
- `G-TV-02`: Screen `summary` exibe métricas estáticas calculadas client-side, sem KPIs de comparação com turno anterior.
- `G-TV-03`: Kamishibai na TV não exibe nota de bloqueio (`KamishibaiEntry.reason`) — operadores na TV não sabem *por que* está bloqueado.
- `G-TV-04`: Sem indicador de quantos leitos foram revisados vs total no turno atual (progresso do Kamishibai).
- `G-TV-05`: `escalationsDisplay` na TV usa `DEFAULT_ESCALATION_THRESHOLDS` sem ler os thresholds customizados de Firestore (`settings/mission_control`). Risco de divergência entre TV e Mission Control.

### 4.2 Editor Mobile (Entrada de Dados)

**Avaliação geral: ⚠️ Funcional mas com UX crítica para adoção**

**O que funciona bem:**

- Edição por leito com campos: alias, bloqueador, previsão de alta, especialidades
- Kamishibai por domínio com TTL de turno (shiftKey gravado em `reviewedShiftKey`)
- Pendências v1: criação, conclusão, cancelamento com trilha de auditoria
- Filtros na MobileDashboard: bloqueados, kamishibai=blocked, stale12h, stale24h
- Proteção de permissão: apenas editors/admins escrevem
- Loading skeleton para UX fluida

**Gaps identificados:**

- `G-ED-01`: Filtro `stale` na MobileDashboard usa `bed.updatedAt` (leito inteiro) para calcular staleness, **diferente do Mission Control** que usa `kamishibai[domain].reviewedAt`. Inconsistência que cria falsos-negativos (leito parece revisado, mas kamishibai não foi).
- `G-ED-02`: Campo `mainBlocker` é texto livre sem sugestões de categorias. Dificulta análise de top blockers e aumenta fragmentação do dado (mesma causa escrita de 5 formas diferentes).
- `G-ED-03`: `applicableDomains` não tem UI de edição no editor mobile — profissional não consegue marcar "N/A" para domínio não aplicável ao caso.
- `G-ED-04`: Sem feedback visual de "quantos domínios kamishibai ainda faltam revisar neste turno" no nível da MobileDashboard.
- `G-ED-05`: Pendências não têm campo `note` editável pela UI mobile (existe no schema, não exposto no form).
- `G-ED-06`: Ao criar pendência, o campo `domain` é `SpecialtyKey | ''` — se vazio, `domain` fica `undefined`. Válido pelo contrato, mas impede filtros de "pendências da minha equipe".

### 4.3 Admin / Mission Control

**Avaliação geral: ⚠️ Bem estruturado, operacionalmente incompleto**

**O que funciona bem:**

- KPIs com semáforos: bloqueados%, kamishibai impedimentos%, freshness (12h/24h/48h), unreviewed no turno, escalações 🔥, altas próximas
- Thresholds configuráveis por unidade em Firestore (`settings/mission_control`)
- Drill-down de leitos para cada KPI (lista filtrada)
- `topBlockerNow` calculado no snapshot (não exibido na UI do Mission Control Tab — apenas retornado pelo snapshot)
- Snapshot captura `warnings[]` de qualidade de dados (proxy usado quando `mainBlockerBlockedAt` ausente)

**Gaps identificados:**

- `G-MC-01`: **Mission Control é on-demand** — requer refresh manual. Não há polling automático, websocket ou agendamento. Dados podem estar até horas desatualizados.
- `G-MC-02`: `topBlockerNow` é calculado na Cloud Function mas **não renderizado** no MissionControlTab. Dado valioso ignorado na UI.
- `G-MC-03`: Sem histórico temporal do Mission Control — não é possível comparar o estado atual com o turno anterior ou semana anterior.
- `G-MC-04`: Freshness (KPI2) usa `bed.updatedAt` no snapshot, **não** `kamishibai[domain].reviewedAt`. Inconsistência documentada nas audits anteriores mas não corrigida.
- `G-MC-05`: Configuração dos thresholds (`settings/mission_control`) não tem UI — mudanças exigem edição manual no Firestore console.
- `G-MC-06`: Admin desktop não tem rota `/admin/mission-control` dedicada — está enterrado em `/admin/unit/{unitId}` → Analytics → tab. Acesso cognitivo alto.

### 4.4 Kamishibai (Cadência Multiprofissional)

**Avaliação geral: ✅ Modelo sólido, adoção dependente de disciplina**

**O que funciona bem:**

- Máquina de estados visual rica: `INACTIVE | NOT_APPLICABLE | UNREVIEWED_THIS_SHIFT | OK | BLOCKED`
- TTL de turno: `reviewedShiftKey` comparado com `currentShiftKey()` — lógica SSoT compartilhada entre TV e Editor
- `applicableDomains[]` permite marcar domínios como N/A por paciente
- `blockedAt` / `resolvedAt` para aging de bloqueios de kamishibai
- Compatibilidade v0/v1: `LegacyKamishibaiStatus` aceita 'na' na leitura
- Testes unitários cobrindo estados visuais

**Gaps identificados:**

- `G-KM-01`: Migração v0→v1 incompleta — documentos legados com `status: 'na'` ainda existem em produção. Esses docs não têm `reviewedShiftKey`, sendo tratados como `UNREVIEWED_THIS_SHIFT` (correto por contrato, mas cria "ruído amarelo" na TV para leitos que foram marcados como N/A no sistema anterior).
- `G-KM-02`: `applicableDomains` não tem fluxo de edição no Editor Mobile. Operador tem que acessar Admin → Beds → editar manualmente.
- `G-KM-03`: Na TV, dot `BLOCKED` mostra apenas cor vermelha, sem razão. `KamishibaiEntry.reason` existe no schema mas não é exibida.
- `G-KM-04`: Sem relatório de "aderência kamishibai por domínio ao longo do tempo" — impossível saber qual equipe sistematicamente não revisa.
- `G-KM-05`: `KAMISHIBAI_DOMAINS` é hardcoded em `specialtyUtils.ts` como 6 domínios. Unidades com configuração diferente (ex: sem psicologia) precisam modificar código.

### 4.5 Pendências

**Avaliação geral: ✅ Modelo v1 robusto, UI básica**

**O que funciona bem:**

- Schema rico: `status (open/done/canceled)`, `dueAt`, `domain`, `createdBy`, `doneBy`, `canceledBy` — trilha completa
- `canceled` preserva evidência (não é delete) — RBAC: apenas admin pode deletar fisicamente
- `computePendencyCounts()` e `computeUnitPendencyCounts()` como SSoT para contagens
- Badge na TV (Kanban e Kamishibai) com indicador de overdue `⚠`
- Summary screen exibe pendências abertas e vencidas

**Gaps identificados:**

- `G-PD-01`: UI de pendências no Editor Mobile é básica — sem visualização de histórico de pendências concluídas por default (toggle `showDonePendencies`).
- `G-PD-02`: Pendências não têm campo `note` editável na criação via Editor Mobile (existe no schema).
- `G-PD-03`: Sem agregação "pendências por domínio" no Mission Control — impossível saber qual equipe acumula mais pendências abertas.
- `G-PD-04`: Sem SLA automático ou sugestão de prazo baseado no tipo de pendência — prazo é 100% manual.
- `G-PD-05`: Pendências de turnos anteriores são visíveis ao editor (comportamento correto), mas sem indicação visual de "criada há X turnos" para priorização.

### 4.6 Kanban

**Avaliação geral: ⚠️ Visualização boa, semântica de processo ausente**

**O que funciona bem:**

- TV Kanban exibe: leito, alias, especialidades, previsão de alta (color-coded), bloqueador principal, badge pendências
- Ordenação por número de leito (natural sort)
- Suporte a múltiplas colunas (`kanbanColumnsPerPage`)
- `mainBlockerBlockedAt` para aging do bloqueador

**Gaps identificados:**

- `G-KN-01`: `kanbanMode: 'ACTIVE_LITE'` é configurável na UI mas **não tem efeito no comportamento do sistema** — é informativo. A diferença entre PASSIVE e ACTIVE_LITE não está implementada operacionalmente.
- `G-KN-02`: `topBlockerNow` calculado no snapshot mas não exibido no Kanban TV — oportunidade perdida de destacar o bloqueador predominante.
- `G-KN-03`: `mainBlocker` é texto livre sem taxonomia — impossível agregar causas sistematicamente sem normalização.
- `G-KN-04`: Sem visualização de aging do bloqueador na TV Kanban — leito com bloqueador de 48h parece igual a leito com bloqueador de 1h.
- `G-KN-05`: Ausência de coluna/filtro "leitos vagos" no Kanban TV — sem visibilidade de disponibilidade operacional.

### 4.7 Huddle / LSW Console

**Avaliação geral: ⚠️ Estrutura sólida, adoção crítica**

**O que funciona bem:**

- `HuddleDoc` schema: `startedAt`, `endedAt`, `ledBy`, `recordedBy`, `checklist[8 itens]`, `topActions[max 3]`
- Checklist LSW padronizado: 8 passos canônicos (review_previous_shift, review_kanban_24h, review_kamishibai_blocked, review_overdue_pendencies, etc.)
- `startSummary` + `endSummary` capturam snapshot Mission Control no início e fim do huddle
- `computeHuddleCadence()` implementa `OK | DUE | OVERDUE` com grace period configurável
- `getReviewOfShiftKey()` implementa lógica AM-revisa-PM-anterior / PM-revisa-AM-atual
- `HuddleRepository.listenToHuddle()` usa shiftKey como ID — 1 huddle por turno por design

**Gaps identificados:**

- `G-HL-01`: **Huddleonly completa o ciclo LSW quando formalmente encerrado.** Huddles "iniciados mas não encerrados" deixam `lastHuddleShiftKey` desatualizado — TV continua mostrando "Huddle Pendente". Profissionais que esquecem de clicar "Encerrar" corrompem o indicador de cadência.
- `G-HL-02`: `HuddleConsole` está somente no Admin OPS (`/admin/unit/{unitId}` → aba Ops). No mobile admin (`/mobile-admin`), `MobileOpsScreen` existe mas precisa de verificação se `HuddleConsole` está integrado.
- `G-HL-03`: `topActions` têm `ownerName` como string livre — sem binding com usuários do sistema. Impossível notificar responsável automaticamente ou cobrar via sistema.
- `G-HL-04`: `reviewNotes` do huddle (campo para notas sobre revisão do turno anterior) não tem UI de exibição no turno seguinte — evidência histórica existe mas não é surfaceada.
- `G-HL-05`: Sem relatório de aderência ao LSW — "Quantos dos últimos 14 turnos tiveram huddle completo?" não é respondível pela UI.
- `G-HL-06`: `lswGraceMinutes` referenciado em `computeHuddleCadence` mas não existe no schema `UnitOpsSettings` — vai para o default de 30 min silenciosamente.

### 4.8 Analytics e Dados

**Avaliação geral: 🔴 Pipeline histórico inoperante**

**O que funciona bem:**

- Mission Control Snapshot (Firestore, on-demand): funcional
- `audit_logs` gerados automaticamente pela trigger `auditBedWrites`
- Analytics histórico arquitetado corretamente: queries sobre `audit_logs`

**Gaps identificados:**

- `G-AN-01` 🔴: **Todas as Cloud Functions "BQ" retornam 500 Internal Server Error** (evidência: AUDIT_Analytics_Freshness_Aging_2026-02-28.md §3). `getAdminFlowMetricsBQ`, `getAdminFreshnessBQ`, `getAdminKamishibaiStatsBQ`, `getAdminTopBlockersBQ`, `getAdminTrendComparisonBQ`, `getAdminMissionControlPeriod` — todas inoperantes.
- `G-AN-02`: Causa provável do erro 500: **índices compostos ausentes no Firestore** para queries sobre `audit_logs` com múltiplos filtros (action, createdAt, unitId). A `AuditScreen` já exibe mensagem de "FAILED_PRECONDITION" para índices ausentes.
- `G-AN-03`: Nome enganoso "BQ" (BigQuery) para funções que consultam Firestore `audit_logs`. Dívida de nomenclatura que confunde manutenção.
- `G-AN-04`: Sem agendamento automático de snapshots — nenhum snapshot horário/diário é persistido. Impossível reconstruir evolução histórica de KPIs.
- `G-AN-05`: `topBlockerNow` calculado no snapshot mas não exibido na UI. `topBlockersPeriod` calculado pela função de período mas função está com 500.
- `G-AN-06`: `AnalyticsListScreen` (drill-down de leitos por filtro) existe mas sem verificação se os filtros avançados (kamishibai=blocked, unreviewedShift, etc.) funcionam com os índices disponíveis.

### 4.9 RBAC e Segurança

**Avaliação geral: ✅ Implementação robusta**

**O que funciona bem:**

- RBAC por unidade: `admin | editor | viewer` via documento `/users/{uid}/authz/authz`
- Global admin por custom claim Firebase (sem fallback por email — correto)
- Regras Firestore granulares: leitura pública autenticada, escrita restrita por papel
- Trigger de auditoria captura todas as escritas em beds (append-only, imutável)
- 58 testes E2E de RBAC passando (incluindo boundary tests)

**Gaps identificados:**

- `G-RB-01`: `UnitRole: 'viewer'` definido no tipo mas sem evidência de tela específica para viewer — viewer provavelmente cai no editor mobile sem poder escrever, sem feedback claro de sua limitação.
- `G-RB-02`: Sem expiração de sessão ou renovação de token configurada — usuários desligados continuam com acesso até rotação de token manual.

### 4.10 Educação (EduCenter)

**Avaliação geral: ⚪ Presente mas imatura**

**O que existe:**

- `EduCenterHome.tsx`, `MicrolessonList.tsx`, `PlaybookView.tsx`, `AppTutorialView.tsx`
- `EduContentRepository.ts` — repositório de conteúdo educacional
- Botão `?` flutuante no Admin (não na navbar principal — intencional conforme CHANGELOG)

**Gaps identificados:**

- `G-ED-10`: EduCenter não tem integração com contexto operacional — não sugere microlesson ao detectar padrão problemático (ex: kamishibai sempre bloqueado para um domínio).
- `G-ED-11`: Conteúdo de microlessons/playbooks não foi avaliado nesta auditoria (fora do escopo técnico).

---

## 5. Gargalos Priorizados (Pareto Lean)

Ordenados por impacto na rotina operacional diária × frequência de ocorrência:

| # | Gargalo | Frequência | Impacto Fluxo | Causa Raiz |
| --- | --------- | ----------- | -------------- | ------------ |
| **G1** | Analytics histórico inoperante (500 errors) | Cada uso do Analytics | 🔴 Crítico | Índices Firestore ausentes nas CFs BQ |
| **G2** | Mission Control on-demand (sem auto-refresh) | Cada turno (12x/semana) | 🔴 Crítico | Arquitetura pull, sem subscription no MC |
| **G3** | Huddle sem marcação automática de conclusão | Cada turno | 🟠 Alto | Depende de clique "Encerrar" — comportamento frágil |
| **G4** | `mainBlocker` texto livre sem taxonomia | Cada edição de leito | 🟠 Alto | Campo `string` sem enum ou sugestões |
| **G5** | Freshness via `updatedAt` (não reviewedAt) | Cálculo em tempo real | 🟠 Alto | Inconsistência entre MC e Editor |
| **G6** | `kanbanMode ACTIVE_LITE` sem efeito real | Qualquer uso do modo | 🟡 Médio | Flag sem implementação de regra de negócio |
| **G7** | Sem notificação push para escalações críticas | Quando escalação ocorre | 🟡 Médio | Sem FCM/push implementado |
| **G8** | `applicableDomains` sem UI no Editor Mobile | Cada leito com domínio N/A | 🟡 Médio | Funcionalidade de admin não exposta ao editor |
| **G9** | `topBlockerNow` calculado mas não exibido | Cada snapshot | 🟡 Médio | Campo no snapshot não renderizado |
| **G10** | Aging do bloqueador invisível na TV | Cada visualização TV | 🟡 Médio | Dado disponível (`blockedAgingHours`) não surfaceado |

---

## 6. Lacunas de Produto

### 6.1 Lacunas de experiência (UX/UI)

| ID | Lacuna | Usuário Impactado |
| ---- | -------- | ------------------ |
| LP-01 | TV Kamishibai não exibe razão do bloqueio — equipe na TV vê vermelho sem contexto | Toda a equipe de unidade |
| LP-02 | TV Kanban não exibe aging do bloqueador — leito bloqueado há 48h parece igual ao de 1h | Coordenador |
| LP-03 | Sem tela de "meu turno" no editor — profissional de apoio não sabe quais leitos são seus | Fisio, Nutrição, Social, etc. |
| LP-04 | Sem progresso de Kamishibai na MobileDashboard — "X de Y domínios revisados" por leito | Equipe assistencial |
| LP-05 | HuddleConsole só no Admin — coordenador mobile precisa acessar `/mobile-admin` para registrar huddle | Coordenador móvel |
| LP-06 | Configuração de thresholds Mission Control sem UI — requer console Firebase | Admin |

### 6.2 Lacunas de processo (operacional)

| ID | Lacuna | Impacto |
| ---- | -------- | --------- |
| LO-01 | Sem onboarding guiado no primeiro uso — curva de adoção alta | Risco de abandono na implantação |
| LO-02 | Sem alertas de cadência de huddle para quem não está na frente da TV | Turnos sem huddle passam despercebidos |
| LO-03 | Sem relatório de aderência LSW (% huddles completos/semana por unidade) | Impossível cobrar cadência gerencialmente |
| LO-04 | Sem relatório de kamishibai por domínio ao longo do tempo | Impossível identificar equipe com baixa adesão |
| LO-05 | Sem ciclo de PDCA integrado — problema identificado no MC não tem fluxo de criação de pendência associado | Gestão manual fora do sistema |

---

## 7. Lacunas Técnicas

| ID | Lacuna | Severidade | Arquivo(s) |
| ---- | -------- | ----------- | ------------ |
| LT-01 | **Índices Firestore ausentes para queries de audit_logs** — causa direta do 500 nas CFs analíticas | 🔴 Crítica | `firestore.indexes.json`, CFs analytics |
| LT-02 | **Dupla implementação de `computeShiftKey`** — uma em `domain/shiftKey.ts` e outra inline em `getAdminMissionControlSnapshot.ts`. Risco de divergência em horários de virada de turno | 🟠 Alta | `shiftKey.ts:*`, `getAdminMissionControlSnapshot.ts:50-70` |
| LT-03 | **`lswGraceMinutes` referenciado mas ausente do `UnitOpsSettings` schema** — silenciosamente usa default 30min | 🟠 Alta | `lswCadence.ts:*`, `types.ts:UnitOpsSettings` |
| LT-04 | **Escalations na TV usa `DEFAULT_ESCALATION_THRESHOLDS` sem ler `settings/mission_control`** — thresholds customizados ignorados na TV | 🟠 Alta | `TvDashboard.tsx:*`, `escalation.ts:*` |
| LT-05 | **Seed monolítico** (`seed-data.ts`) — sem paralelismo, tudo ou nada. Falha parcial não é recuperável | 🟡 Média | `scripts/seed-data.ts` |
| LT-06 | **Analytics CFs nomeadas "BQ"** mas consultam Firestore — dívida de nomenclatura | 🟡 Média | `functions/src/callables/analytics/*BQ.ts` |
| LT-07 | **Capacitor Android configurado** mas sem processo de build/release documentado (CI/CD faz deploy de hosting, não APK) | 🟡 Média | `capacitor.config.ts`, `android/` |
| LT-08 | **`topBlockerNow` não renderizado** na MissionControlTab — campo calculado desperdiçado | 🟡 Média | `MissionControlTab.tsx:*` |
| LT-09 | **Sem cache de snapshot** — cada refresh do MC faz cold start de Cloud Function lendo todos os beds | 🟢 Baixa | `getAdminMissionControlSnapshot.ts` |
| LT-10 | **Sem health check automatizado** das Cloud Functions em CI — 500s podem permanecer em produção sem detecção | 🟢 Baixa | `.github/workflows/` |

---

## 8. Avaliação do Sistema como Governança de Fluxo

### 8.1 Matriz de maturidade por dimensão

| Dimensão | Maturidade | Nota |
| ---------- | ----------- | ------ |
| **Visualização em tempo real** | ✅ Alta | TV com rotação automática, dados live, semáforos |
| **Entrada de dados** | ✅ Alta | Editor mobile funcional, auditado, com proteção RBAC |
| **Kamishibai (cadência multiprofissional)** | 🟡 Média-Alta | Modelo correto, TTL de turno, falta UI para N/A e razão de bloqueio |
| **Pendências operacionais** | 🟡 Média-Alta | Schema v1 completo, UI básica, faltam filtros por equipe |
| **Huddle / LSW** | 🟡 Média | Estrutura implementada, adoção frágil (depende de "Encerrar") |
| **Mission Control (KPIs)** | 🟡 Média | On-demand não sustenta rotina, freshness com métrica errada |
| **Analytics histórico** | 🔴 Baixa | Pipeline inoperante (500 errors), sem snapshots persistidos |
| **Escalação e alertas** | 🟡 Média-Baixa | Calculado corretamente, sem delivery proativo |
| **Governança de processo (LSW cadência)** | 🟡 Média-Baixa | `computeHuddleCadence` existe, sem relatório de aderência |
| **Configurabilidade operacional** | 🟡 Média-Baixa | Thresholds existem no Firestore, sem UI de configuração |

### 8.2 Pergunta central: O BedSight sustenta rotina operacional real?

**Resposta:** Parcialmente — com a seguinte qualificação:

**O sistema SUSTENTA:**

- Visibilidade do estado do fluxo em tempo real (TV Dashboard)
- Registro estruturado de bloqueadores, previsão de alta e kamishibai por turno
- Trilha de auditoria completa de quem fez o quê e quando
- Gestão de pendências com SLA e overdue
- Identificação automática de escalações críticas

**O sistema AINDA DEPENDE de esforço humano para:**

- Iniciar e encerrar formalmente cada huddle (sem lembretes automáticos além da TV)
- Atualizar Mission Control (manual) para obter KPIs atualizados durante o turno
- Inserir dados de kamishibai por 6 equipes de forma independente e disciplinada
- Normalizar o texto do `mainBlocker` (sem taxonomia enforçada)
- Diagnosticar tendências (analytics histórico inoperante)

**Diagnóstico:** O sistema está no estágio de **"ferramenta de apoio à rotina"**, não de **"sistema de governança autônoma"**. A transição requer principalmente: (a) consertar o pipeline analítico, (b) adicionar auto-refresh ao Mission Control, (c) fortalecer o ciclo de fechamento do huddle, e (d) implementar notificações proativas.

---

## 9. Próximos Passos P0 / P1 / P2

### P0 — Crítico (bloqueia uso operacional real)

| ID | Ação | Entregável | Esforço Est. |
| ---- | ------ | ----------- | ------------- |
| P0-01 | **Corrigir índices Firestore para CFs analíticas** — criar índices compostos em `audit_logs` para queries de analytics (action + unitId + createdAt). Validar cada função BQ individualmente | `firestore.indexes.json` atualizado + testes de smoke | Médio (1-2 dias) |
| P0-02 | **Auto-refresh do Mission Control** — substituir refresh manual por `setInterval` de 2-3 min ou subscription Firestore nos beds (recomendado: subscription com debounce) | MC atualiza automaticamente durante turno | Médio (1 dia) |
| P0-03 | **Unificar `computeShiftKey`** — eliminar implementação inline no CF do snapshot, importar de `shared/shiftKey` compartilhado | Única implementação, sem risco de divergência | Baixo (0.5 dia) |
| P0-04 | **Adicionar `lswGraceMinutes` ao schema `UnitOpsSettings`** e expor na OpsScreen para configuração | Schema + UI + Firestore | Baixo (0.5 dia) |

### P1 — Alta prioridade (impacta qualidade da rotina)

| ID | Ação | Entregável | Esforço Est. |
| ---- | ------ | ----------- | ------------- |
| P1-01 | **TV: exibir aging do bloqueador no Kanban** — adicionar badge de aging (12h/24h/48h+) na célula do bloqueador | TV Kanban com indicador visual de aging | Baixo (0.5 dia) |
| P1-02 | **TV: exibir razão do bloqueio Kamishibai** — tooltip ou modal ao passar/clicar no dot vermelho | UX de contexto para profissional na TV | Médio (1 dia) |
| P1-03 | **Editor Mobile: UI para `applicableDomains`** — checklist de domínios N/A por leito | Profissional de apoio consegue marcar domínio não aplicável | Médio (1 dia) |
| P1-04 | **Mission Control: renderizar `topBlockerNow`** — card "Top Bloqueador do Momento" já disponível no snapshot | Novo card no MissionControlTab | Baixo (0.5 dia) |
| P1-05 | **Corrigir freshness para usar `reviewedAt`** — no snapshot CF, usar `max(kamishibai[domain].reviewedAt)` por leito ao invés de `bed.updatedAt` | Métrica de freshness semanticamente correta | Médio (1 dia) |
| P1-06 | **Escalation na TV com thresholds da unidade** — ler `settings/mission_control` na TV (via subscription) ao invés de usar defaults hardcoded | Consistência TV ↔ Mission Control | Médio (1 dia) |
| P1-07 | **Adicionar relatório de aderência LSW** — "% huddles completos nos últimos 14 turnos" por unidade | Tela no Admin Analytics ou Mission Control | Alto (2-3 dias) |

### P2 — Médio prazo (eleva governança)

| ID | Ação | Entregável | Esforço Est. |
| ---- | ------ | ----------- | ------------- |
| P2-01 | **Taxonomia de bloqueadores** — campo `mainBlocker` com sugestões predefinidas (+ opção "outro") configuráveis por unidade | Qualidade do dado de top blockers | Alto (2-3 dias) |
| P2-02 | **Snapshots persistidos automaticamente** — Cloud Function agendada (cron) para gravar snapshot do MC a cada turno | Histórico de KPIs por turno para comparação | Alto (2-3 dias) |
| P2-03 | **Notificações push (FCM)** — alert de escalação crítica para admins da unidade via Firebase Cloud Messaging | Delivery proativo sem depender da TV | Alto (3-5 dias) |
| P2-04 | **Relatório de kamishibai por domínio** — aderência semanal por equipe de apoio | Gestão de desempenho por disciplina | Alto (2-3 dias) |
| P2-05 | **UI de configuração de thresholds Mission Control** — OpsScreen com campos editáveis para os thresholds | Eliminar dependência do console Firebase | Médio (1-2 dias) |
| P2-06 | **Tela "meu turno" no Editor Mobile** — visão filtrada por `domain` do usuário logado | Experiência para equipes de apoio | Alto (2-3 dias) |
| P2-07 | **`kanbanMode ACTIVE_LITE` com semântica real** — definir e implementar comportamento diferenciado (ex: obrigar preenchimento de bloqueador antes de salvar) | Modo operacional com consequência | Alto (3-5 dias) |
| P2-08 | **Health check automatizado de CFs** — smoke test no CI para verificar que funções deployed não retornam 500 | Detecção precoce de regressões em produção | Médio (1 dia) |

---

## Apêndice: Inventário de Testes

| Tipo | Quantidade | Status |
| ------ | ----------- | -------- |
| Testes unitários (Vitest) | ~20 arquivos `.test.ts` | ✅ Passando |
| Testes E2E (Playwright) | ~20 arquivos `.spec.ts` | ✅ 58/58 RBAC passando |
| Cobertura de Analytics CFs (smoke) | 0 | 🔴 Ausente |
| Cobertura de Huddle fluxo completo E2E | Parcial | 🟡 Parcial |

---

*Auditoria Fase 1 — BedSight Flow | Gerado em 2026-03-06 | Auditor: Agente Claude*
*Branch: `claude/bedsight-phase1-audit-tTgnG`*
