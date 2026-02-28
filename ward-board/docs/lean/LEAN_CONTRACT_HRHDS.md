# LEAN\_CONTRACT\_HRHDS — BedSight

**Contrato Canônico de Operação Lean**

---

## 0. Status do documento

| Atributo | Valor |
|----------|-------|
| **Versão** | v1.0 |
| **Data** | 2026-02-28 |
| **Dono do contrato** | HRHDS / BedSight — responsável: Marcelo Cavalcanti |
| **Escopo** | Unidade A (piloto) → extensível a multi-unidade |
| **Base de evidências** | Auditoria 360 BedSight — `docs/audits/` — 2026-02-28 |
| **Status** | 🟡 Pendente ratificação pelo dono do produto |

Este documento é a **fonte de verdade** para semântica de estados, cores, cadência e políticas operacionais do BedSight no HRHDS. Toda refatoração de código deve ser aderente a este contrato. Conflitos entre código e este doc = **o contrato prevalece**.

---

## 1. Definições essenciais

### 1.1 Leito ativo

**Critério:** `patientAlias.trim() !== ''`

Um leito está ativo quando tem um paciente admitido (identificado por alias/iniciais). Leito ativo é o único que participa de semáforos Kamishibai, contagem de bloqueios e KPIs de alta.

**Evidência de auditoria:** `AUDIT_Firestore_Model` §2.2 — critério real usado em `getAdminMissionControlSnapshot.ts:66`.

### 1.2 Leito vazio

**Critério:** `patientAlias.trim() === ''`

Leito sem paciente. **Regra:** não deve exibir nenhum semáforo Kamishibai, não participa de KPIs operacionais, não é contado como bloqueado ou fresco. A ausência visual é intencional — posição ocupada no layout da TV, mas sem cor, badge ou dot.

### 1.3 Kamishibai (no HRHDS)

Sistema de gestão visual operacional por equipe/domínio. Cada leito ativo tem um cartão por domínio (MÉDICA, ENFERMAGEM, FISIOTERAPIA, NUTRIÇÃO, PSICOLOGIA, SERVIÇO SOCIAL). O cartão exibe a situação atual do domínio naquele leito **neste turno**: OK (verde) ou com impedimento (vermelho). A ausência de cor significa "ainda não revisado neste turno" — e essa informação é operacionalmente relevante.

### 1.4 Kanban (previsão de alta)

Sistema de priorização de altas por horizonte temporal. Cada leito ativo tem uma estimativa de alta (`24h`, `2-3d`, `>3d`, `indefinida`). O Kanban não mede qualidade operacional de equipes — isso é papel do Kamishibai. Kanban é planejamento de capacidade e priorização de fluxo de saída.

### 1.5 Huddle AM / Huddle PM

Ritual Lean de revisão coletiva do estado da unidade. No HRHDS:

- **Huddle AM:** revisão matutina do estado operacional (início de turno diurno)
- **Huddle PM:** revisão vespertina (início de turno noturno ou transição)

O sistema deve **registrar** que o huddle ocorreu, quem registrou e quando — não apenas servir de quadro de exibição. O registro é a evidência de que o ritual aconteceu.

### 1.6 "Sem cor" (estado neutro)

**Definição:** um domínio/leito que ainda não foi revisado no turno atual, ou cujo Kamishibai está desabilitado, ou cujo leito está vazio.

"Sem cor" **não é um status armazenado** — é ausência de status válido para o turno. Na UI: posição visível, sem dot colorido (nem verde nem vermelho).

**Regra crítica:** a ausência de cor é informação operacional. Muitos leitos "sem cor" no início do turno = huddle ainda não realizado = visível na TV.

### 1.7 "N/A" (não aplicável)

Um domínio é N/A quando a especialidade correspondente **não está envolvida no cuidado deste paciente**. Por exemplo: paciente sem necessidade de fisioterapia → domínio `physio` é N/A.

**Distinção importante:**

- `N/A` = especialidade não envolvida neste caso (por decisão clínica)
- `Sem cor` = especialidade envolvida mas ainda não revisada neste turno
- `Leito vazio` = sem paciente (nenhum domínio é aplicável)

**Problema auditado:** o sistema atual usa o valor `'na'` para cobrir os três casos simultaneamente → ambiguidade eliminada por este contrato (ver §4.2).

---

## 2. Princípios Lean do HRHDS

