# ETAPA 1.5.1 — TV Pendencies v1 Polish — Acceptance Criteria & Evidence

**Data:** 2026-02-28  
**Status:** ✅ DONE

---

## Checklist PZ1–PZ5

| # | Critério | Status |
| --- | --- | :---: |
| PZ1 | Leito vazio (`patientAlias=''\|null`) **nunca** exibe badge (Kanban ou Kamishibai) | ✅ |
| PZ2 | Summary totals **não** contam leitos vazios | ✅ |
| PZ3 | Overdue visualmente distinguível (sutil) + `aria-label` correto | ✅ |
| PZ4 | `tsc --noEmit` → **0 erros** | ✅ |
| PZ5 | Sem regressão em rotação / huddle badge | ✅ |

---

## Arquivos Alterados

| Arquivo | Mudança |
| --- | --- |
| `src/domain/pendencies.ts` | Guard `patientAlias` em `computePendencyCounts`; `computeUnitPendencyCounts` DRY |
| `src/features/tv/components/KanbanScreen.tsx` | `aria-label` padronizado no `PendencyBadge` |
| `src/features/tv/components/KamishibaiScreen.tsx` | `aria-label` padronizado no `PendencyBadge` |
| `src/index.css` | `.tv-badge--overdue` background 16% + borda 2px |

---

## Trecho atualizado: `computePendencyCounts`

```typescript
export function computePendencyCounts(bed: Bed, now: Date = new Date()): PendencyCounts {
    // PZ1: leito vazio não exibe badge na TV nem entra em KPIs
    if (!bed.patientAlias || bed.patientAlias.trim() === '') {
        return { open: 0, overdue: 0 };
    }

    const pendencies: Pendency[] = Array.isArray(bed.pendencies) ? bed.pendencies : [];
    const nowMs = now.getTime();
    let open = 0;
    let overdue = 0;

    for (const p of pendencies) {
        if (p.status !== 'open') continue;
        open++;
        if (p.dueAt) {
            const dueMs = toMs(p.dueAt);
            if (dueMs !== null && dueMs < nowMs) overdue++;
        }
    }
    return { open, overdue };
}
```

`computeUnitPendencyCounts` agora é DRY — reutiliza o guard interno:

```typescript
export function computeUnitPendencyCounts(beds: Bed[], now: Date = new Date()): PendencyCounts {
    let open = 0, overdue = 0;
    for (const bed of beds) {
        const counts = computePendencyCounts(bed, now); // já ignora leitos vazios
        open += counts.open;
        overdue += counts.overdue;
    }
    return { open, overdue };
}
```

---

## CSS `.tv-badge--overdue` atualizado

```css
/* PZ3: 16% (antes: 12%) + borda 2px (antes: 1.5px) — mais distinguível, mesma paleta */
.tv-badge--overdue {
  background-color: color-mix(in srgb, var(--state-warning) 16%, transparent);
  color: var(--state-warning);
  border-color: var(--state-warning);
  border-width: 2px;
}
```

---

## `aria-label` padronizado (PZ3)

```tsx
aria-label={
    counts.overdue > 0
        ? `Pendências abertas: ${counts.open}. Pendências vencidas: ${counts.overdue}`
        : `Pendências abertas: ${counts.open}`
}
```

---

## Reprodução no Emulador

```bash
npm run emulators && npm run seed && npm run dev
```

**Exemplos DOM esperados:**

```html
<!-- Leito vazio (patientAlias='') → SEM badge em nenhuma tela -->
<!-- nenhum elemento .tv-badge renderizado -->

<!-- Leito ativo, só open -->
<span class="tv-badge tv-badge--pendencies"
      data-pendencies-open="2" data-pendencies-overdue="0"
      aria-label="Pendências abertas: 2">2</span>

<!-- Leito ativo, com overdue -->
<span class="tv-badge tv-badge--pendencies tv-badge--overdue"
      data-pendencies-open="3" data-pendencies-overdue="1"
      aria-label="Pendências abertas: 3. Pendências vencidas: 1">3 ⚠1</span>
```

---

## Nota de Performance

- Guard `patientAlias` executa **antes** do loop de pendências — O(1) early return.
- `computeUnitPendencyCounts` continua O(n × pendências) — sem impacto.
- `useMemo` e `React.memo` mantidos sem alteração.
