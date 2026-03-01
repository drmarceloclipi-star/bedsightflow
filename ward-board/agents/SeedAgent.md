# SeedAgent: Data & Seed Specialist

The SeedAgent manages the creation and maintenance of seed data, Firestore data migrations, and test fixtures to ensure consistent and realistic data across all environments.

## Specializations

- **Seed Scripts**: Writing and updating `seed-data.ts` scripts that populate the Firebase Emulator with realistic hospital data.
- **Data Migrations**: Creating scripts to safely transform or migrate Firestore data when the schema evolves.
- **Test Fixtures**: Providing consistent, reproducible datasets for E2E tests and QA sessions.
- **Data Modeling**: Collaborating with DatabaseAgent to ensure seed data reflects the current domain model accurately.
- **Multi-Environment**: Managing separate seed profiles for dev, staging, and production demos.

## Technical Stack

- TypeScript
- Firebase Admin SDK
- Firebase Emulator Suite
- Node.js scripts

---

## Estado Atual — seed-data.ts (v1.1, 2026-02-28) — seed normal (com random)

Arquivo: `scripts/seed-data.ts` | Comando: `npm run seed`

**Propósito:** Uso em desenvolvimento/demo. Gera cenários com dados realistas e variação (Math.random). NÃO usar para E2E automatizados.

### Helpers Atuais

```typescript
const SEED_ACTOR = { id: 'seed', name: 'System Seed' };  // extraído como constante

const makePendency = (
    title: string,
    status: 'open' | 'done' | 'canceled',
    opts: { domain?, dueAt?, doneAt?, canceledAt?, note? } = {}
): PendencyDoc => { ... }
// - Se status='done' && opts.doneAt → preenche doneAt/doneBy/updatedAt/updatedBy
// - Se status='canceled' && opts.canceledAt → preenche canceledAt/canceledBy/updatedAt/updatedBy
```

```typescript
// makeKamishibaiEntry: gera entry v1 completo
function makeKamishibaiEntry(status: 'ok' | 'blocked', updatedAt: string) {
    // inclui: status, updatedAt, updatedBy, note, reviewedShiftKey, reviewedAt
    // se blocked: adiciona blockedAt (1–18h atrás), reason
}
```

### Perfis de Bed com Pendências

| Bed | Pendências | Cenário testado |
|---|---|---|
| `301.1` | 1 open (sem prazo) | open sem overdue badge |
| `301.2` | 2 open (1 vencida: `dueAt = ontem`) | overdue detectado pelo renderer |
| `301.3` | 1 **canceled** (com `canceledAt/canceledBy/note`) | histórico preservado; não conta nos KPIs |
| `302.1` | 1 done | não aparece em filtros open/overdue |
| `302.2` | 2 open vencidas | aparece em `pendencies_open` + `pendencies_overdue` |

### Kamishibai v1 — Perfis Especiais

| Bed | Cenário | Comportamento esperado na UI |
|---|---|---|
| `301.4` | `ok` SEM `reviewedShiftKey` (v0 legado) | UNREVIEWED_THIS_SHIFT (sem cor) — migração conservadora |
| `301.3` | `na` nos domínios psychology/social (legado) | NOT_APPLICABLE (sem dot) |
| `302.x` | Bloqueado há > 18h | aging real visível no Mission Control |

### Dívida SeedAgent v1.2

- Verificar se `totalBedsCount` deve ser 33 ou 36 — seed atual pode estar excluindo leitos vazios do perfil aleatório.
- Adicionar perfil de bed **completamente vazio** (sem `patientAlias`) para testar estado INACTIVE na UI.

---

## seed:lean — Seed Determinístico para Testes (v2.0, 2026-03-01)

Arquivo: `scripts/seed-lean-tests.ts` | Comando: `npm run seed:lean`

**Propósito:** Seed com clock fixo e 36 leitos canônicos reais para E2E/Unit tests automatizados.
Zero `Math.random()`, zero `Date.now()`. PRNG seedado (LCG djb2) para beds genéricos.
**Ref:** `docs/lean/SEED_LEAN_CONTRACT_2026-02-28.md` | `docs/lean/SEED_LEAN_ACCEPTANCE_2026-02-28.md`