### 2.1 Tornar o anormal óbvio

A tela de TV deve fazer o vermelho visível sem esforço. Um vermelho isolado em 36 leitos deve ser notado em 3 segundos. Não usar cinza/amber/neutro como estado operacional — apenas verde (OK), vermelho (bloqueado) ou ausência (não revisado).

### 2.2 Cadência mínima garantida

O sistema deve suportar dois rituais por dia (Huddle AM e PM). Sem ritual registrado = sem garantia de que o estado do quadro é atual. A cadência é o contrato entre o sistema e a equipe.

### 2.3 Registrar e retomar pendências

Bloqueios (vermelho) gerados em um turno devem:

1. Persistir até serem explicitamente resolvidos (não resetam automaticamente na virada de turno)
2. Envelhecer (tempo em vermelho é visível)
3. Ser rastreáveis (quem criou, quando, por qual domínio)

### 2.4 Gestão de altas como fluxo, não evento

Alta não é um evento pontual — é um processo com horizonte de tempo, barreiras identificáveis e responsáveis por domínio. O Kanban representa o horizonte. O Kamishibai representa as barreiras. Ambos devem ser usados em conjunto no huddle.

---

## 3. Contrato do Kanban (Previsão de Alta)

### 3.1 Categorias

O HRHDS **mantém** as 4 categorias atuais:

| Valor | Label | Cor do badge | Semântica |
|-------|-------|-------------|-----------|
| `'24h'` | `< 24h` | 🟢 Verde | Alta prevista para hoje — prioridade máxima de verificação de barreiras |
| `'2-3_days'` | `2–3 dias` | 🟡 Amarelo | Alta em breve — iniciar desbloqueio de pendências cross-equipe |
| `'>3_days'` | `> 3 dias` | 🔴 Vermelho | Alta distante — acompanhar evolução, não é foco imediato de alta |
| `'later'` | `Indefinida` | ⬜ Sem cor (borda tracejada) | Horizonte desconhecido — requer revisão de plano terapêutico |

**Evidência de auditoria:** `AUDIT_TV_Rotation` §4 — cores implementadas em `KanbanScreen.tsx:11-18`.

### 3.2 Semântica de uso

- O Kanban **não informa qualidade operacional** — só horizonte de alta
- O Kanban é **atualizado pelo Editor** (equipe multiprofissional)
- O Kanban é **lido na TV** para planejamento de leitos livres (capacidade)
- No huddle: foco em verde (< 24h) → verificar barreiras para conversão

### 3.3 O que o Kanban NÃO é

- Não é Kamishibai (não informa qualidade de atendimento por domínio)
- Não é indicador de qualidade assistencial
- Badges de cor do Kanban ≠ semáforos do Kamishibai (sistemas visuais distintos)

### 3.4 Critério de aparição no Kanban

**Apenas leitos ativos** aparecem no Kanban com badge colorido. Leitos vazios aparecem na posição sem badge (layout neutro).

---

## 4. Contrato do Kamishibai (Gestão Operacional)

### 4.1 Ativação do Kamishibai

O Kamishibai tem **dois níveis de controle**, que devem ser separados no sistema:

| Nível | Campo | Path Firestore | Semântica |
|-------|-------|----------------|-----------|
| **Display** (tela na TV) | `screens[{key:'kamishibai'}].enabled` | `settings/board` | Controla se a tela de Kamishibai aparece na rotação da TV |
| **Política operacional** | `kamishibaiEnabled` *(a criar)* | `settings/ops` | Controla se o Kamishibai está ativo como ferramenta de gestão na unidade |

**Regra:** `kamishibaiEnabled = false` → dots não são exibidos em nenhum contexto (TV, Editor, Mission Control). Leitos aparecem sem semáforo de domínio.

**Regra:** `kamishibaiEnabled = true` e `screens[kamishibai].enabled = false` → Kamishibai está ativo operacionalmente, mas a TV não exibe a tela de rotação. O Editor ainda permite atualização de status.

**Problema auditado:** hoje não existe `kamishibaiEnabled` como campo. O campo está na fila de implementação (etapa 1+). Este contrato define o comportamento esperado.

### 4.2 Estados permitidos (HRHDS) — binário

O HRHDS adota **estados binários + dois estados de ausência**:

