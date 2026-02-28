# MISSION_CONTROL_V1_ACCEPTANCE — 2026-02-28

**Missão:** tornar Mission Control confiável e Lean-alinhado.  
**tsc --noEmit:** ✅ 0 erros (verificado 2026-02-28)

---

## Checklist MC1–MC6

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| MC1 | Aging KPI1 usa `mainBlockerBlockedAt` quando presente; fallback gera `warnings[]` quando ausente | ✅ | Cloud Function linhas 142–162 |
| MC2 | Freshness não depende mais de `bed.updatedAt` | ✅ | CF usa `max(kamishibai.{domain}.reviewedAt)` por bed |
| MC3 | "Não revisados neste turno" aparece e conta correto | ✅ | Card `unreviewed_shift` em MissionControlTab (só se kamishibaiEnabled=true) |
| MC4 | Thresholds podem ser alterados via `settings/mission_control` sem mudar código | ✅ | Firestore doc seeded; CF faz merge com defaults |
| MC5 | `kamishibaiEnabled=false` → cards Kamishibai somem ou zeram | ✅ | `kamishibaiEnabled` retornado no payload; UI condicionada |
| MC6 | E2E manual: seed mostra warning (fallback) e aging real | ✅ | Bed 302.2 (sem blockedAt) → warning; Bed 301.2 (blockedAt=14h) → aging real |

---

## Exemplos JSON

### Payload do Snapshot (campos v1 adicionais)

```json
{
  "generatedAt": "2026-02-28T22:00:00.000Z",
  "source": "snapshot_firestore",
  "definitionsVersion": "v1",
  "totalBedsCount": 33,
  "activeBedsCount": 29,
  "blockedBedsCount": 8,
  "maxBlockedAgingHours": 30,
  "stale24hBedsCount": 4,
  "staleBedIdsByBucket": { "h12": [...], "h24": [...], "h48": [...] },
  "kamishibaiImpedimentBedsCount": 5,
  "dischargeNext24hCount": 4,
  "topBlockerNow": { "name": "Aguardando laudo RX", "bedCount": 3, "share": 38 },

  "thresholdsUsed": {
    "blockedPctWarning": 20,
    "blockedPctCritical": 35,
    "kamishibaiImpedimentPctWarning": 15,
    "kamishibaiImpedimentPctCritical": 30,
    "freshness12hWarningCount": 5,
    "freshness24hWarningCount": 1,
    "freshness24hCriticalCount": 3,
    "freshness48hCriticalCount": 1,
    "unreviewedShiftWarningCount": 3,
    "unreviewedShiftCriticalCount": 6
  },

  "warnings": [
    "WARN_BLOCKED_AT_MISSING: bed_302.2 used updatedAt as proxy for aging"
  ],

  "unreviewedBedsCount": 12,
  "unreviewedBedIds": ["bed_301.4", "bed_302.2", "..."],
  "unreviewedByDomainCount": {
    "medical": 4,
    "nursing": 3,
    "physio": 7,
    "nutrition": 2,
    "psychology": 5,
    "social": 6
  },
  "kamishibaiImpedimentsByDomainCount": {
    "physio": 3,
    "medical": 2
  },
  "kamishibaiMaxBlockedAgingHours": 14,
  "blockedAgingFallbackBedIds": ["bed_302.2"],
  "kamishibaiEnabled": true
}
```

### Antes e depois da freshness (MC2)

**v0 (bug):** `age = now - bed.updatedAt` — inclui qualquer edição no leito, mesmo sem revisão Kamishibai.

**v1 (correto):** `refMs = max(kamishibai.{domain}.reviewedAt)` — se nenhum `reviewedAt` → bucket 48h (conservador).

---

## Reprodução no Emulador

### Pré-condição

```bash
# Terminal 1: emulador rodando
cd ward-board && npm run emulators

# Terminal 2: seed v1
npm run seed
```

### MC1 — Aging real vs proxy

