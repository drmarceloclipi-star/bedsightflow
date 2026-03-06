# AUDIT — Analytics / Freshness / Aging Pipeline

**Data:** 2026-02-28 | **Auditor:** Agente Antigravity | **Missão:** somente leitura

---

## 1. Mapa de métricas

| Métrica | Fonte | Cálculo | Destino / UI | Arquivo |
| --------- | ------- | --------- | -------------- | --------- |
| **activePatients** (leitos ocupados) | Firestore live | `patientAlias.trim() !== ''` | Mission Control context | `getAdminMissionControlSnapshot.ts:66-68` |
| **vacantBeds** (leitos vagos) | Firestore live | `totalBedsCount - activeBedsCount` | Mission Control context | `MissionControlTab.tsx:114-119` |
| **blockedBedsCount** | Firestore live | `mainBlocker.trim() !== ''` E `hasPatient` | KPI 1 Mission Control | `snapshot.ts:89-110` |
| **blockedAgingHours** (por leito) | Firestore live | `(now - updatedAt) / 3600000` | Mission Control (snapshot), drill-down aging | `snapshot.ts:104-109` |
| **maxBlockedAgingHours** | Firestore live | Max do aging individual | Snapshot (não exibido em UI) | `snapshot.ts:107` |
| **stale12h / stale24h / stale48h** | Firestore live | `now - updatedAt > X` | Mission Control freshness cards | `snapshot.ts:81-84` |
| **kamishibaiImpedimentCount** | Firestore live | any `kamishibai.*.status === 'blocked'` | Mission Control context card | `snapshot.ts:112-120` |
| **dischargeNext24h** | Firestore live | `expectedDischarge === '24h'` E `hasPatient` | KPI 4 Mission Control | `snapshot.ts:122-125` |
| **topBlockerNow** | Firestore live | Frequência de `mainBlocker`, sorted desc | Snapshot (não exibido in Mission Control tab) | `snapshot.ts:128-139` |
| **FlowTrend (histórico)** | BigQuery | Query por data de `bed_updates` | Analytics Exploração - gráfico | `getAdminFlowMetricsBQ.ts` |
| **Freshness histórica** | BigQuery | Buckets por hora/dia | Analytics Exploração - FreshnessCards | `getAdminFreshnessBQ.ts` |
| **KamishibaiStats histórico** | BigQuery | Contagem por status e domínio | Analytics Exploração - KamishibaiStatusChart | `getAdminKamishibaiStatsBQ.ts` |
| **TopBlockers histórico** | BigQuery | Ranking de `mainBlocker` por período | Analytics Exploração - TopBlockersTable | `getAdminTopBlockersBQ.ts` |
| **TrendComparison** | BigQuery | Período atual vs anterior, delta % | Analytics Exploração - TrendComparisonPanel | `getAdminTrendComparisonBQ.ts` |
| **MissionControlPeriod** | BigQuery | Altas por dia, avg, throughput delta | Analytics Exploração (não exibido no tab MC) | `getAdminMissionControlPeriod.ts` |

---

## 2. Dois pipelines distintos

### Pipeline A — Snapshot (tempo real, Firestore)

```text
Firestore (units/{unitId}/beds)
    ↓ getAdminMissionControlSnapshot (Cloud Function)
    ↓ cálculos server-side (sem BigQuery)
    → MissionControlTab.tsx
```

- **Latência:** On-demand (sem cache, sem agendamento)
- **Triggers:** Chamado via refresh manual no Analytics Screen
- **Usa BigQuery:** NÃO

### Pipeline B — Analytics Histórico (BigQuery)

```text
Firestore → BigQuery Export (stream automático via extensão ou trigger?)
    ↓ Cloud Functions BQ (getAdminFlowMetricsBQ, getAdminFreshnessBQ, etc.)
    → Analytics Exploração: FlowTrendChart, FreshnessCards, etc.
```

- **Latência:** Depende do lag do pipeline Firestore → BigQuery
- **Triggers:** On-demand por chamada HTTPS

> **ATENÇÃO:** O código das Cloud Functions BQ existe, mas nos logs recentes (jan/fev 2026) essas funções retornavam **500 Internal Server Errors**. Evidência: conversa `c82d9d21` — "getAdminFlowMetricsBQ, getAdminFreshnessBQ, getAdminTopBlockersBQ, getAdminTrendComparisonBQ" todos com 500.

---

## 3. Cloud Functions de Analytics — inventário

**Path:** `functions/src/callables/analytics/`