| Estado | Valor de sistema | Cor | Displayed quando |
|--------|-----------------|-----|-----------------|
| **OK** | `'ok'` | 🟢 Verde | Revisado no turno atual E sem impedimento |
| **BLOQUEADO** | `'blocked'` | 🔴 Vermelho | Impedimento ativo declarado |
| **Sem cor** *(não revisado)* | ausência de revisão no turno | ⬜ Neutro | Não houve revisão no turno atual (mesmo que turno anterior esteja `'ok'`) |
| **N/A** | representação separada *(a definir em impl.)* | ~~Sem dot~~ | Especialidade não envolvida no caso |

**Declaração explícita de eliminação de ambiguidade:**

> O estado `'na'` atual do sistema (auditado em `AUDIT_Kamishibai_States` §6, Gap G1) é **ambíguo**: cobre leito vazio, especialidade não aplicável E "sem revisão". Este contrato elimina essa ambiguidade através de:
>
> 1. Leito vazio → sem exibição de quadro Kamishibai
> 2. N/A → campo `applicableDomains` ou similar (decisão de implementação, não de contrato)
> 3. Sem cor → ausência de revisão válida no turno atual (TTL expirado ou nunca revisado neste turno)

### 4.3 Domínios e ordem canônica

O HRHDS **mantém** a ordem canônica atual:

| Posição | Domínio (key) | Rótulo na TV |
|---------|--------------|-------------|
| 1 | `medical` | MÉDICA |
| 2 | `nursing` | ENFERMAGEM |
| 3 | `physio` | FISIOTERAPIA |
| 4 | `nutrition` | NUTRIÇÃO |
| 5 | `psychology` | PSICOLOGIA |
| 6 | `social` | SERVIÇO SOCIAL |

**Evidência de auditoria:** `AUDIT_Kamishibai_States` §2 — `KAMISHIBAI_DOMAINS` em `specialtyUtils.ts:15-17`.

**Regra:** subespecialidades médicas (Cardiologia, Nefrologia, etc.) pertencem ao Kanban (`involvedSpecialties`), **não** ao Kamishibai. Kamishibai tem exatamente 6 domínios, fixos.

### 4.4 Semântica do verde (OK)

**Definição HRHDS:**
> Verde significa: **este domínio foi revisado neste turno e não há impedimento ativo.**

**Consequência direta — TTL de turno:**

- `'ok'` marcado no turno AM **expira** na virada para o turno PM
- Após a virada de turno, o leito fica "sem cor" (não-revisado) mesmo que o status anterior fosse `'ok'`
- O verde não persiste entre turnos — é sempre uma afirmação sobre **o turno atual**

**Como verificar (critério de aceitação):**
> Após a virada de turno, um leito com `kamishibai.{domain}.status = 'ok'` e `reviewedAt < início_do_turno_atual` deve ser **exibido sem cor** na TV, não como verde.

**Problema auditado:** hoje o verde persiste indefinidamente (`AUDIT_Kamishibai_States` §6, Gap G3). Esse comportamento viola este contrato.

### 4.5 Semântica do vermelho (BLOQUEADO)

**Definição HRHDS:**
> Vermelho significa: **há um impedimento ativo que exige ação ou escalonamento.**

**Conteúdo mínimo obrigatório de um bloqueio:**

| Campo | Obrigatoriedade | Exemplo |
|-------|----------------|---------|
| Motivo do bloqueio | **Obrigatório** | "Aguardando laudo RX" |
| Domínio responsável | Implícito (é o domínio do dot) | `nursing` |
| Quem declarou | **Obrigatório** (`updatedBy`) | `{ uid, name }` |
| Quando declarou | **Obrigatório** (`kamishibai.{domain}.updatedAt`) | Timestamp |
| Próxima ação | **Opcional no v1** (campo `note` — existe, sem UI) | "Ligar para radiologia até 15h" |

**Persistência:** vermelho **não reseta** na virada de turno. Um bloqueio criado no turno AM persiste no turno PM até ser explicitamente marcado como `'ok'` ou resolvido.

**Aging:** cada hora em vermelho é visível no Mission Control (KPI de aging de bloqueador). O envelhecimento de um bloqueio é informação operacional, não acidental.

---

## 5. Contrato de Cadência (Huddle AM / PM)

### 5.1 Estrutura de turnos

O HRHDS opera com **2 turnos por dia**:

