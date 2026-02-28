# AUDIT — Mission Control

**Data:** 2026-02-28 | **Auditor:** Agente Antigravity | **Missão:** somente leitura

---

## 1. Localização na UI

| Rota | Componente | Arquivo |
|------|-----------|---------|
| `/admin/unit/{unitId}` → aba Analytics → tab "Mission Control" | `AnalyticsScreen` → `MissionControlTab` | `src/features/admin/screens/AnalyticsScreen.tsx` |

**Não existe rota dedicada `/admin/mission-control`** — é uma aba dentro de Analytics.

---

## 2. Spec reverso — KPI → Query → Transformação → Componente

### Cloud Function responsável

`getAdminMissionControlSnapshot` — region `southamerica-east1`

**Fonte de dados:** Firestore live (`units/{unitId}/beds`) — **NÃO BigQuery**.

**Evidência:** [`functions/src/callables/analytics/getAdminMissionControlSnapshot.ts`](../../../functions/src/callables/analytics/getAdminMissionControlSnapshot.ts)

---

### KPI 1 — Bloqueados Agora

| Item | Valor |
|------|-------|
| **Métrica** | Leitos com `mainBlocker.trim() !== ''` E `patientAlias !== ''` |
| **Universo N** | Leitos ativos (com paciente) |
| **Cálculo** | `blockedBedsCount / activeBedsCount * 100` |
| **Threshold OK** | `< 20%` |
| **Threshold WARNING** | `20% – 35%` |
| **Threshold CRITICAL** | `> 35%` |
| **Drill-down** | `/admin/unit/{unitId}/analytics/lists?filter=blocked_now` |
| **Countermeasure** | "Rodar huddle de bloqueios (10 min) e atacar top 3 causas do dia." |
| **Contrato** | `blockedBedsCount`, `blockedBedIds`, `blockedAgingHoursByBedId` |

**Evidência thresholds:** `MissionControlTab.tsx:16-19`

```typescript
function blockedStatus(pct: number): KpiStatus {
    if (pct > 35) return 'critical';
    if (pct > 20) return 'warning';
    return 'ok';
}
```

---

### KPI 2 — Freshness (3 sub-KPIs)

| Sub-KPI | Threshold | Countermeasure |
|---------|-----------|----------------|
| **+48h sem atualização** | `count > 0` = critical | "Falha de processo. Acionar coordenação imediatamente." |
| **+24h sem atualização** | `count >= 3` = critical; `count >= 1` = warning | "Cobrar atualização antes do fim do turno." |
| **+12h sem atualização** | `count >= 5` = warning | "Verificar se há equipe sem acesso ao sistema." |

**Evidência:** `MissionControlTab.tsx:86-91`

```typescript
function freshnessStatus(count: number, tier: '12h' | '24h' | '48h'): KpiStatus {
    if (count === 0) return 'ok';
    if (tier === '48h') return 'critical';
    if (tier === '24h') return count >= 3 ? 'critical' : 'warning';
    return count >= 5 ? 'warning' : 'ok';
}
```

**Campo analisado:** `updatedAt` do leito (Firestore Timestamp ou string ISO).

**Problema crítico:** Freshness usa `updatedAt` do **leito inteiro**, não por domínio. Uma atualização de `patientAlias` reinicia o contador, mesmo que o kamishibai não tenha sido revisado.

---

### KPI 3 — Impedimentos Kamishibai

| Item | Valor |
|------|-------|
| **Métrica** | Leitos com `patientAlias !== ''` E qualquer `kamishibai.{domain}.status === 'blocked'` |
| **Threshold** | Exibido como contagem absoluta (contexto, não KPI com semáforo) |
| **Drill-down** | `/admin/unit/{unitId}/analytics/lists?filter=kamishibai_impediment` |
| **Widget** | `mc-context-card` (menor, inferior) — não tem semáforo de cor |

---

### KPI 4 — Altas Próximas 24h

| Item | Valor |
|------|-------|
| **Métrica** | Leitos com `expectedDischarge === '24h'` E `patientAlias !== ''` |
| **Status fixo** | Sempre `'ok'` (informativo, não alarme) |
| **Drill-down** | `/admin/unit/{unitId}/analytics/lists?filter=discharge_next_24h` |
| **Countermeasure** | "Revisar barreiras de alta nos top 5 leitos; alinhar pendências multiprofissionais." |

---

### KPI 7 — Top Bloqueador Agora

| Item | Valor |
|------|-------|
| **Cálculo** | Frequência de `mainBlocker` entre leitos bloqueados, sorted desc |
| **Output** | `{ name, bedCount, share% }` |
| **Exibição** | Não exposto como card no tab Mission Control (existe no snapshot mas sem card UI) |