### Clock Fixo

```typescript
const MOCK_NOW_ISO       = '2026-03-01T01:00:00.000Z'; // = 2026-02-28T22:00:00 BRT
const CURRENT_SHIFT_KEY  = '2026-02-28-PM';
const PREV_SHIFT_KEY     = '2026-02-28-AM';
const PREV_PREV_SHIFT_KEY = '2026-02-27-PM';
```

### 36 Beds Canônicos

```
301.1  301.2  301.3  301.4 | 302.1  302.2  302.3 | 303
304.1  304.2  304.3 | 305.1  305.2  305.3  305.4 | 306.1  306.2  306.3
307.1  307.2  307.3  307.4 | 308   | 309.1  309.2  309.3
310.1  310.2 | 311.1  311.2  311.3 | 312.1  312.2  312.3 | 313.1  313.2
```

IDs Firestore: `bed_{number}` — ex: `bed_301.1`, `bed_308`.

### Perfis Especiais (beds reais)

| Bed | `patientAlias` | Perfil | Detalhe |
|---|---|---|---|
| `301.1` | `U.R.` | UNREVIEWED | `reviewedShiftKey = PREV_SHIFT_KEY` em todos os domínios |
| `301.2` | `N.A.` | NOT_APPLICABLE | `applicableDomains` exclui `psychology` e `social` |
| `301.3` | `P.D.` | PENDENCIES | 4 pendências: open, overdue (dueAt-13h), done, canceled |
| `302.1` | `B.K.` | BLOCKED | 2 domínios blocked; `mainBlockerBlockedAt=msAgo(10)` |
| `303` | `P. Overdue` | ESCALATION-01 | `dueAt=msAgo(14)` ≥ 12h threshold → overdue critical |
| `304.1` | `P. Blocker` | ESCALATION-02 | `mainBlockerBlockedAt=msAgo(29)` ≥ 24h threshold → blocker critical |
| `304.2` | `P. Ambos` | ESCALATION-03 | overdue + blocker críticos — conta 1 no total |
| `308` | `''` | EMPTY | `patientAlias=''` → INACTIVE |

### IDs Fixos de Pendências Especiais

| ID | Bed | Estado |
|---|---|---|
| `PEND_3013_A1` | `301.3` | open sem dueAt |
| `PEND_3013_A2_OVERDUE` | `301.3` | open, `dueAt=msAgo(13)` |
| `PEND_3013_A3_DONE` | `301.3` | done |
| `PEND_3013_A4_CANCELED` | `301.3` | canceled + note |
| `PEND_303_ESC01_OVERDUE` | `303` | open, `dueAt=msAgo(14)` → escalona |
| `PEND_3042_ESC03_OVERDUE` | `304.2` | open, `dueAt=msAgo(13)` → escalona |

### Beds Genéricos (PRNG)

28 beds restantes gerados via PRNG seedado `"LEAN-TESTS-UNIT-A-2026-02-28"`:

- 75% ocupados, 25% vazios
- Kamishibai: 85% ok, 15% blocked por domínio; 50% revisados no turno atual
- Pendências: 0–2 por bed; IDs `PEND_{bedNum_underscored}_P1`/`P2`
- mainBlocker < 24h (não escalona acidentalmente)

### Settings Corretos

```
settings/ops.lastHuddleShiftKey = "2026-02-28-PM"  (CURRENT_SHIFT_KEY)
settings/mission_control.escalationOverdueHoursCritical     = 12
settings/mission_control.escalationMainBlockerHoursCritical = 24
```

> **Chaves exatas** lidas por `parseMissionControlThresholds` e `computeEscalations` —
> não usar nomes alternativos como `escalationOverdueThresholdHours`.

### Huddles (IDs Fixos)

| ID | shiftKey | topActions | Summaries |
|---|---|---|---|
| `HUDDLE_2026-02-27-PM` | `2026-02-27-PM` | 2 open | start+end com delta |
| `HUDDLE_2026-02-28-AM` | `2026-02-28-AM` | 1 done | start+end com delta calculável |
