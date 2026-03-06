# RENDERER_V1_ACCEPTANCE — 2026-02-28

**Objetivo:** verificar que o renderer v1 Kamishibai (TV + Editor) está correto antes de deploy em piloto.

---

## 1. Critérios de Aceite

| # | Critério | Verificação |
| --- | ---------- | ------------- |
| A1 | Leito vazio → sem dots na TV (nenhuma cor, nenhum placeholder) | `resolveKamishibaiVisualState` regra 1 → INACTIVE → `kamishibai-empty` |
| A2 | `kamishibaiEnabled=false` → sem dots (todos INACTIVE) | regra 2 |
| A3 | Verde **expira na virada de turno** (reviewedShiftKey ≠ currentShiftKey → sem cor) | regra 5 |
| A4 | Vermelho (`blocked`) persiste entre turnos mesmo sem revisão | regra 4, imune a TTL |
| A5 | Domínio fora de `applicableDomains` → placeholder N/A (borda tracejada apagada) | regra 3 → `kamishibai-placeholder--na` |
| A6 | Botão `na` **não aparece** no Editor (apenas ok e blocked nos controles) | BedDetails: array `['ok','blocked']` |
| A7 | `handleUpdateKamishibai` grava `reviewedShiftKey` e `reviewedAt` a cada clique | BedDetails handler v1 |

---

## 2. Análise dos Casos-Seed

### Bed 301.1 — v1 rico

- `patientAlias`: → leito ocupado
- `kamishibai.physio.status = 'blocked'` → **BLOCKED** (vermelho) em qualquer turno
- Demais domínios: `status='ok'`, `reviewedShiftKey` = seed key
  - Se seed key = turno atual → **OK** (verde)
  - Se seed key < turno atual (piloto no turno seguinte) → **UNREVIEWED_THIS_SHIFT** (sem cor) ✓ TTL funcionando

### Bed 301.3 — v1, 4 applicableDomains

- `applicableDomains: ['nursing','physio','nutrition','social']`
- `psychology` → **NOT_APPLICABLE** (placeholder cinza)
- Outros 4: resolvem normalmente (ok/blocked dependendo do seed)

### Bed 302.2 — v0 legado (na)

- Todos `status: 'na'` sem `reviewedShiftKey`
- → regra compat: `status === 'na'` em leito ativo + domínio aplicável → **UNREVIEWED_THIS_SHIFT**
- TV mostra células vazias (sem cor) para todos os domínios ✓ não mistura com verde

### Bed 304.x — leito vazio (patientAlias='')

- → regra 1 → **INACTIVE** → `kamishibai-empty` → sem dots na TV ✓

---

## 3. Mapeamento Visual → Classe CSS

| Estado | Classe CSS | Visual |
| -------- | ----------- | -------- |
| `OK` | `.kamishibai-dot--ok` | 🟢 verde sólido |
| `BLOCKED` | `.kamishibai-dot--blocked` | 🔴 vermelho sólido |
| `NOT_APPLICABLE` | `.kamishibai-placeholder--na` | ⭕ borda tracejada, opacity 0.28 |
| `INACTIVE` | `.kamishibai-empty` | ∅ célula vazia (só espaço) |
| `UNREVIEWED_THIS_SHIFT` | `.kamishibai-empty` | ∅ célula vazia (só espaço) |

> [!NOTE]
> INACTIVE e UNREVIEWED mapeiam para a mesma classe CSS — **a diferença semântica existe na lógica e no aria-label, não na cor**.
> Isso é intencional: o contrato LEAN diz "sem cor = não concluído no turno / inativo".

---

## 4. Verificação TypeScript

```bash
cd /Users/marcelocavalcanti/Downloads/LEAN/ward-board
npx tsc --noEmit
```

**Resultado: 0 erros** ✅ (verificado em 2026-02-28T18:44 -03:00)

---

## 5. Arquivos alterados

| Arquivo | Tipo | Resumo da mudança |
| --------- | ------ | ------------------- |
| `src/domain/kamishibaiVisualState.ts` | NOVO | Resolvedor canônico (6 regras + compat v0) |
| `src/index.css` | MODIFY | +4 classes v1 (dot--ok, dot--blocked, placeholder--na, empty) |
| `src/features/tv/components/KamishibaiScreen.tsx` | MODIFY | Usa resolveKamishibaiVisualState; data-state/aria-label; legenda v1 |
| `src/features/tv/components/TvRotationContainer.tsx` | MODIFY | Pass-through de opsSettings |
| `src/features/tv/pages/TvDashboard.tsx` | MODIFY | Passa opsSettings; badge HUDDLE PENDENTE via useMemo |
| `src/features/editor/pages/BedDetails.tsx` | MODIFY | handleUpdateKamishibai v1; remove botão na; badge de estado visual |

