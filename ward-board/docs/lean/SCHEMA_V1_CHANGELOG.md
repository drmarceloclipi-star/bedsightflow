# SCHEMA\_V1\_CHANGELOG — BedSight

**Versão:** v1.0 | **Data:** 2026-02-28 | **Etapa:** 1.0 — Schema Patch

> Ref: LEAN\_CONTRACT\_HRHDS v1.0, LEAN\_STATE\_MACHINE\_HRHDS v1.0, LEAN\_SHIFTKEY\_SPEC\_HRHDS v1.0

---

## 1. Arquivos alterados

| Arquivo | Tipo | Resumo |
| --------- | ------ | -------- |
| `src/domain/shiftKey.ts` | **NOVO** | `computeShiftKey()`, `currentShiftKey()`, helpers Intl timezone-safe |
| `src/domain/types.ts` | **MODIFY** | Schema v1 completo (ver §2 abaixo) |
| `src/repositories/UnitSettingsRepository.ts` | **MODIFY** | Defaults v1, `setKamishibaiEnabled()`, `registerHuddle()` |
| `scripts/seed-data.ts` | **MODIFY** | settings/ops v1, 6 beds ricos, 1 bed legado, auto-v1 restante |
| `firestore.rules` | **INALTERADO** | Regras existentes já cobrem novos campos (ver §4) |

---

## 2. Campos adicionados

### 2.1 `src/domain/types.ts`

#### Tipos novos

| Tipo | Definição | Propósito |
| ------ | ----------- | ----------- |
| `TimestampLike` | `string \| Timestamp` | Alias unificado para campos de data |
| `KamishibaiStatus` | `'ok' \| 'blocked'` | Status v1 — sem `'na'` |
| `LegacyKamishibaiStatus` | `'ok' \| 'blocked' \| 'na'` | Leitura de docs v0 (não usar em writes) |
| `KamishibaiVisualState` | `'INACTIVE' \| 'NOT_APPLICABLE' \| 'UNREVIEWED_THIS_SHIFT' \| 'OK' \| 'BLOCKED'` | Estado visual derivado (nunca armazenado) |

#### `KamishibaiEntry` — campos adicionados

| Campo | Tipo | Obrigatório? | Default/Fallback | Propósito |
| ------- | ------ | ------------- | ----------------- | ----------- |
| `reviewedShiftKey` | `string?` | Não | ausente → `UNREVIEWED_THIS_SHIFT` | TTL do verde: turno da revisão |
| `reviewedAt` | `TimestampLike?` | Não | ausente → sem info | Timestamp da revisão no turno |
| `blockedAt` | `TimestampLike?` | Não | ausente → proxy `updatedAt` ⚠️ | Início do bloqueio (aging) |
| `resolvedAt` | `TimestampLike?` | Não | ausente → sem info | Quando o bloqueio foi resolvido |
| `reason` | `string?` | Não | `''` | Motivo mínimo do bloqueio |

> ⚠️ **Aviso:** quando `blockedAt` ausente, usar `updatedAt` como proxy de aging. Isso é comportamento temporário de compat v0 — deve ser logado com `console.warn` no Mission Control.

#### `Bed` — campos adicionados

| Campo | Tipo | Obrigatório? | Default/Fallback | Propósito |
| ------- | ------ | ------------- | ----------------- | ----------- |
| `applicableDomains` | `SpecialtyKey[]?` | Não | ausente → todos os 6 domínios aplicáveis | N/A Variante A (OD-2) |
| `mainBlockerBlockedAt` | `TimestampLike?` | Não | ausente → proxy `updatedAt` ⚠️ | Aging do mainBlocker (KPI1 Mission Control) |
| `mainBlockerResolvedAt` | `TimestampLike?` | Não | ausente → sem info | Quando mainBlocker foi zerado |

#### `UnitOpsSettings` — campos adicionados

| Campo | Tipo | Obrigatório? | Default/Fallback | Propósito |
| ------- | ------ | ------------- | ----------------- | ----------- |
| `kamishibaiEnabled` | `boolean?` | Não | ausente → `true` | Política de ferramenta Lean |
| `huddleSchedule` | `ShiftSchedule?` | Não | ausente → `{ amStart: '07:00', pmStart: '19:00' }` | Horários de turno |
| `lastHuddleAt` | `TimestampLike?` | Não | ausente → HUDDLE\_PENDING | Registro do último huddle |
| `lastHuddleType` | `'AM' \| 'PM'?` | Não | ausente → sem info | Tipo do huddle |
| `lastHuddleShiftKey` | `string?` | Não | ausente → HUDDLE\_PENDING | shiftKey do huddle (compara com current) |
| `lastHuddleRegisteredBy` | `ActorRef?` | Não | ausente → sem info | Quem registrou |
| `currentShiftType` | `'AM' \| 'PM'?` | Não | Reservado — não usar | Para uso futuro |

---

### 2.2 `src/domain/shiftKey.ts` — funções exportadas

| Exportação | Descrição |
| ----------- | ----------- |
| `ShiftType` | `'AM' \| 'PM'` |
| `ShiftSchedule` | `{ amStart: string; pmStart: string }` |
| `DEFAULT_SHIFT_SCHEDULE` | `{ amStart: '07:00', pmStart: '19:00' }` |
| `DEFAULT_SHIFT_TZ` | `'America/Sao_Paulo'` |
| `computeShiftKey(now, schedule?, tz?)` | Retorna `"YYYY-MM-DD-AM"` ou `"YYYY-MM-DD-PM"` |
| `currentShiftKey(schedule?, tz?)` | Atalho para `computeShiftKey(new Date())` |

---

### 2.3 `src/repositories/UnitSettingsRepository.ts` — métodos adicionados