1. Emulador Firestore UI → `units/A/beds/bed_302.2`
2. Verificar: `mainBlockerBlockedAt` ausente (bed legado v0)
3. Chamar `getAdminMissionControlSnapshot` via Mission Control tab
4. Snapshot retornado deve ter:
   - `blockedAgingFallbackBedIds: ["bed_302.2"]`
   - `warnings: ["WARN_BLOCKED_AT_MISSING: bed_302.2 used updatedAt as proxy for aging"]`
   - Notice amarelo aparece na UI: "1 leito(s) sem mainBlockerBlockedAt"
5. Editar `bed_301.2` → `mainBlockerBlockedAt` = `new Date(Date.now() - 14*3600*1000).toISOString()`
6. Atualizar snapshot → `blockedAgingHoursByBedId.bed_301.2 ≈ 14` (real, não proxy)

### MC2 — Freshness por reviewedAt

1. `units/A/beds/bed_301.4`: todos os domínios sem `reviewedAt` (status 'ok' legado v0)
2. Snapshot → `bed_301.4` em `staleBedIdsByBucket.h48` (conservador sem reviewedAt)
3. Editar via Editor → OK em physio → `reviewedAt` gravado automaticamente
4. Snapshot → `bed_301.4` sai do bucket 48h se `reviewedAt` < 12h atrás

### MC3 — Não revisados neste turno

1. Seed gera bed `301.4` com todos os domínios sem `reviewedShiftKey`
2. Snapshot → `unreviewedBedsCount` inclui `bed_301.4`
3. Card "Não revisados" aparece na UI com warning
4. Drill-down: `?filter=unreviewed_shift` → lista beds
5. Registrar um bed via Editor no turno atual → sai da lista

### MC4 — Thresholds configuráveis

1. Firestore UI → `units/A/settings/mission_control`
2. Alterar `blockedPctWarning` de 20 → 5
3. Atualizar snapshot → card KPI1 passa para warning com qualquer % > 5
4. Restaurar 20 → volta ok

### MC5 — kamishibaiEnabled=false

1. Firestore UI → `units/A/settings/ops` → `kamishibaiEnabled = false`
2. Snapshot → `kamishibaiEnabled: false`
3. Card "Não revisados" some da UI
4. `unreviewedBedsCount: 0` no payload

### MC6 — E2E manual completo

```bash
# Verificar todos os KPIs com seed limpo
npm run seed  # reset completo
# Acessar http://localhost:5173/admin/unit/A/analytics
# Mission Control tab → deve mostrar:
# - KPI1: beds bloqueados (~2 com aging real, 1 com *)
# - Freshness: beds em bucket 24/48h (base em reviewedAt)
# - "Não revisados neste turno": ≥ 1 bed (bed_301.4)
# - Notice amarelo: "1 leito(s) sem mainBlockerBlockedAt"
```

---

## Arquivos alterados

| Arquivo | Tipo | Resumo |
|---------|------|--------|
| `src/domain/missionControl.ts` | NOVO | Interface + defaults + status helpers |
| `src/domain/analytics.ts` | MODIFY | MissionControlSnapshot estendida com campos v1 opcionais |
| `functions/src/callables/analytics/getAdminMissionControlSnapshot.ts` | MODIFY | Aging real (mainBlockerBlockedAt), freshness por reviewedAt, thresholds Firestore, unreviewedBedsCount |
| `src/features/admin/components/analytics/MissionControlTab.tsx` | MODIFY | Thresholds dinâmicos do snapshot; card "Não revisados"; data quality notice; kamishibaiEnabled |
| `src/features/admin/screens/AnalyticsListScreen.tsx` | MODIFY | Filtros v1: `unreviewed_shift` (shiftKey client-side) e `blocked_aging` (mainBlockerBlockedAt real) |
| `src/features/admin/components/analytics/AnalyticsContract.tsx` | MODIFY | AnalyticsWindow + 'turno atual' |
| `scripts/seed-data.ts` | MODIFY | +settings/mission_control com thresholds; bed 302.2 sem blockedAt (força warning) |
| `Firestore: units/A/settings/mission_control` | NOVO doc | Thresholds configuráveis por unidade |

---

## O que NÃO mudou

- BigQuery — intocado
- TV/Editor — intocados (Etapas 1.1/1.2 intactas)
- `firestore.rules` — intocado
- Kanban — intocado
- Rotas — intocadas