| Turno | Código | Horário padrão (BRT / America/Sao_Paulo) | Prioridade |
|-------|--------|------------------------------------------|-----------|
| AM | `'AM'` | 07:00h | Inicio de turno diurno |
| PM | `'PM'` | 19:00h | Inicio de turno noturno |

> **Open Decision OD-1:** horários exatos a confirmar pelo HRHDS (ver §8).

### 5.2 O que o sistema deve registrar por huddle

Ao "registrar huddle", o sistema grava na unidade:

```
{
  lastHuddleAt:           Timestamp,   // momento do registro
  lastHuddleType:         'AM' | 'PM',
  lastHuddleRegisteredBy: ActorRef,    // uid + name de quem registrou
}
```

**Path Firestore esperado (a implementar):** `units/{unitId}/settings/ops`

**Quem pode registrar:** qualquer usuário com role `admin` ou `editor` na unidade.

**Como registrar (v1):** botão "Registrar Huddle AM/PM" na tela da TV ou no admin — **não é automático**. O registro é um gesto consciente da equipe.

### 5.3 O que acontece na virada de turno

Quando o sistema detecta a virada de turno (AM → PM ou PM → AM do dia seguinte):

| Comportamento | Ação do sistema |
|--------------|----------------|
| Status `'ok'` por domínio | Passa a ser exibido como "sem cor" (não-revisado) — dados não são apagados |
| Status `'blocked'` por domínio | **Persiste** — bloqueios envelhecem, não resetam |
| `lastHuddleAt` da unidade | Fica desatualizado (visível como "Último huddle: Xh atrás") |
| Pendências abertas | Persistem para o próximo turno |

**Importante:** a virada de turno não **apaga** dados. Ela muda a **interpretação visual** do status para "sem cor" no contexto da TV. Os dados brutos em Firestore permanecem inalterados.

### 5.4 Critério de aceitação da cadência

> Um sistema aderente a este contrato deve ser capaz de responder, em qualquer momento: **"O huddle deste turno já foi realizado?"**

Se `lastHuddleAt` do turno atual não existe ou é `< início_do_turno_atual` → huddle não realizado → indicação visual na TV (ex: badge "Huddle pendente" ou semelhante).

---

## 6. Separação Display vs Política Operacional

Este é um dos princípios arquiteturais mais importantes do contrato.

### 6.1 Declaração

| Configuração | Path Firestore | Responsável | O que controla |
|-------------|----------------|-------------|----------------|
| **Display** | `units/{unitId}/settings/board` | Admin (TV Settings) | Rotação, duração das telas, paginação, quais telas aparecem na TV |
| **Política Operacional** | `units/{unitId}/settings/ops` | Admin (Ops Settings) | Como a unidade opera (modo Kanban, Kamishibai ativo/inativo, cadência de huddle, turno atual) |

### 6.2 Regra de design

Toda nova configuração deve ser classificada **antes de ser implementada**:

- É sobre **como a TV apresenta informação**? → `settings/board`
- É sobre **como a unidade opera segundo a metodologia Lean**? → `settings/ops`

**Exemplos:**

- `kanbanBedsPerPage = 18` → display (`board`)
- `kanbanMode = 'ACTIVE_LITE'` → política operacional (`ops`)
- `kamishibaiEnabled = true` → política operacional (`ops`)
- `screens[kamishibai].enabled = false` → display (`board`)
- `currentShiftType = 'AM'` → política operacional (`ops`)
- `huddleSchedule = { AM: '07:00', PM: '19:00' }` → política operacional (`ops`)

**Evidência de auditoria:** `AUDIT_LeanAlignment` §6 — separação identificada como necessária. Hoje `settings/ops` contém apenas `kanbanMode`. Este contrato expande o escopo de `settings/ops`.

---

## 7. Requisitos não-funcionais e critérios de aceitação

### 7.1 Checklist de conformidade (v1)

