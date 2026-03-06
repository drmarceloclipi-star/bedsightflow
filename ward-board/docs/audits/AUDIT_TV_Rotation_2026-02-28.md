# AUDIT — TV Rotation & Telas

**Data:** 2026-02-28 | **Auditor:** Agente Antigravity | **Missão:** somente leitura

---

## 1. Inventário de telas e rotas

| Rota | Componente | Dados consumidos | Quem escreve os dados |
| ------ | ----------- | ------------------ | ----------------------- |
| `/tv?unit={unitId}` | `TvDashboard` → `TvRotationContainer` | `beds`, `settings/board`, `units`, `settings/ops` | Editor via `BedsRepository.updateBed()` |
| `/tv` → slide Kanban | `KanbanScreen` | `beds[]` (paginados) | Editor |
| `/tv` → slide Kamishibai | `KamishibaiScreen` | `beds[]` (paginados) | Editor |
| `/tv` → slide Summary | `SummaryScreen` | `SummaryMetrics` (calculado do `beds[]`) | Calculado no frontend |
| `/editor?unit={unitId}` | `MobileDashboard` → `BedDetails` | `beds`, `units`, `settings/ops` | Editor (escrita direta Firestore) |
| `/admin/unit/{unitId}` → aba TV | `TvSettingsScreen` | `settings/board` | Admin via `BoardSettingsRepository.updateSettings()` |

---

## 2. Arquitetura do TvRotationContainer

**Evidência:** [`src/features/tv/components/TvRotationContainer.tsx`](../../../src/features/tv/components/TvRotationContainer.tsx)

```text
TvDashboard
  ↓ 4 subscriptions onSnapshot (realtime)
  │  ├── BedsRepository.listenToBeds()       → units/{unitId}/beds
  │  ├── BoardSettingsRepository.listenToSettings() → units/{unitId}/settings/board
  │  ├── UnitsRepository.getUnit()           → units/{unitId} (one-time)
  │  └── UnitSettingsRepository.subscribeUnitOpsSettings() → units/{unitId}/settings/ops
  ↓
TvRotationContainer
  ├── expandedScreens: enabled screens com paginação automática de leitos
  │   ├── kanban: beds paginados a cada kanbanBedsPerPage (default 18)
  │   ├── kamishibai: beds paginados a cada kamishibaiBedsPerPage (default 18)
  │   └── summary: 1 slide (sem paginação)
  ├── Progress bar: CSS animado com interval de 100ms
  └── Screen indicator: "{label} • {current}/{total}"
```

---

## 3. Lógica de rotação

**Evidência:** `TvRotationContainer.tsx:67-91`

- Timer: `setInterval(100ms)` — progress calculado por `(elapsed / duration) * 100`
- Duração por tela: campo `durationSeconds` do BoardSettings (default: kanban=15s, kamishibai=15s, summary=10s)
- Paginação: se beds > bedsPerPage, cria múltiplos slides de mesma tela
- `rotationEnabled === false`: pausa na primeira tela (sem rotação automática)

---

## 4. KanbanScreen — cores de badges (Previsão de Alta)

