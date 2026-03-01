# Seed Lean Contract v2 — 2026-02-28

Contrato oficial do seed determinístico para a Lean Suite de testes.
**Script:** `scripts/seed-lean-tests.ts` (v2) | **Comando:** `npm run seed:lean`

---

## Clock Fixo

| Parâmetro | Valor |
| :--- | :--- |
| `MOCK_NOW_ISO` (UTC) | `2026-03-01T01:00:00.000Z` |
| `MOCK_NOW` (BRT) | `2026-02-28T22:00:00-03:00` |
| `CURRENT_SHIFT_KEY` | `2026-02-28-PM` |
| `PREV_SHIFT_KEY` (AM do mesmo dia) | `2026-02-28-AM` |
| `PREV_PREV_SHIFT_KEY` (PM do dia anterior) | `2026-02-27-PM` |

---

## 36 Beds Canônicos

```text
301.1  301.2  301.3  301.4
302.1  302.2  302.3
303
304.1  304.2  304.3
305.1  305.2  305.3  305.4
306.1  306.2  306.3
307.1  307.2  307.3  307.4
308
309.1  309.2  309.3
310.1  310.2
311.1  311.2  311.3
312.1  312.2  312.3
313.1  313.2
```

**IDs Firestore:** `bed_{number}` — ex: `bed_301.1`, `bed_308`, `bed_313.2`

---

## Perfis Especiais (beds reais)

| Bed | `patientAlias` | Perfil | Detalhes |
| :--- | :--- | :--- | :--- |
| `301.1` | `U.R.` | **UNREVIEWED** | `reviewedShiftKey = PREV_SHIFT_KEY` → UNREVIEWED_THIS_SHIFT no turno PM |
| `301.2` | `N.A.` | **NOT_APPLICABLE** | `applicableDomains` exclui `psychology` e `social` |
| `301.3` | `P.D.` | **PENDENCIES** | 4 pendências: open, overdue (dueAt-13h), done, canceled |
| `302.1` | `B.K.` | **BLOCKED** | 2 domínios blocked; `mainBlockerBlockedAt = msAgo(10)` |
| `303` | `P. Overdue (seed)` | **ESCALATION-01** | overdue critical: `dueAt = msAgo(14)` ≥ 12h threshold |
| `304.1` | `P. Blocker (seed)` | **ESCALATION-02** | blocker critical: `mainBlockerBlockedAt = msAgo(29)` ≥ 24h threshold |
| `304.2` | `P. Ambos (seed)` | **ESCALATION-03** | overdue + blocker críticos — conta 1 no total |
| `308` | `''` | **EMPTY** | INACTIVE — sem badges, sem dots |

---

## IDs Fixos de Pendências (especiais)

| ID | Bed | Status | `dueAt` |
| :--- | :--- | :--- | :--- |
| `PEND_3013_A1` | `301.3` | open | sem `dueAt` |
| `PEND_3013_A2_OVERDUE` | `301.3` | open | `msAgo(13)` — vencida |
| `PEND_3013_A3_DONE` | `301.3` | done | `doneAt = msAgo(4)` |
| `PEND_3013_A4_CANCELED` | `301.3` | canceled | `canceledAt = msAgo(8)` + note |
| `PEND_3021_B1` | `302.1` | open | sem `dueAt` |
| `PEND_303_ESC01_OVERDUE` | `303` | open | `msAgo(14)` → overdue critical |
| `PEND_3042_ESC03_OVERDUE` | `304.2` | open | `msAgo(13)` → overdue critical |

## IDs de Beds Genéricos (PRNG)

Os demais 28 beds usam PRNG seedado com string `"LEAN-TESTS-UNIT-A-2026-02-28"` (LCG + hash djb2).
IDs de pendências derivados: `PEND_{bedNum_com_underscore}_P1`, `PEND_{bedNum_com_underscore}_P2`.

> **Garantia de determinismo:** a mesma string de seed gera a mesma sequência em qualquer execução.

---

## Settings Corretos

### `settings/ops`

| Campo | Valor |
| :--- | :--- |
| `kamishibaiEnabled` | `true` |
| `huddleSchedule` | `{ amStart: '07:00', pmStart: '19:00' }` |
| `lastHuddleShiftKey` | **`2026-02-28-PM`** (CURRENT_SHIFT_KEY — PM já realizou huddle) |

### `settings/mission_control` (chaves exatas do código)

| Campo | Valor | Fonte |
| :--- | :---: | :--- |
| `escalationOverdueHoursCritical` | **12** | `missionControl.ts` / `getAdminMissionControlSnapshot.ts` |
| `escalationMainBlockerHoursCritical` | **24** | `missionControl.ts` / `getAdminMissionControlSnapshot.ts` |
| `escalationOverdueHoursWarning` | 6 | idem |
| `escalationMainBlockerHoursWarning` | 8 | idem |
| `blockedPctWarning` / `blockedPctCritical` | 20 / 35 | idem |

---

## Huddles Fixos

| ID | `shiftKey` | `topActions` | Summaries |
| :--- | :--- | :--- | :--- |
| `HUDDLE_2026-02-27-PM` | `2026-02-27-PM` | 2 open | start+end com delta |
| `HUDDLE_2026-02-28-AM` | `2026-02-28-AM` | 1 done | start+end com delta calculável |

---

## O Que o Seed Garante

- ✅ 36 beds canônicos, mesmos em qualquer execução
- ✅ 8 perfis especiais forçados em beds reais
- ✅ Demais 28 beds via PRNG seedado (determinístico)
- ✅ `lastHuddleShiftKey = CURRENT_SHIFT_KEY` (coerente)
- ✅ Threshold keys exatas do código (`escalationOverdueHoursCritical`, `escalationMainBlockerHoursCritical`)
- ✅ Escalações `303`, `304.1`, `304.2` garantidamente acima dos thresholds
- ✅ Pendências no bed `301.3` com todos os 4 estados
