# LEAN\_SHIFTKEY\_SPEC\_HRHDS — BedSight

**Versão:** v1.0 | **Data:** 2026-02-28 | **Base:** LEAN\_CONTRACT\_HRHDS v1.0 + LEAN\_STATE\_MACHINE\_HRHDS v1.0

---

## 1. Objetivo do shiftKey

O `shiftKey` é uma **string estável e sem ambiguidade** que identifica o turno atual de forma que:

1. **Habilita TTL do verde:** ao comparar `kamishibai.{domain}.reviewedShiftKey` com o `currentShiftKey` computado agora, o sistema determina se o verde ainda é válido ou se deve ser exibido como "sem cor"
2. **Responde "revisado neste turno?"** sem depender de cálculos de fuso ou de timestamps absolutos
3. **Suporta AM/PM** sem job automático em v1 — a comparação é feita 100% no frontend no momento do render
4. **É idempotente e determinístico** — dado o mesmo instante `now`, sempre produz o mesmo `shiftKey`

---

## 2. Definição canônica de turno

| Atributo | Valor |
|----------|-------|
| **Timezone** | `America/Sao_Paulo` (UTC-3, sem DST relevante para lógica de turno) |
| **Turno AM** | `'AM'` — início padrão: `07:00` local |
| **Turno PM** | `'PM'` — início padrão: `19:00` local |
| **Duração** | 12 horas cada (simplificação operacional) |
| **Configurabilidade** | Os horários são configuráveis via `settings/ops.huddleSchedule` — mas a lógica de computação é sempre a mesma função abaixo |

**Horários padrão (OD-1 default, pendente confirmação HRHDS):**

```
AM_START = "07:00"
PM_START = "19:00"
```

---

## 3. Função canônica: `computeShiftKey(now, schedule?, tz?)`

### 3.1 Assinatura

```typescript
function computeShiftKey(
    now: Date | Timestamp,
    schedule?: { amStart: string; pmStart: string }, // HH:MM, default { amStart: "07:00", pmStart: "19:00" }
    tz?: string                                       // IANA timezone, default "America/Sao_Paulo"
): string // formato: "YYYY-MM-DD-AM" | "YYYY-MM-DD-PM"
```

### 3.2 Pseudo-código canônico

```
FUNÇÃO computeShiftKey(now, schedule = {amStart: "07:00", pmStart: "19:00"}, tz = "America/Sao_Paulo"):

    1. Converter 'now' para horário local em 'tz':
       localNow = toLocalTime(now, tz)

    2. Extrair:
       localDate  = localNow.date        // ex: "2026-02-28"
       localHour  = localNow.hour        // 0-23
       localMin   = localNow.minute      // 0-59
       localTime  = localHour * 60 + localMin   // minutos desde meia-noite

    3. Calcular limites em minutos:
       amStartMin = parseHHMM(schedule.amStart)  // ex: 07:00 → 420
       pmStartMin = parseHHMM(schedule.pmStart)  // ex: 19:00 → 1140

    4. Determinar turno:
       SE localTime >= amStartMin E localTime < pmStartMin:
           → shiftType = "AM"
           → shiftDate = localDate

       SENÃO SE localTime >= pmStartMin:
           → shiftType = "PM"
           → shiftDate = localDate

       SENÃO (localTime < amStartMin → madrugada):
           → shiftType = "PM"
           → shiftDate = (localDate - 1 dia)  // pertence ao turno PM do dia anterior

    5. Retornar: shiftDate + "-" + shiftType
       ex: "2026-02-28-AM" ou "2026-02-27-PM"
```

### 3.3 Lógica da madrugada — explicação

O período entre `00:00` e `06:59` (antes do início do turno AM) pertence ao **turno PM do dia anterior**, porque:

- O turno PM começa às `19:00` do dia D
- Ele se estende até `06:59` do dia D+1 (12h de duração)
- Logo, `03:00` do dia D+1 ainda é parte do turno `PM` do dia `D`

Isso garante que um bloqueio registrado às `02:00` de um dia não seja "resetado" pela virada de data do calendário — ele segue no mesmo turno PM.

---

## 4. Exemplos canônicos

| `now` (horário local BRT) | `amStart` | `pmStart` | `shiftKey` resultante | Explicação |
|--------------------------|-----------|-----------|----------------------|-----------|
| `2026-02-28 03:00` | `07:00` | `19:00` | `2026-02-27-PM` | Madrugada → turno PM do dia anterior |
| `2026-02-28 06:59` | `07:00` | `19:00` | `2026-02-27-PM` | 1 minuto antes do AM → ainda PM de ontem |
| `2026-02-28 07:00` | `07:00` | `19:00` | `2026-02-28-AM` | Exatamente no início do AM |
| `2026-02-28 12:30` | `07:00` | `19:00` | `2026-02-28-AM` | Meio da tarde → turno AM |
| `2026-02-28 18:59` | `07:00` | `19:00` | `2026-02-28-AM` | 1 minuto antes do PM → ainda AM |
| `2026-02-28 19:00` | `07:00` | `19:00` | `2026-02-28-PM` | Exatamente no início do PM |
| `2026-02-28 23:45` | `07:00` | `19:00` | `2026-02-28-PM` | Noite → turno PM |

---

## 5. Campos que "carimbam" revisão por turno

### 5.1 Por domínio Kamishibai (em `bed.kamishibai.{domain}`)