**Evidência:** [`src/features/tv/components/KanbanScreen.tsx:11-18`](../../../src/features/tv/components/KanbanScreen.tsx#L11)

```typescript
const getDischargeColorClass = (estimate: string) => {
    switch (estimate) {
        case '24h':      return 'state-success-bg';   // VERDE
        case '2-3_days': return 'state-warning-bg';   // AMARELO/WARNING
        case '>3_days':  return 'state-danger-bg';    // VERMELHO
        default:         return 'kanban-badge-indefinida'; // SEM COR (dashed border)
    }
};
```

| Valor `expectedDischarge` | Label exibido | Classe CSS | Semântica Lean |
| --------------------------- | --------------- | ----------- | ---------------- |
| `'24h'` | `< 24h` | `state-success-bg` | Verde — alta iminente |
| `'2-3_days'` | `2-3 dias` | `state-warning-bg` | Amarelo — próxima |
| `'>3_days'` | `> 3 dias` | `state-danger-bg` | Vermelho — distante |
| `'later'` | `Indefinida` | `kanban-badge-indefinida` | Cinza/dashed — indefinida |

---

## 5. KamishibaiScreen — dots de status

**Evidência:** `KamishibaiScreen.tsx:30`

```tsx
<div className={`kamishibai-dot ${entry?.status || 'na'}`} />
```

Dot CSS classes esperadas no `index.css` (não auditado em detalhe):

- `.kamishibai-dot.ok` → verde
- `.kamishibai-dot.blocked` → vermelho
- `.kamishibai-dot.na` → cinza / sem cor

---

## 6. SummaryScreen — métricas exibidas

**Evidência:** [`src/features/tv/components/SummaryScreen.tsx`](../../../src/features/tv/components/SummaryScreen.tsx)

**Fonte dos dados:** `SummaryCalculator.calculateMetrics(beds)` — calculado client-side na TV.

**Evidência:** [`src/domain/SummaryCalculator.ts`](../../../src/domain/SummaryCalculator.ts)

```typescript
// SummaryCalculator.ts
export const SummaryCalculator = {
    calculateMetrics(beds: Bed[]): SummaryMetrics {
        return {
            activePatients: beds.filter(b => b.patientAlias?.trim()).length,
            discharges24h:  beds.filter(b => b.expectedDischarge === '24h' && b.patientAlias?.trim()).length,
            withBlockers:   beds.filter(b => b.mainBlocker?.trim() && b.patientAlias?.trim()).length,
        };
    }
};
```

---

## 7. Coluna dupla (dual columns)

Tanto `KanbanScreen` quanto `KamishibaiScreen` suportam `columns > 1` para exibir 2 tabelas lado a lado. Controlado por `kanbanColumnsPerPage` / `kamishibaiColumnsPerPage` no BoardSettings.

---

## 8. KanbanMode na TV

**Evidência:** `TvDashboard.tsx:153-157`

```tsx
{opsSettings && (
    <div className="tv-mode text-[10px] text-muted-more ...">
        Modo: {opsSettings.kanbanMode}
    </div>
)}
```

O `kanbanMode` (PASSIVE/ACTIVE_LITE) é exibido como texto informativo no header da TV — **não altera nenhum comportamento visual** das telas Kanban/Kamishibai/Summary. É apenas indicativo.

---

## 9. Configurações da TV (TvSettingsScreen) — o que admin pode alterar

**Evidência:** `src/features/admin/screens/TvSettingsScreen.tsx` (não lido em detalhe, mas evidenciado pelo BoardSettings schema)

Admin pode configurar via `updateBoardSettings` Cloud Function:

- `rotationEnabled` (boolean)
- Por screen: `enabled`, `durationSeconds`
- `kanbanBedsPerPage`, `kanbanColumnsPerPage`
- `kamishibaiBedsPerPage`, `kamishibaiColumnsPerPage`
- `reason` (string — auditável)

---

## 10. Gaps identificados

| # | Gap | Impacto Lean |
| --- | ----- | -------------- |
| G1 | Kamishibai não tem card de "leito sem paciente" visualmente separado — aparece na tabela com dots cinzas | Lean: leitos vagos não deveriam aparecer no quadro kamishibai (sem cor = ausência, não N/A) |
| G2 | Não existe modo "Kamishibai desabilitado" granular — apenas `enabled: false` na screen oculta a tela inteira | Sem como mostrar Kanban sem Kamishibai seletivamente por leito |
| G3 | Sem indicação de "qual turno" está sendo exibido na TV | TV não diferencia dados de turno AM vs PM |
| G4 | Progress bar vai de 0→100% por slide, sem indicação de qual slide total é o "completado" | UX de rotação sem contexto de progresso global |
| G5 | Zoom fixo de 80% no KamishibaiScreen (style: `zoom: 0.8`) — hardcoded no inline style | Não responsivo a TVs de tamanhos diferentes |