| Função | Fonte | Evidência de problema |
| -------- | ------- | ---------------------- |
| `getAdminMissionControlSnapshot` | Firestore live | Funcionando (Seção 4) |
| `getAdminOverviewBQ` | BigQuery | 500 conhecido |
| `getAdminFlowMetricsBQ` | BigQuery | 500 conhecido |
| `getAdminKamishibaiStatsBQ` | BigQuery | 500 conhecida |
| `getAdminTopBlockersBQ` | BigQuery | 500 conhecido |
| `getAdminFreshnessBQ` | BigQuery | 500 conhecido |
| `getAdminTrendComparisonBQ` | BigQuery | 500 conhecido |
| `getAdminMissionControlPeriod` | BigQuery | 500 provável |

> **Conclusão:** O Pipeline B (BigQuery) está **não operacional** no ambiente atual.

---

## 4. Freshness — detalhe do cálculo

**Baseado em:** `updatedAt` do documento `bed` inteiro.

**Problema de design:**

```text
Cenário: Enfermeira marca kamishibai como 'blocked' às 10h.
Médico atualiza 'patientAlias' às 14h.
→ updatedAt do leito = 14h
→ Freshness considera leito "atualizado às 14h" ✓
→ Mas Kamishibai não foi revisado desde as 10h (4h atrás)
→ Nenhuma métrica captura isso
```

**Campo:** `updatedAt` (`Timestamp` ou `string ISO 8601`)

**Buckets calculados:**

- `h12`: `age > 12h`
- `h24`: `age > 24h`
- `h48`: `age > 48h`

> Nota: Os buckets são **cumulativos** (se >48h, aparece em h12, h24 E h48 simultaneamente). Isso pode inflar contagens visuais.

---

## 5. Aging de bloqueadores — detalhe do cálculo

**Campo usado:** `updatedAt` do leito (proxy — sem `blockedAt` dedicado)

**Fórmula:**

```javascript
const agingHours = Math.round((now - updatedMs) / (60 * 60 * 1000))
```

**Problema:**

```text
Cenário: Leito tem bloqueador "Aguardando laudo RX" há 3 dias.
Admin entra e corrige 'patientAlias' → updatedAt reseta para agora.
→ Sistema considera aging = 0h
→ KPI aging fica verde quando deveria ser vermelho
```

**Evidência:** `getAdminMissionControlSnapshot.ts:95` (comentário no código): _"Compute aging from updatedAt as a proxy (best we have without a dedicated blockedAt)"_

---

## 6. Exportação Firestore → BigQuery

**Status atual:** Pipeline de exportação existe (Cloud Functions BQ retornam 500), mas o mecanismo de exportação **não está auditado no código do repo**. Não há trigger explícito de Firestore→BQ no `functions/src/triggers/`. Existe apenas `auditBedWrites` em triggers.

**Hipótese:** Export pode ser feito via Firebase Extension "Export Collections to BigQuery" ou via agendamento — mas sem evidência no codebase atual.

---

## 7. Jobs e schedulers

**Verificado em:** `functions/src/index.ts` — todos os exports são Callable HTTPS ou triggers Firestore.

**Não existe:** nenhum `functions.pubsub.schedule` (cron job) no index. Nenhum consolidador automático periódico.

---

## 8. AnalyticsListScreen — filtros de drill-down (client-side)

Todos os filtros de drill-down são **client-side** (sem índice composto no Firestore):

```typescript
// AnalyticsListScreen.tsx:89-128
// Busca TODOS os beds da unidade e filtra no browser
const bedsRef = collection(db, `units/${unitId}/beds`);
const snap = await getDocs(query(bedsRef));
let rows = snap.docs...
// filtra localmente por filter key
```

**Impacto:** Para unidades com >100 leitos, isso vai buscar O DOCUMENTO INTEIRO de cada leito para filtrar no cliente. Sem paginação, sem índice server-side.

---

## 9. Gaps identificados

| # | Gap | Impacto Lean |
| --- | ----- | -------------- |
| G1 | Não existe `blockedAt` — aging usa `updatedAt` como proxy | KPI de aging impreciso |
| G2 | Não existe freshness por domínio Kamishibai | Lean exige rastrear "revisão por equipe neste turno" |
| G3 | Pipeline BigQuery com 500 — Analytics Exploração não funciona | Histórico e trending indisponíveis |
| G4 | Nenhum scheduler/cron de consolidação | Sem snapshots históricos automáticos |
| G5 | Freshness acumula buckets (h12 ⊂ h24 ⊂ h48) — infla contagens | Pode criar alarmes falsos |
| G6 | AnalyticsListScreen busca todos os beds no cliente | Não escalável além de ~100 leitos |
| G7 | `MissionControlPeriod` (altas históricas) não exibido na UI | KPI de throughput existe no backend mas sem card |