| Campo | Tipo | Descrição | Presente no v0? |
|-------|------|-----------|----------------|
| `status` | `'ok' \| 'blocked'` | Status armazenado | ✅ Sim |
| `updatedAt` | `Timestamp` | Última escrita (qualquer) | ✅ Sim |
| `updatedBy` | `ActorRef` | Quem escreveu | ✅ Sim |
| `note` | `string` | Observação textual | ✅ Sim (sem UI) |
| `reviewedShiftKey` | `string` | **NOVO — v1** — turno em que foi revisado | ❌ Não existe |
| `reviewedAt` | `Timestamp` | **NOVO — v1** — timestamp da revisão | ❌ Não existe |
| `blockedAt` | `Timestamp` | **NOVO — v1** — quando o bloqueio foi criado | ❌ Não existe |
| `resolvedAt` | `Timestamp` | **NOVO — v1** — quando o bloqueio foi resolvido | ❌ Não existe |

### 5.2 Por unidade — cadência (em `unit.settings/ops`)

| Campo | Tipo | Descrição | Presente no v0? |
|-------|------|-----------|----------------|
| `kanbanMode` | `'PASSIVE' \| 'ACTIVE_LITE'` | Modo Kanban | ✅ Sim |
| `kamishibaiEnabled` | `boolean` | **NOVO — v1** — política operacional Kamishibai | ❌ Não existe |
| `currentShiftType` | `'AM' \| 'PM'` | **NOVO — v1** — turno ativo confirmado (optativo) | ❌ Não existe |
| `lastHuddleAt` | `Timestamp` | **NOVO — v1** — quando huddle foi registrado | ❌ Não existe |
| `lastHuddleType` | `'AM' \| 'PM'` | **NOVO — v1** — qual turno do huddle | ❌ Não existe |
| `lastHuddleShiftKey` | `string` | **NOVO — v1** — shiftKey do huddle registrado | ❌ Não existe |
| `lastHuddleRegisteredBy` | `ActorRef` | **NOVO — v1** — quem registrou | ❌ Não existe |
| `huddleSchedule` | `{ amStart, pmStart }` | **NOVO — v1** — horários configuráveis (opcional) | ❌ Não existe |

---

## 6. Lógica de decisão: verde ou sem cor?

```typescript
// Pseudo-código de decisão por domínio na TV/Editor
function resolveKamishibaiVisualState(
    bed: Bed,
    domain: SpecialtyKey,
    kamishibaiEnabled: boolean,
    now: Date
): 'INACTIVE' | 'NOT_APPLICABLE' | 'UNREVIEWED_THIS_SHIFT' | 'OK' | 'BLOCKED' {

    // Regra 1: leito vazio
    if (!bed.patientAlias?.trim()) return 'INACTIVE';

    // Regra 2: ferramenta desligada
    if (!kamishibaiEnabled) return 'INACTIVE';

    // Regra 3: domínio não aplicável (OD-2)
    // Variante A: if (!bed.applicableDomains?.includes(domain)) return 'NOT_APPLICABLE';
    // Variante B: if (!bed.kamishibai?.[domain]) return 'NOT_APPLICABLE';
    if (isNotApplicable(bed, domain)) return 'NOT_APPLICABLE';

    const entry = bed.kamishibai?.[domain];

    // Regra 4: bloqueio (persiste entre turnos)
    if (entry?.status === 'blocked') return 'BLOCKED';

    // Regra 5: sem shiftKey ou shiftKey de turno anterior → sem cor
    const currentShiftKey = computeShiftKey(now);
    if (entry?.reviewedShiftKey !== currentShiftKey) return 'UNREVIEWED_THIS_SHIFT';

    // Regra 6: revisado neste turno e ok
    if (entry?.status === 'ok') return 'OK';

    // Fallback de segurança
    return 'UNREVIEWED_THIS_SHIFT';
}
```

---

## 7. Compatibilidade v0 (legado sem `reviewedShiftKey`)

Documentos v0 não têm `reviewedShiftKey`. A lógica deve tratar a ausência graciosamente:

```typescript
// Se reviewedShiftKey não existe:
if (!entry?.reviewedShiftKey) return 'UNREVIEWED_THIS_SHIFT';
// → exibe sem cor (conservador: melhor mostrar "não revisado" que verde falso)
```

> **Princípio:** na ausência de `reviewedShiftKey`, assumir que o verde **não é válido** para o turno atual. Isso é conservador e seguro — o pior caso é mostrar mais "sem cor" do que devia, não mais verde do que devia.

---

## 8. Casos de borda e garantias

| Caso | Comportamento esperado |
|------|----------------------|
| `now` exatamente na virada de turno (07:00 ou 19:00) | `computeShiftKey` usa `>=` para início — entra no novo turno imediatamente |
| Servidor e cliente em timezones diferentes | `computeShiftKey` sempre usa `tz = "America/Sao_Paulo"` explicitamente — sem depender de timezone local do dispositivo |
| Usuário muda `huddleSchedule` (AM=06:00) a partir de hoje | Chaves antigas (`2026-02-28-AM` com `07:00`) não são inválidas — apenas o cálculo futuro usa o novo horário. Sem migração de chaves necessária. |
| Huddle registrado às 06:45 (antes do AM padrão) | `lastHuddleShiftKey = "2026-02-27-PM"` — registrado no turno PM. Huddle AM do dia não está registrado. |
| `reviewedShiftKey = "2026-02-28-AM"` mas agora é PM | `currentShiftKey = "2026-02-28-PM"` ≠ `reviewedShiftKey` → **UNREVIEWED\_THIS\_SHIFT** (verde expirou corretamente) |
