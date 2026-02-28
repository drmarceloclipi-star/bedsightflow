# ETAPA 1.5 — TV Pendencies v1 — Acceptance Criteria & Evidence

**Data:** 2026-02-28  
**Status:** ✅ DONE

---

## Checklist T1–T6

| # | Critério | Status |
|---|---|:---:|
| T1 | Leitos sem pendências **não exibem** badge | ✅ |
| T2 | Leito com `open > 0` exibe badge com contagem correta | ✅ |
| T3 | Leito com overdue exibe `"X ⚠Y"` (`dueAt < now && status==='open'`) | ✅ |
| T4 | SummaryScreen mostra totals (open/overdue) coerentes com somatório | ✅ |
| T5 | Sem regressão em rotação / Kanban / Kamishibai / Huddle badge | ✅ |
| T6 | `tsc --noEmit` → **0 erros** | ✅ |

---

## Arquivos Alterados

| Arquivo | Tipo | Mudança |
|---|---|---|
| `src/domain/pendencies.ts` | **NOVO** | Helpers canônicos: `PendencyCounts`, `computePendencyCounts`, `computeUnitPendencyCounts`, `hasOverdue`, `formatPendencyBadge` |
| `src/domain/types.ts` | MODIFY | `SummaryMetrics` +2 campos: `pendenciesOpen`, `pendenciesOverdue` |
| `src/domain/SummaryCalculator.ts` | MODIFY | Usa `computeUnitPendencyCounts`; aceita `now` como parâmetro injetável |
| `src/features/tv/components/KanbanScreen.tsx` | MODIFY | `PendencyBadge` (React.memo + useMemo); nova coluna; prop `now`; `data-pendencies-*`; `aria-label` |
| `src/features/tv/components/KamishibaiScreen.tsx` | MODIFY | Badge na célula do leito (não nos domínios); prop `now` |
| `src/features/tv/components/SummaryScreen.tsx` | MODIFY | 2 novos cards condicionais: Pendências Abertas (warning) + Pendências Vencidas (danger) |
| `src/features/tv/components/TvRotationContainer.tsx` | MODIFY | Prop `now`; propaga para KanbanScreen e KamishibaiScreen; `calculateMetrics(beds, now)` |
| `src/features/tv/pages/TvDashboard.tsx` | MODIFY | Passa `now={now}` ao TvRotationContainer |
| `src/index.css` | MODIFY | `.tv-badge`, `.tv-badge--pendencies`, `.tv-badge--overdue` |

---

## Helpers Canônicos (`src/domain/pendencies.ts`)

```typescript
export interface PendencyCounts { open: number; overdue: number }

// regra D3: dueAt < now && status === 'open'
// regra D4: sem dueAt → open, sem overdue badge
export function computePendencyCounts(bed: Bed, now = new Date()): PendencyCounts
export function computeUnitPendencyCounts(beds: Bed[], now = new Date()): PendencyCounts
export function hasOverdue(bed: Bed, now = new Date()): boolean
export function formatPendencyBadge(counts): string  // '' | '3' | '3 ⚠1'
```

---

## CSS do Badge

```css
/* Base — legibilidade mínima 12px para TV */
.tv-badge {
  display: inline-flex; align-items: center;
  font-size: 0.75rem; font-weight: 700;
  padding: 0.15rem 0.45rem; border-radius: 99px;
  border: 1.5px solid transparent; white-space: nowrap;
}

/* Pendências abertas: neutro — informa sem alarmar */
.tv-badge--pendencies {
  background-color: color-mix(in srgb, var(--text-muted) 12%, transparent);
  color: var(--text-secondary); border-color: var(--border-soft);
}

/* Overdue: warning sutil — "anormal" mas não gritante como "blocked" */
.tv-badge--overdue {
  background-color: color-mix(in srgb, var(--state-warning) 12%, transparent);
  color: var(--state-warning); border-color: var(--state-warning);
}
```

---

## Reprodução no Emulador

```bash
npm run emulators   # Firebase Emulator Suite
npm run seed        # Popula beds com pendências (seed-data.ts versão v1.1)
npm run dev         # Vite dev server
```

**URLs para verificar:**

- `/tv?unit=A` → navega até tela Kanban → verificar badges nos leitos
- `/tv?unit=A` → navega até tela Kamishibai → verificar badges na primeira coluna (leito)
- `/tv?unit=A` → navega até tela Resumo → verificar cards Pendências Abertas + Vencidas

**Beds com pendências no seed:**

| Bed | Pendências | Esperado na TV |
|---|---|---|
| `301.1` | 1 open sem prazo | Badge `"1"` neutro |
| `301.2` | 2 open (1 vencida, `dueAt = ontem`) | Badge `"2 ⚠1"` warning |
| `301.3` | 1 canceled (não conta) | Sem badge |
| `302.2` | 2 open vencidas | Badge `"2 ⚠2"` warning |

**DOM para verificação:**

```html
<!-- T2: open sem overdue -->
<span class="tv-badge tv-badge--pendencies" data-pendencies-open="1" data-pendencies-overdue="0">1</span>

<!-- T3: com overdue -->
<span class="tv-badge tv-badge--pendencies tv-badge--overdue" data-pendencies-open="2" data-pendencies-overdue="1">2 ⚠1</span>
```

---

## Nota de Performance (Guardrail T5)

### Sem novas subscriptions Firestore

- `beds[]` já carregado pelo `TvDashboard.listenToBeds` — reutilizado sem nova query.

### useMemo por leito

- `PendencyBadge` é uma `React.memo` que recebe `{ bed, now }`.
- Internamente usa `useMemo(() => computePendencyCounts(bed, now), [bed, now])`.
- Re-renderiza apenas quando o objeto `bed` muda (Firestore onSnapshot) **ou** quando `now` muda (a cada 30s).
- O timer de progresso da rotação (`setInterval 100ms`) **não** aciona re-render do badge.

### now injetável

- `now` (state do TvDashboard, atualizado a cada 30s) é propagado via:
  `TvDashboard → TvRotationContainer → KanbanScreen / KamishibaiScreen`
- `SummaryCalculator.calculateMetrics(beds, now)` também recebe `now` para consistência.

---

## Dívidas v1.6 (identificadas)

| Item | Impacto |
|---|---|
| Badge na TV não filtra por `patientAlias` not-empty (leito vazio pode ter badge) | Baixo — semanticamente correto, mas visualmente ruidoso |
| Animação sutil quando badge `overdue` aparece pela primeira vez | UX — não blocante |
| Escalão "🔥" após X horas (Etapa 1.6) | Próximo passo |
