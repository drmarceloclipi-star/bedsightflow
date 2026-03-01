# Escalation Canonicalization — Acceptance Criteria & Evidence

**Date:** 2026-02-28
**Feature:** Single source of truth for handling "Escalations" across Admin (AnalyticsListScreen, Mission Control snapshot) and TV screens.

## 1. Acceptance Criteria

| ID | Criterion | How to Verify | Status |
| --- | --- | --- | --- |
| AC-1 | Single Canonical Calculation | Verify that both Cloud Functions and TV use `src/domain/escalation.ts` or `shared/escalation.ts`. No manual iteration loops exist scattered in UI/CFs. | ✅ |
| AC-2 | TV Header Consolidation | The TV Header displays escalations equal to `overdueCritical` + `blockerCritical`. | ✅ |
| AC-3 | Mission Control UI & CF | Cloud Function `getAdminMissionControlSnapshot` uses the shared module to compute KPIs. UI accesses standard structure (e.g. `escalations.overdueCriticalBedIds.length`). | ✅ |
| AC-4 | Missing Data Resiliency | If `settings/mission_control` is missing, default thresholds are used correctly. | ✅ |
| AC-5 | Seed Data Proof | `scripts/seed-data.ts` explicitly creates test beds matching Escalation logic (> 12h open pendency, > 24h main blocker). | ✅ |

## 2. Evidence

- ✅ Canonical pure functions and interfaces moved to `domain/escalation.ts` and `functions/src/shared/escalation.ts`.
- ✅ The snapshot generation function relies exclusively on the shared `computeEscalations`.
- ✅ TV Dashboard was stripped of its nested loops and now purely invokes `computeEscalations` passing the array of beds.
- ✅ Specific test cases (ESCALATION-01 and ESCALATION-02) were placed into `seed-data.ts` guaranteeing the mock database will boot with the exact necessary bounds for Critical and Warning scenarios.