| Método | Descrição |
| -------- | ----------- |
| `setKamishibaiEnabled(unitId, enabled, actor)` | Grava `kamishibaiEnabled` em `settings/ops` |
| `registerHuddle(unitId, huddleType, actor, schedule?)` | Grava os 4 campos `lastHuddle*` + calcula `shiftKey` automaticamente |

---

### 2.4 `scripts/seed-data.ts` — dados v1 adicionados

| Bed | Tipo | Dados presentes |
| ----- | ------ | ----------------- |
| `301.1` | ✅ v1 | `applicableDomains`, `reviewedShiftKey`, `blockedAt` em physio, `mainBlockerBlockedAt` |
| `301.2` | 🔀 misto | domains v1 + 2 dominios com `na` legado (physio/social) — testa compat em leito ativo |
| `301.3` | ✅ v1 | 4 domínios aplicáveis, todos verdes com `reviewedShiftKey` |
| `301.4` | 🕰️ legado | ok em todos, **sem `reviewedShiftKey`** → deve aparecer UNREVIEWED no renderer v1 |
| `302.1` | 🔀 misto | `blocked` com `blockedAt`, 3 domínios com `na` legado |
| `302.2` | 🦕 legado v0 | **Todos domains com `status: 'na'`** — documento canônico de teste de migração |
| Restantes | 🔄 auto-v1 | Geração automática: `reviewedShiftKey`, sem `na`, `applicableDomains` variado |

`settings/ops` da Unidade A seeded com:

```json
{
  "kanbanMode": "ACTIVE_LITE",
  "kamishibaiEnabled": true,
  "huddleSchedule": { "amStart": "07:00", "pmStart": "19:00" }
}
```

> `lastHuddleShiftKey` omitido intencionalmente → mostrará `HUDDLE_PENDING` quando UI for implementada.

---

## 3. Regras de compatibilidade v0 (fallbacks)

| Situação v0 | Comportamento v1 |
| ------------- | ----------------- |
| `kamishibai.{domain}.status === 'na'` em leito vazio | → `INACTIVE` (prec. 1) |
| `kamishibai.{domain}.status === 'na'` em domínio fora de `applicableDomains` | → `NOT_APPLICABLE` (prec. 3) |
| `kamishibai.{domain}.status === 'na'` em domínio aplicável | → `UNREVIEWED_THIS_SHIFT` (conservador) |
| `kamishibai.{domain}.status === 'ok'` sem `reviewedShiftKey` | → `UNREVIEWED_THIS_SHIFT` (verde não válido sem carimbo) |
| `settings/ops` doc inexistente | → defaults: `{ kanbanMode: 'PASSIVE', kamishibaiEnabled: true, huddleSchedule: DEFAULT }` |
| `kamishibaiEnabled` ausente no doc | → `true` (compat v0 — ativo por padrão) |
| `blockedAt` ausente em bed com `status=blocked` | → usar `updatedAt` como proxy ⚠️ (log warning) |
| `mainBlockerBlockedAt` ausente em bed com `mainBlocker` | → usar `updatedAt` como proxy ⚠️ |
| `applicableDomains` ausente | → todos os 6 domains KAMISHIBAI\_DOMAINS são aplicáveis |

---

## 4. Firestore Rules — por que não foi alterado

A regra existente para `settings/{doc}`:

```text
match /units/{unitId}/settings/{doc} {
  allow read: if isUnitMember(unitId);
  allow write: if isUnitAdmin(unitId);
}
```

Esta regra usa um wildcard `{doc}` que cobre tanto `settings/board` quanto `settings/ops`. O Firestore não tem field-level security — qualquer campo pode ser escrito num path com permissão de write. Logo:

- ✅ `kamishibaiEnabled` pode ser escrito no `settings/ops` existente
- ✅ `lastHuddle*` pode ser escrito no `settings/ops` existente
- ✅ `huddleSchedule` pode ser escrito no `settings/ops` existente
- ✅ Campos novos em `beds/{bedId}` (`applicableDomains`, `mainBlockerBlockedAt`, etc.) já cobertos pela regra de beds

**Nenhuma alteração necessária** na Etapa 1.0.

---

## 5. O que esta etapa NÃO faz

> **Regra da Etapa 1.0:** infraestrutura apenas. UI inalterada.

- ❌ A TV/Editor **não usa** `resolveKamishibaiVisualState()` ainda — isso é **Etapa 1.1**
- ❌ O renderer Kamishibai ainda pode usar `entry?.status || 'na'` — **não alterado** nesta etapa
- ❌ Mission Control ainda usa `updatedAt` como proxy de aging — **Etapa 1.1**
- ❌ O badge "Huddle Pendente" na TV **não existe** ainda — **Etapa 1.1**
- ❌ O botão "Registrar Huddle" na UI **não existe** ainda — **Etapa 1.2**
- ❌ A função `setKamishibaiEnabled()` não tem UI ainda — **Etapa 1.2**

---

## 6. Critério de "done" da Etapa 1.0

- [x] `src/domain/shiftKey.ts` com `computeShiftKey()` + 7 exemplos canônicos comentados
- [x] `src/domain/types.ts` com `KamishibaiEntry` expandida, `UnitOpsSettings` expandida, `applicableDomains`, `mainBlockerBlockedAt`, `KamishibaiVisualState`
- [x] `scripts/seed-data.ts` com `settings/ops`, 6 beds v1 (ricos + legados), 1 bed puro legado v0, auto-v1 para restantes
- [x] `src/repositories/UnitSettingsRepository.ts` com defaults v1 e métodos `setKamishibaiEnabled()` + `registerHuddle()`
- [x] `firestore.rules` — sem alteração necessária (análise documentada acima)
- [x] Nenhuma alteração de UI (TV/Editor/Mission Control)
