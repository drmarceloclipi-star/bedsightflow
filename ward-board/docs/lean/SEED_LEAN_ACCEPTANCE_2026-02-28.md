# Seed Lean Acceptance v2 — 2026-02-28

Gate de aceite do seed determinístico v2 (36 beds canônicos) para a Lean Suite.

---

## Checklist de Determinismo

| Critério | Status |
| :--- | :---: |
| Zero `Math.random()` | ✅ |
| Zero `Date.now()` | ✅ |
| Zero `new Date()` livre | ✅ |
| Clock base único e explícito (`MOCK_NOW_ISO`) | ✅ |
| PRNG seedado com string fixa (LCG + djb2 hash) | ✅ |
| 36 beds canônicos definidos como lista fixa | ✅ |
| 8 perfis especiais em beds reais | ✅ |
| IDs de pendências especiais fixos e legíveis | ✅ |
| IDs de pendências genéricas derivadas do bedId | ✅ |
| IDs de huddles fixos | ✅ |
| `settings/ops.lastHuddleShiftKey = CURRENT_SHIFT_KEY` | ✅ |
| Threshold keys batem com `missionControl.ts` e snapshot CF | ✅ |

---

## Comando de Execução

```bash
# Pré-requisito: emuladores rodando
npm run emulators   # em outro terminal

# Executar seed determinístico
npm run seed:lean
```

### Output Esperado (linhas-chave)

```text
🌱 [seed:lean v2] Starting DETERMINISTIC Lean Seed — 36 beds...
   mockNow = 2026-03-01T01:00:00.000Z (BRT 2026-02-28T22:00:00-03:00)
   currentShiftKey = 2026-02-28-PM

👤 [seed:lean] Ensuring auth users...
  ✅ Created: admin@lean.com (admin)
  ✅ Created: editor@lean.com (editor)
  ✅ Created: viewer@lean.com (viewer)

🛏️  [seed:lean] Seeding 36 beds...
  ✅ 36 beds seeded (8 special + 28 generic prng)

🗣️  [seed:lean] Seeding huddles...
  ✅ Prev Huddle (HUDDLE_2026-02-27-PM) seeded
  ✅ AM Huddle (HUDDLE_2026-02-28-AM) seeded

✨ [seed:lean v2] DONE!
  beds:             36 total
  special beds:     301.1, 301.2, 301.3, 302.1, 303, 304.1, 304.2, 308
```

---

## Comprovação: 36 Beds Criados

Verificar no Emulator UI `http://localhost:4000` → Firestore → `units/A/beds`:

| Prefixo | Quantidade |
| :--- | :---: |
| 301.x | 4 |
| 302.x | 3 |
| 303 | 1 |
| 304.x | 3 |
| 305.x | 4 |
| 306.x | 3 |
| 307.x | 4 |
| 308 | 1 |
| 309.x | 3 |
| 310.x | 2 |
| 311.x | 3 |
| 312.x | 3 |
| 313.x | 2 |
| **Total** | **36** |

---

## Comprovação: Perfis Especiais

| Bed | Asserção |
| :--- | :--- |
| `bed_301.1` | `kamishibai.medical.reviewedShiftKey === '2026-02-28-AM'` (todos os domínios) |
| `bed_301.2` | `applicableDomains` não inclui `psychology` nem `social` |
| `bed_301.3` | 4 pendências: `PEND_3013_A1` (open), `PEND_3013_A2_OVERDUE` (open+dueAt), `PEND_3013_A3_DONE`, `PEND_3013_A4_CANCELED` |
| `bed_302.1` | `mainBlocker` preenchido; `kamishibai.medical.status === 'blocked'` |
| `bed_303` | `pendencies[0].dueAt` < `MOCK_NOW - 12h` → overdue critical |
| `bed_304.1` | `mainBlockerBlockedAt` < `MOCK_NOW - 24h` → blocker critical |
| `bed_304.2` | tanto dueAt overdue quanto mainBlockerBlockedAt overdue |
| `bed_308` | `patientAlias === ''` → INACTIVE |

---

## Comprovação: Settings Corretos

```text
settings/ops.lastHuddleShiftKey    = "2026-02-28-PM"  ← CURRENT_SHIFT_KEY
settings/mission_control.escalationOverdueHoursCritical      = 12
settings/mission_control.escalationMainBlockerHoursCritical  = 24
```

---

## Comprovação: Idempotência

Executar `npm run seed:lean` duas vezes → o mesmo documento `bed_303` deve ter o mesmo `pendencies[0].dueAt` nas duas execuções.

> Nota para E2E: usar `page.clock.install({ time: new Date('2026-03-01T01:00:00.000Z') })` para sincronizar o relógio do Playwright com `MOCK_NOW_ISO`.
