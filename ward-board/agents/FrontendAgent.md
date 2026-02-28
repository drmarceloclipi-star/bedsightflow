# FrontendAgent: UI/UX & React Specialist

The FrontendAgent is dedicated to the visual and interactive aspects of the LEAN project, ensuring a premium user experience.

## Specializations

- **React & Vite**: Building high-performance functional components and hooks.
- **Modern Aesthetics**: Implementing vibrant, glassmorphic, and dynamic designs using Vanilla CSS.
- **Typography & Color**: Adhering to the project's chosen design tokens (Google Fonts like Inter/Outfit, specific HSL palettes).
- **Responsive Design**: Ensuring the dashboard looks stunning on mobile, tablet, and TV displays.
- **State Management**: Managing frontend state efficiently.

## Technical Stack

- React
- TypeScript
- Vanilla CSS
- Vite
- Framer Motion (for micro-animations)
- Firebase Functions (always target `southamerica-east1` region)

---

## Estado Atual — BedDetails (Pendências v1.1, 2026-02-28)

### Seção de Pendências em `src/features/editor/pages/BedDetails.tsx`

**Hooks usados:**

```tsx
const { isAdmin } = useAuthStatus();  // RBAC: delete só para admin
const [showDonePendencies, setShowDonePendencies] = useState(false);
const [showCanceledPendencies, setShowCanceledPendencies] = useState(false);
```

**Estrutura da seção:**

```
┌─ Pendências abertas (open)
│   ├─ [⚠ Vencida]?  título  [✓ done]  [✕ cancel]  [🗑️ admin-only]
│   └─ data-status="open|overdue", aria-label em cada botão
│
├─ [▼ Ver concluídas (N)] — colapsável
│   └─ doneAt + doneBy.name + [🗑️ admin-only]
│
└─ [▼ Ver canceladas (N)] — colapsável
    └─ canceledAt + canceledBy.name + note + [🗑️ admin-only]
```

**Overdue:** `dueAt < now && status === 'open'` → badge `⚠ Vencida` + `data-status="overdue"`

**Handlers:**

- `handleAddPendency` → `BedsRepository.addPendency` (arrayUnion)
- `handleMarkDone` → `BedsRepository.markPendencyDone` (runTransaction)
- `handleCancelPendency` → `BedsRepository.cancelPendency` (runTransaction)
- `handleDeletePendency` → guarda `if (!isAdmin) return` + `BedsRepository.deletePendency`

### Renderer Kamishibai v1 (Etapa 1.1)

Estados derivados para renderização (em ordem de precedência):

| Estado | CSS/dot | `data-state` |
|---|---|---|
| `NOT_APPLICABLE` | sem dot | `"na"` |
| `INACTIVE` (leito vazio) | sem dot | `"inactive"` |
| `UNREVIEWED_THIS_SHIFT` | sem cor | `"unreviewed"` |
| `BLOCKED` | vermelho | `"blocked"` |
| `OK` | verde | `"ok"` |

> Verde expira ao virar turno: `reviewedShiftKey !== currentShiftKey` → UNREVIEWED_THIS_SHIFT.

### Huddle AM/PM (Etapa 1.2)

- TV exibe badge "Huddle pendente" quando `huddleShiftKey !== currentShiftKey`
- Editor: botão confirmar huddle → `registerHuddle()` no repo

### Mission Control UI (Etapa 1.3)

- **Cards de Pendências:** "Pendências abertas" (warning se > 0) + "Pendências vencidas" (critical se qualquer > 0)
- **Drill-down:** clique no card → `/analytics/lists?filter=pendencies_open` ou `pendencies_overdue`

### Dívida v1.2

- Badge de pendências na TV: card do leito deve exibir "X pendências" se `pendencies.filter(p => p.status==='open').length > 0`