> **GAP:** `topBlockerNow` é calculado no backend mas **não aparece no Mission Control Tab**. O TopBlockers Table existe apenas na aba "Exploração". Evidência: `MissionControlTab.tsx` — não há referência a `topBlockerNow`.

---

## 3. Cards de contexto (linha 0 — métricas de contexto)

3 mini-cards sem semáforo:

1. **Leitos ocupados:** `activeBedsCount` e `% do total (totalBedsCount)`
2. **Leitos vagos:** `totalBedsCount - activeBedsCount` e `%`
3. **Impedimentos Kamishibai:** `kamishibaiImpedimentBedsCount` com drill-down

---

## 4. Drill-downs disponíveis

| Filtro | Rota | Lógica |
|--------|------|--------|
| `blocked_now` | `/analytics/lists?filter=blocked_now` | `patientAlias && mainBlocker`, sorted by `updatedAt` ASC |
| `stale_24h` | `/analytics/lists?filter=stale_24h` | `now - updatedAt > 24h`, sorted by age |
| `kamishibai_impediment` | `/analytics/lists?filter=kamishibai_impediment` | qualquer `kamishibai.*.status === 'blocked'` |
| `discharge_next_24h` | `/analytics/lists?filter=discharge_next_24h` | `expectedDischarge === '24h' && patientAlias` |
| `blocking_aging` | `/analytics/lists?filter=blocking_aging` | = `blocked_now`, sorted by age |
| `stale48h` / `stale24h` / `stale12h` | `/analytics/lists?filter=stale24h` | filtro no front-end do AnalyticsListScreen |

> **Nota:** `stale48h`, `stale24h`, `stale12h` como filtros do drill-down das freshness cards não têm caso mapeado em `FILTER_META` — podem gerar UI sem título/descrição.

**Evidência:** `AnalyticsListScreen.tsx:8-47` e `MissionControlTab.tsx:65-67`

---

## 5. Fonte de dados e latência

| Fonte | Dados | Latência |
|-------|-------|---------|
| Firestore live | Snapshot de todos os leitos da unidade | On-demand (chamada HTTPS ao clicar em refresh) |
| BigQuery | Histórico (FlowTrend, FreshnessBQ, TopBlockersBQ, TrendComparison, etc.) | On-demand via chamadas HTTPS |

**Não existe atualização automática** — o usuário deve clicar em "↻ Atualizar" (`mc-refresh-btn`). Evidência: `AnalyticsScreen.tsx:25-28`.

---

## 6. Thresholds — onde estão (todos hardcoded no frontend)

| KPI | Arquivo | Linhas | Tipo |
|-----|---------|--------|------|
| Bloqueados (%, critical 35, warning 20) | `MissionControlTab.tsx` | 16-19 | Hardcoded |
| Kamishibai (%, critical 30, warning 15) — **não usado no tab atual** | `MissionControlTab.tsx` | 25-29 | Hardcoded (código morto) |
| Freshness 48h | `MissionControlTab.tsx` | 88 | Hardcoded |
| Freshness 24h (count >= 3 → critical) | `MissionControlTab.tsx` | 89 | Hardcoded |
| Freshness 12h (count >= 5 → warning) | `MissionControlTab.tsx` | 90 | Hardcoded |

> `kamishibaiStatus()` function existe no código (`MissionControlTab.tsx:25-29`) mas **não é chamada**. Código morto — possivelmente de uma versão anterior do Mission Control.

---

## 7. Dependência de estados/cores do Kamishibai no Mission Control

O Mission Control **depende de kamishibai.*.status === 'blocked'** para:

1. Contar `kamishibaiImpedimentBedsCount` (backend)
2. Exibir card de contexto "Impedimentos Kamishibai"
3. Disponibilizar drill-down `kamishibai_impediment`

**Não depende** de `okStatus` ou `naStatus` — ignora completamente esses dois estados no Mission Control atual.

---

## 8. Gaps identificados

| # | Gap | Impacto |
|---|-----|---------|
| G1 | `topBlockerNow` calculado mas não exibido no Mission Control tab | KPI 7 existe no backend mas está "morto" na UI |
| G2 | Nenhum KPI de Aging de bloqueador no Mission Control (existe no snapshot mas sem card) | `maxBlockedAgingHours` calculado, ignorado no front |
| G3 | Não há atualização automática — usuário precisa clicar refresh manual | Em TV/huddle, os dados ficam desatualizados |
| G4 | `kamishibaiStatus()` function hardcoded mas não usada | Código morto, confusão futura |
| G5 | Freshness usa `updatedAt` do leito, não por domínio | Revisão de kamishibai não reinicia contador de freshness se só o kamishibai foi atualizado sem alterar os dados do leito |
| G6 | Sem suporte a Huddle AM/PM — Mission Control não diferencia dados de turno A vs turno B | Lean exige análise por cadência de turno |
