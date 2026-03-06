# AUDIT — Cadência / Huddle / Rituais Lean

**Data:** 2026-02-28 | **Auditor:** Agente Antigravity | **Missão:** somente leitura

---

## 1. O que o sistema suporta hoje em rituals/huddle

| Ritual Lean | Existência no sistema | Evidência |
| ------------ | ---------------------- | ----------- |
| Huddle AM (revisão matutina) | ❌ Nenhum suporte | Sem campo, sem tela, sem timestamp de revisão |
| Huddle PM (revisão vespertina) | ❌ Nenhum suporte | Idem |
| Checklist de turno por leito | ❌ Nenhum suporte | Sem estrutura de checklist no schema |
| Pendências que sobrevivem ao turno | ❌ Nenhum suporte | `mainBlocker` é campo free text editável |
| Escalonamento automático de bloqueios antigos | ❌ Nenhum suporte | Sem TTL, sem escalation rule |
| `lastReviewedAt` por leito/domínio | ❌ Ausente | Não no schema `Bed` nem em `KamishibaiEntry` |
| `lastHuddleAt` por unidade | ❌ Ausente | Não no schema `Unit` |
| Notificações de ritmo (lembrete de huddle) | ❌ Ausente | Sem FCM, sem push, sem scheduler |
| Diferenciação turno A/B em exibição TV | ❌ Ausente | TV não tem conceito de turno |

---

## 2. O que existe que poderia SERVIR aos rituais (mas não foi projetado para isso)

| Elemento | Como poderia servir | Limitação |
| ---------- | -------------------- | ----------- |
| `updatedAt` do leito | Proxy para "quando foi a última revisão" | É a timestamp do leito inteiro, não da revisão de huddle |
| `kamishibai.{domain}.updatedAt` | Proxy para "quando aquela equipe marcou o status" | Não diferencia "revisão de huddle" de "edição aleatória" |
| Audit logs (`audit_logs`) | Historial de quem mudou o quê e quando | Read-only, sem query de "revisões deste turno" |
| Mission Control (atualização manual) | Snapshot do estado da unidade no momento do huddle | Não persiste automaticamente no horário do huddle |

---

## 3. Fluxo de um huddle ideal vs fluxo atual

### Fluxo ideal (Lean HRHDS)

```text
07:00h — Sistema gera lembrete de Huddle AM
07:05h — Coordenador abre Mission Control na TV
07:05h — Cada equipe atualiza kamishibai (ok/vermelho) — verde = revisado hoje
07:15h — Sistema registra "Huddle AM realizado às 07:15h"
07:15h — Leitos com blocked ≥ 24h → escalados automaticamente
19:00h — Repetição para Huddle PM
```

### Fluxo atual (sistema real)

```text
[sem horário fixo] — Coordenador abre admin → Analytics → Mission Control
[manual] — Clica refresh → dados carregados do Firestore
[manual] — Equipe entra no /editor e atualiza leito
[sem registro] — Nenhum evento "Huddle realizado" é gerado
[sem TTL] — Verde de ontem continua verde hoje
```

---

## 4. Schema necessário para suporte a huddl (não existe hoje)

Para suportar os rituais Lean, seria necessário:

```typescript
// Seria necessário adicionar a Unit:
interface UnitHuddleState {
    lastHuddleAt?: Timestamp;
    lastHuddleType?: 'AM' | 'PM';
    lastHuddleRegisteredBy?: ActorRef;
}

// Seria necessário adicionar a KamishibaiEntry:
interface KamishibaiEntry {
    // campos existentes...
    reviewedThisShift?: boolean;   // resetado em cada virada de turno
    reviewedAt?: Timestamp;         // timestamp da revisão de huddle
}

// Seria necessário adicionar a Bed:
interface Bed {
    // campos existentes...
    pendencies?: Pendency[];        // pendências persistentes cross-turno
}

interface Pendency {
    id: string;
    description: string;
    domain?: SpecialtyKey;
    createdAt: Timestamp;
    resolvedAt?: Timestamp;
    escalatedAt?: Timestamp;
}
```

---

## 5. Gaps críticos para rituais Lean

| # | Gap | Prioridade |
| --- | ----- | ----------- |
| R1 | Sem `lastHuddleAt` — sistema não sabe quando o huddle ocorreu | ALTA |
| R2 | Verde Kamishibai não tem TTL de turno — verde de ontem = verde hoje | ALTA |
| R3 | Sem checklist de turno — "o que foi feito neste turno" não é rastreado | ALTA |
| R4 | Pendências não sobrevivem ao turno (campo livre `mainBlocker` é sobrescrito) | ALTA |
| R5 | Sem diferenciação AM/PM em analytics — não há como comparar turno A vs B | MÉDIA |
| R6 | Sem notificação/lembrete de huddle — depende 100% de disciplina humana | MÉDIA |
| R7 | Mission Control não persiste snaphots automáticos no horário do huddle | MÉDIA |
| R8 | TV não exibe contexto "Turno Atual: AM · 07:05h" | BAIXA |