| # | Requisito | Como verificar | Status atual |
|---|-----------|---------------|-------------|
| NF1 | Não existe ambiguidade de `na` | Verificar se UI distingue leito vazio / N/A / sem-revisão sem usar mesmo dot | ❌ Ambíguo hoje |
| NF2 | Verde não pode persistir indefinidamente entre turnos | Verde de turno anterior → "sem cor" após virada | ❌ Verde persiste hoje |
| NF3 | Huddle tem registro mensurável | `lastHuddleAt` existe e é atualizado ao registrar huddle | ❌ Campo não existe hoje |
| NF4 | Vermelho persiste entre turnos | Bloqueio criado no AM aparece no PM sem reset automático | ✅ Já funciona (sem TTL) |
| NF5 | Mission Control não depende apenas de `updatedAt` como proxy | `blockedAt` dedicado existe — aging é calculado a partir dele | ❌ Usa `updatedAt` hoje |
| NF6 | Dados antigos coexistem durante migração | Schema v1 aceita docs sem `reviewedAt` / `blockedAt` (campos opcionais) | 🟡 Meta da migração |
| NF7 | `kamishibaiEnabled` separa display de política | Campo em `settings/ops`, independente de `settings/board` | ❌ Campo não existe hoje |
| NF8 | Leito vazio → sem dot Kamishibai na TV | TV não renderiza dots para `patientAlias === ''` | ❌ Renderiza `na` hoje |

### 7.2 Compatibilidade retroativa (v1)

Durante a migração de v0 (sistema atual) para v1 (sistema aderente ao contrato):

1. Documentos `bed` sem `blockedAt` devem usar `updatedAt` como proxy temporário (comportamento atual preservado)
2. `kamishibai.{domain}.status === 'na'` deve ser tratado como "sem cor" na v1 (mapeamento de legado)
3. Ausência de `lastHuddleAt` em `settings/ops` = huddle nunca registrado (comportamento gracioso)
4. Nenhum dado deve ser apagado durante a migração — apenas schema adicionado, nunca removido

---

## 8. Decisões abertas (Open Decisions)

As 5 decisões abaixo requerem ratificação do dono do produto (Marcelo/HRHDS) antes da implementação. Nenhuma delas bloqueia a criação do contrato ou o início da refatoração do código.

| # | Decisão | Opções | Impacto |
|---|---------|--------|---------|
| **OD-1** | Horários de virada de turno | 07:00 AM / 19:00 PM (padrão) ou outro esquema (12h/8h) | Define quando "sem cor" é ativado |
| **OD-2** | N/A — como representar | (a) campo `applicableDomains[]` separado em `bed`; (b) `status: 'na'` com semântica redefinida; (c) omissão do domínio em `kamishibai` | Impacto em schema e queries de Mission Control |
| **OD-3** | Registro de huddle — quem pode | (a) apenas admin; (b) admin + editor; (c) qualquer usuário autenticado da unidade | Impacto em Firestore rules |
| **OD-4** | Próxima ação no bloqueio (campo `note`) | (a) campo livre obrigatório ao marcar `blocked`; (b) opcional (manter como hoje); (c) field estruturado (`{ responsavel, prazo, acao }`) | Impacto em UX do Editor e schema do leito |
| **OD-5** | Timeout de aging para escalonamento | (a) 8h sem resolver = escalonamento automático (notificação/badge especial); (b) somente visual (badge vermelho+ícone após Xh); (c) sem escalonamento automático no v1 | Impacto em Cloud Functions e Mission Control |

---

## Referências

| Documento | Conteúdo referenciado |
|-----------|----------------------|
| [`AUDIT_LeanAlignment_2026-02-28.md`](../audits/AUDIT_LeanAlignment_2026-02-28.md) | Tabela mestre de features, flags, CFs, testes e gap list completo |
| [`AUDIT_Kamishibai_States_2026-02-28.md`](../audits/AUDIT_Kamishibai_States_2026-02-28.md) | Estados atuais, ambiguidade de `na`, TTL ausente |
| [`AUDIT_Firestore_Model_2026-02-28.md`](../audits/AUDIT_Firestore_Model_2026-02-28.md) | Schemas, exemplos JSON, casos problemáticos |
| [`AUDIT_MissionControl_2026-02-28.md`](../audits/AUDIT_MissionControl_2026-02-28.md) | KPIs, thresholds hardcoded, dependências de estado |
| [`AUDIT_Analytics_Freshness_Aging_2026-02-28.md`](../audits/AUDIT_Analytics_Freshness_Aging_2026-02-28.md) | Pipeline, métricas, `updatedAt` como proxy |
| [`AUDIT_TV_Rotation_2026-02-28.md`](../audits/AUDIT_TV_Rotation_2026-02-28.md) | Telas TV, cores de badges, rotação |
| [`AUDIT_Cadencia_Huddle_2026-02-28.md`](../audits/AUDIT_Cadencia_Huddle_2026-02-28.md) | Suporte zero a rituais hoje, schema necessário |
