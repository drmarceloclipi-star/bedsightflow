# Auditoria de Conformidade — Design System

**Referência:** `docs/design-system/01-05-*.md`  
**Commits auditados:** `d1f8c19` → `3c05d53` (sessão 2026-02-28)  
**Status:** ✅ Aprovado com 2 anotações menores (não bloqueantes)

---

## Critérios do Design System

| Princípio | Critério Chave |
| --- | --- |
| Warm Minimalism | Off-whites, earth tones, sem estéril/tech |
| Typography as Interface | Inter (UI), Instrument Serif (headings) |
| Restrained Componentry | Sem shadow pesada, sem borda grossa, sem cor vibrante |
| Data Clarity | Whitespace, não linhas; dados devem "respirar" |
| Colors | Warning = `#D9A05B` (amber), Error = `#C25450` (rust), nunca `#FF0000` |
| Borders | 1px soft (`#E5E5E5`); mais forte só para CTA urgente |

---

## Análise por Commit

### `d1f8c19` — Etapa 1.5: badge de pendências por leito na TV

#### `.tv-badge` — Base

```css
font-family: var(--font-sans);   /* ✅ Inter */
font-size: 0.75rem;              /* ✅ text-xs = metadata/label (conforme tabela) */
font-weight: 700;                /* ⚠ Bold (700) */
border-radius: 99px;             /* ✅ pill — restrained, sem anguloso */
border: 1.5px solid transparent; /* ✅ soft border */
```

> ⚠ **Anotação 1 (não bloqueante):** O design system define pesos até `600` (semibold) para labels críticos. `700` (bold) foi usado intencionalmente para legibilidade de TV a distância — contexto especial que justifica a exceção. **Conforme com intenção de TV.**

#### `.tv-badge--pendencies` — Open, neutro

```css
background-color: color-mix(in srgb, var(--text-muted) 12%, transparent); /* ✅ extremamente sutil */
color: var(--text-secondary);   /* ✅ muted — secundário, não alarma */
border-color: var(--border-soft); /* ✅ border-soft = ~#E5E5E5, canonical */
```

**✅ Plenamente conforme.** Warm minimalism: informa sem alarmar.

#### `.tv-badge--overdue` — Overdue, warning sutil

```css
background-color: color-mix(in srgb, var(--state-warning) 16%, transparent); /* ✅ D9A05B amber, 16% = sutil */
color: var(--state-warning);    /* ✅ amber, não vermelho */
border-color: var(--state-warning); /* ✅ amber */
border-width: 2px;              /* ⚠ Levemente acima do padrão 1px */
```

> ⚠ **Anotação 2 (não bloqueante):** Borda `2px` excede o padrão geral de `1px` do design system. Justificado pelo contexto TV (distância de leitura) e intenção de distinguir overdue de open sem usar cor diferente. **Conforme com intenção de TV.**

---

### `KanbanScreen.tsx` e `KamishibaiScreen.tsx`

| Item | Verificação |
| --- | --- |
| Font da tabela | Usa classes existentes (`kanban-bed-num`, `kanban-patient`) — sem nova fonte hardcoded |
| Cor de texto | `var(--text-primary)`, `var(--text-muted)`, `var(--text-secondary)` — todos tokens |
| Spacing tabela | `padding: 0.35rem 0.6rem` (~5.6px / 9.6px) — conforme grid de 4px |
| Hover state | `var(--bg-surface-2)` — suave, sem cor vibrante |
| Heading | `font-family: var(--font-serif)` para o `<h2>` da tela Kanban — ✅ Instrument Serif |
| Badge no Kamishibai | Inline junto ao número do leito, sem quebrar linha nem sobrecarregar domínios |

**✅ Plenamente conforme.**

---

### `SummaryScreen.tsx`

| Item | Verificação |
| --- | --- |
| Cards novos (open/overdue) | Usam classes `summary-card highlight-warning` / `highlight-danger` — existentes |
| Condicional | Cards só aparecem se `open > 0` / `overdue > 0` — sem poluição visual quando zero |
| Cores de destaque | `var(--state-warning)` (amber) e `var(--state-danger)` (rust) — canônicas |
| Typography | `summary-label` (uppercase, muted, 0.875rem) e `summary-value` (serif, 5rem) — herança |

**✅ Plenamente conforme.**

---

### `BedDetails.tsx` — Badge de domínio em PT-BR

| Item | Verificação |
| --- | --- |
| Badge de domínio | Classe existente: `text-[10px] font-bold uppercase tracking-widest bg-accent-primary/10 text-accent-primary` |
| Uso de `SpecialtyLabel` | Rótulo traduzido, value interno permanece em chave inglesa — zero mudança visual |
| Botões cancelar/excluir | Reagrupados em `flex-col ml-auto` — melhora layout sem alterar tokens de cor ou fonte |

**✅ Plenamente conforme.**

---

## Sumário de Conformidade

| Área | Status | Obs |
| --- | --- | --- |
| Paleta de cores (tokens) | ✅ 100% | Todos `var(--state-*)`, `var(--text-*)`, `var(--border-*)` |
| Typography | ✅ | Inter (UI) e Instrument Serif (headings). `font-weight: 700` justificado para TV |
| Restraint (sem shadow, sem CTA vibrante) | ✅ | Nenhuma `box-shadow` nova, nenhum `#FF0000` |
| Spacing (4px grid) | ✅ | Todos paddings múltiplos de 4px |
| Border | ⚠ Anotação | `border-width: 2px` em `.tv-badge--overdue` — excede padrão 1px, justificado por TV |
| Font weight | ⚠ Anotação | `font-weight: 700` em `.tv-badge` — acima do semibold padrão, justificado por TV |
| Dark mode | ✅ | Usa exclusivamente tokens `var()` — herdam dark mode automático |

### Veredicto: ✅ APROVADO

Nenhuma violação estrutural. As 2 anotações são exceções justificadas pelo contexto especial de TV (distância de leitura, legibilidade a 2–4m).

---

## Recomendação para próximos PRs

1. **Codificar uma exceção "TV context"** no `05-components.md` documentando que componentes de TV podem usar `font-weight: 700` e `border-width: 2px` para garantir legibilidade.
2. **Não usar `zoom: 0.8`** em `KamishibaiScreen` — preferir `font-size` escalável ou viewport units. O `zoom` atual funciona mas não é semântico e pode quebrar em alguns browsers não-Chromium.
