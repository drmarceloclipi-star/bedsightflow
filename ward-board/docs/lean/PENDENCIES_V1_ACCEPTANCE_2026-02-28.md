# PENDENCIES_V1 — Acceptance Criteria

**Versão:** 1.0  
**Data:** 2026-02-28  
**Escopo:** Etapa 1.4 — Pendências Persistentes v1  
**Autor:** Antigravity (gerado automaticamente)

---

## 1. Objetivo

Transformar o BedSight de dashboard em **instrumento de gestão operacional** permitindo que equipes registrem e acompanhem pendências por leito, persistindo entre turnos.

---

## 2. Escopo v1

| Funcionalidade | Implementado |
|---|---|
| Schema `Pendency` + `PendencyStatus` em `types.ts` | ✅ |
| CRUD: `addPendency`, `markPendencyDone`, `deletePendency` no `BedsRepository` | ✅ |
| UI seção "Pendências" no editor (`BedDetails.tsx`) | ✅ |
| Cloud Function `getAdminMissionControlSnapshot` — contadores | ✅ |
| MissionControlTab — 2 cards novos | ✅ |
| AnalyticsListScreen — filtros `pendencies_open` + `pendencies_overdue` | ✅ |
| Seeds com 4 beds com pendências variadas | ✅ |

---

## 3. Schema JSON

```json
// Pendência aberta com prazo vencido
{
  "id": "uuid-v4",
  "title": "Aguardar atestado médico de alta",
  "status": "open",
  "domain": "medical",
  "dueAt": "2026-02-26T12:00:00.000Z",
  "createdAt": "2026-02-27T08:00:00.000Z",
  "createdBy": { "id": "uid-123", "name": "Dr. Silva" }
}

// Pendência concluída
{
  "id": "uuid-v4",
  "title": "Confirmar dieta prescrita",
  "status": "done",
  "domain": "nutrition",
  "createdAt": "2026-02-27T08:00:00.000Z",
  "createdBy": { "id": "uid-456", "name": "Enf. Maria" },
  "doneAt": "2026-02-28T10:00:00.000Z",
  "doneBy": { "id": "uid-127", "name": "Enf. Paula" }
}
```

---

## 4. Regras Operacionais

| Regra | Comportamento |
|---|---|
| Pendência sem `dueAt` | Aparece como "open" sem indicação de prazo |
| Pendência com `dueAt < now` e `status=open` | Indicada com ⚠ "Vencida" em vermelho |
| Status `done` | Movida para lista colapsada "Concluídas" |
| `deletePendency` | Remove permanentemente do array (admin) |
| `addPendency` usa `arrayUnion` | Safe para concorrência multi-usuário |
| `markPendencyDone` | Read-then-write com doneAt/doneBy preenchidos |

---

## 5. Mission Control — Campos v1

O payload do snapshot inclui:

```json
{
  "openPendenciesCount": 4,
  "overduePendenciesCount": 2,
  "bedsWithOpenPendenciesCount": 3,
  "bedsWithOpenPendenciesIds": ["bed_301.1", "bed_301.2", "bed_302.2"]
}
```

**Cards na UI:**

- **Pendências abertas** — status `ok` se 0, `warning` se >0
- **Pendências vencidas** — status `ok` se 0, `critical` se qualquer >0

---

## 6. Filtros no AnalyticsListScreen

| Filtro | URL | Comportamento |
|---|---|---|
| `pendencies_open` | `/admin/unit/A/analytics/lists?filter=pendencies_open` | Leitos com ≥1 pendência `open`, sort desc por contagem |
| `pendencies_overdue` | `/admin/unit/A/analytics/lists?filter=pendencies_overdue` | Leitos com ≥1 pendência vencida, sort desc por contagem vencida |

---

## 7. Dados de Teste (seed)

| Bed | Pendências | Estado |
|---|---|---|
| `301.1` | 1 open (sem prazo) | Aparece em `pendencies_open` |
| `301.2` | 2 open (1 vencida: hemoculturas) | Aparece em `pendencies_open` e `pendencies_overdue` |
| `302.1` | 1 done | Não aparece nos filtros open/overdue |
| `302.2` | 2 open vencidas | Aparece em `pendencies_open` e `pendencies_overdue` |

---

## 8. Como Reproduzir

```bash
# 1. Iniciar emuladores
npm run emulators

# 2. Seed dos dados (em outro terminal)
npm run seed

# 3. Verificar filtros na UI
# http://localhost:5173/admin/unit/A/analytics/lists?filter=pendencies_open
# http://localhost:5173/admin/unit/A/analytics/lists?filter=pendencies_overdue

# 4. Verificar editor
# http://localhost:5173/editor/bed_301.2?unit=A
# → Seção "Pendências" visível com 2 itens (1 vencido em vermelho)
# → Adicionar nova pendência: digitar título + Enter
# → Marcar como done: clicar no checkbox vazio

# 5. Verificar Mission Control
# http://localhost:5173/admin/unit/A/analytics
# → Cards "Pendências abertas" e "Pendências vencidas" visíveis
# → Clicar drill-down redireciona para lista filtrada

# 6. Verificar compilação
cd ward-board && npx tsc --noEmit   # → 0 erros
```

---

## 9. Dívidas Técnicas v1.1

| Item | Impacto | Prioridade |
|---|---|---|
| Real-time listener no BedDetails para atualizar pendencies sem recarregar | UX | Médio |
| Campo `doneAt` tipado como `TimestampLike` — conversão em `seed-data.ts` usa string ISO | Seed apenas | Baixo |
| Pendências na TV (exibir badge de "X pendências" no card do leito) | Visibilidade | Alto |
| Permissão `deletePendency` — atualmente qualquer editor pode deletar | Segurança | Médio |

---

## 10. Verificação tsc

```
tsc --noEmit → 0 erros  ✅ (2026-02-28)
```