---

## 6. O que NÃO mudou

- Mission Control — intocado
- Analytics — intocado
- Kanban — intocado
- Rotas — intocadas
- `firestore.rules` — intocado
- `types.ts` — intocado (foi somente leitura nesta etapa)

---

## 7. Etapa 1.2 concluída

- ✅ Registrar Huddle AM/PM → `UnitSettingsRepository.registerHuddle()` (validado, 4 campos corretos)
- ✅ Badge "HUDDLE PENDENTE" na TV → `TvDashboard` via `useMemo(huddlePending, huddleSubtext)`
- ✅ Botões AM/PM no Admin → `OpsScreen` seção "Cadência Huddle" com toast feedback

---

## 8. Evidências Adicionais

### 8.1 Acessibilidade / DOM: `data-state` e `aria-label`

Cada célula `<td>` do grid Kamishibai na TV agora carrega `data-state` e `data-domain`:

```html
<!-- INACTIVE -->
<td data-state="inactive" data-domain="physio">
  <div role="img" aria-label="Leito vazio ou Kamishibai inativo" class="kamishibai-dot kamishibai-empty" />
</td>

<!-- UNREVIEWED_THIS_SHIFT -->
<td data-state="unreviewed" data-domain="physio">
  <div role="img" aria-label="Não revisado neste turno" class="kamishibai-dot kamishibai-empty" />
</td>

<!-- OK -->
<td data-state="ok" data-domain="physio">
  <div role="img" aria-label="OK — revisado neste turno" class="kamishibai-dot kamishibai-dot--ok" />
</td>

<!-- BLOCKED -->
<td data-state="blocked" data-domain="physio">
  <div role="img" aria-label="Impedido" class="kamishibai-dot kamishibai-dot--blocked" />
</td>

<!-- NOT_APPLICABLE -->
<td data-state="not_applicable" data-domain="psychology">
  <div role="img" aria-label="Não aplicável" class="kamishibai-dot kamishibai-placeholder--na" />
</td>
```

**Para telemetria:** `document.querySelectorAll('[data-state="unreviewed"]').length` ≠ `[data-state="inactive"]`.

---

### 8.2 Reprodução do TTL (AM → PM)

```bash
# Pré-condição: emulador rodando, leito A-301.1
# com kamishibai.physio.status='ok' e reviewedShiftKey="2026-02-28-AM"

# PASSO 1: Verificar verde (turno AM)
# TV → physio dot = VERDE (data-state="ok")
# Motivo: currentShiftKey() === "2026-02-28-AM" → match

# PASSO 2: Simular virada para PM
# Opção A — Emulador Firestore UI:
#   editar kamishibai.physio.reviewedShiftKey = "2026-02-27-PM" (turno anterior)
# Opção B — shiftKey.ts (dev local):
#   substituir 'new Date()' por 'new Date("2026-02-28T21:00:00")'

# PASSO 3: Verificar que dot some
# TV → physio = VAZIO (data-state="unreviewed")
# aria-label: "Não revisado neste turno"

# PASSO 4: Re-registrar via Editor
# BedDetails → clicar OK em physio
# TV → dot volta VERDE imediatamente (onSnapshot realtime)
```

> [!NOTE]
> O TTL é baseado em **shiftKey string** (`YYYY-MM-DD-AM/PM`), não em duração em horas.
> É seguro simular editando `reviewedShiftKey` diretamente no emulador Firestore, sem alterar código.

---

### 8.3 Risco e Mitigação: TvRotationContainer e TvDashboard

**Mudanças:**

- `TvDashboard` passou `opsSettings` (prop extra) para `TvRotationContainer`
- `TvRotationContainer` repassa para `KamishibaiScreen`

**Por que foi necessário:**

- `kamishibaiEnabled` e `huddleSchedule` vivem em `settings/ops`, não em `settings/board`
- `TvDashboard` já subscrevia `settings/ops` via `subscribeUnitOpsSettings` — sem duplicação
- Pass-through de prop é a mudança menos invasiva possível

**Garantias de não-regressão:**

1. `TvRotationContainer` não tocou lógica de rotação (timer, slides, subscriptions) — apenas recebe a prop extra
2. `opsSettings: null` é caso seguro — `KamishibaiScreen` usa fallback `kamishibaiEnabled=true`
3. `tsc --noEmit` → 0 erros confirma tipos corretos em toda a cadeia de props
4. A sub `unsubscribeOps` continua no mesmo `useEffect` do `TvDashboard` — sem memory leak novo
