# HUDDLE_V1_ACCEPTANCE — 2026-02-28

**Objetivo:** verificar a implementação mínima de cadência Lean (Huddle AM/PM) na Etapa 1.2.

---

## 1. Critérios de Aceite (H1–H5)

| # | Critério | Status |
| --- | ---------- | -------- |
| H1 | Clicar "Registrar Huddle AM" grava os 4 campos: `lastHuddleAt`, `lastHuddleType`, `lastHuddleShiftKey`, `lastHuddleRegisteredBy` | ✅ `registerHuddle()` confirmado |
| H2 | TV mostra "HUDDLE PENDENTE" quando `lastHuddleShiftKey !== currentShiftKey` (ou ausente) | ✅ badge via `useMemo` |
| H3 | Após registrar huddle do turno atual, badge some imediatamente (realtime via `onSnapshot`) | ✅ `subscribeUnitOpsSettings` já ativo no TvDashboard |
| H4 | Nenhuma regressão no renderer v1 do Kamishibai | ✅ `tsc --noEmit` 0 erros |
| H5 | Nenhum impacto em Kanban / rotação | ✅ badge é camada visual externa, não toca TvRotationContainer |

---

## 2. JSON de `settings/ops` — antes/depois

### Antes (sem huddle)

```json
{
  "kanbanMode": "PASSIVE",
  "kamishibaiEnabled": true,
  "huddleSchedule": { "amStart": "07:00", "pmStart": "19:00" }
}
```

### Depois de `Registrar Huddle AM`

```json
{
  "kanbanMode": "PASSIVE",
  "kamishibaiEnabled": true,
  "huddleSchedule": { "amStart": "07:00", "pmStart": "19:00" },
  "lastHuddleAt": "2026-02-28T10:15:00.000Z",
  "lastHuddleType": "AM",
  "lastHuddleShiftKey": "2026-02-28-AM",
  "lastHuddleRegisteredBy": { "id": "uid-abc", "name": "Dr. Silva" },
  "updatedAt": "<serverTimestamp>"
}
```

---

## 3. Passo-a-Passo — Reprodução no Emulador

```bash
# 1. Subir emulador + seed
cd /Users/marcelocavalcanti/Downloads/LEAN/ward-board
npm run emulators       # ou: firebase emulators:start
npx ts-node scripts/seed-data.ts

# 2. Subir app
npm run dev

# 3. TV — verificar badge HUDDLE PENDENTE
# Abrir: http://localhost:5173/tv?unit=A
# Confirmar: badge amarelo "⚠ HUDDLE PENDENTE — Nenhum huddle registrado neste turno"

# 4. Admin → Ops — registrar huddle
# Abrir: http://localhost:5173/admin?unit=A → aba Ops
# Clicar: "Registrar Huddle AM"
# Confirmar toast: "✓ Huddle AM registrado às HH:MM"

# 5. TV — badge some (realtime)
# Voltar para http://localhost:5173/tv?unit=A
# Confirmar: badge desapareceu (lastHuddleShiftKey agora = currentShiftKey)

# 6. Simular virada de turno (TTL do huddle)
# No emulador Firestore, editar settings/ops:
#   lastHuddleShiftKey = "2026-02-27-PM"  (turno anterior)
# Confirmar: badge reaparece com "Último: AM há Xh"
```

---

## 4. Arquivos alterados

| Arquivo | Tipo | Resumo |
| --------- | ------ | -------- |
| `src/repositories/UnitSettingsRepository.ts` | validado | `registerHuddle()` correto, 4 campos, computeShiftKey |
| `src/features/tv/pages/TvDashboard.tsx` | MODIFY | `useMemo(huddlePending, huddleSubtext)` + badge JSX |
| `src/features/admin/screens/OpsScreen.tsx` | MODIFY | seção "Cadência Huddle", botões AM/PM, handler, toast |

---

## 5. O que NÃO mudou

- `TvRotationContainer` — intocado (badge está fora da rotação)
- `KamishibaiScreen` — intocado nesta etapa
- Mission Control, Analytics, Kanban, Firestore rules — intocados
- `huddleSchedule` — somente lido nesta etapa (sem UI de configuração)
