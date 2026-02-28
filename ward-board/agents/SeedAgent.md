# SeedAgent: Data & Seed Specialist

The SeedAgent manages the creation and maintenance of seed data, Firestore data migrations, and test fixtures to ensure consistent and realistic data across all environments.

## Specializations

- **Seed Scripts**: Writing and updating `seed-data.ts` scripts that populate the Firebase Emulator with realistic hospital data.
- **Data Migrations**: Creating scripts to safely transform or migrate Firestore data when the schema evolves.
- **Test Fixtures**: Providing consistent, reproducible datasets for E2E tests and QA sessions.
- **Data Modeling**: Collaborating with DatabaseAgent to ensure seed data reflects the current domain model accurately.
- **Multi-Environment**: Managing separate seed profiles for dev, staging, and production demos.

## Technical Stack

- TypeScript
- Firebase Admin SDK
- Firebase Emulator Suite
- Node.js scripts

---

## Estado Atual — seed-data.ts (v1.1, 2026-02-28)

Arquivo: `scripts/seed-data.ts`

### Helpers Atuais

```typescript
const SEED_ACTOR = { id: 'seed', name: 'System Seed' };  // extraído como constante

const makePendency = (
    title: string,
    status: 'open' | 'done' | 'canceled',
    opts: { domain?, dueAt?, doneAt?, canceledAt?, note? } = {}
): PendencyDoc => { ... }
// - Se status='done' && opts.doneAt → preenche doneAt/doneBy/updatedAt/updatedBy
// - Se status='canceled' && opts.canceledAt → preenche canceledAt/canceledBy/updatedAt/updatedBy
```

```typescript
// makeKamishibaiEntry: gera entry v1 completo
function makeKamishibaiEntry(status: 'ok' | 'blocked', updatedAt: string) {
    // inclui: status, updatedAt, updatedBy, note, reviewedShiftKey, reviewedAt
    // se blocked: adiciona blockedAt (1–18h atrás), reason
}
```

### Perfis de Bed com Pendências

| Bed | Pendências | Cenário testado |
|---|---|---|
| `301.1` | 1 open (sem prazo) | open sem overdue badge |
| `301.2` | 2 open (1 vencida: `dueAt = ontem`) | overdue detectado pelo renderer |
| `301.3` | 1 **canceled** (com `canceledAt/canceledBy/note`) | histórico preservado; não conta nos KPIs |
| `302.1` | 1 done | não aparece em filtros open/overdue |
| `302.2` | 2 open vencidas | aparece em `pendencies_open` + `pendencies_overdue` |

### Kamishibai v1 — Perfis Especiais

| Bed | Cenário | Comportamento esperado na UI |
|---|---|---|
| `301.4` | `ok` SEM `reviewedShiftKey` (v0 legado) | UNREVIEWED_THIS_SHIFT (sem cor) — migração conservadora |
| `301.3` | `na` nos domínios psychology/social (legado) | NOT_APPLICABLE (sem dot) |
| `302.x` | Bloqueado há > 18h | aging real visível no Mission Control |

### Dívida SeedAgent v1.2

- Verificar se `totalBedsCount` deve ser 33 ou 36 — seed atual pode estar excluindo leitos vazios do perfil aleatório.
- Adicionar perfil de bed **completamente vazio** (sem `patientAlias`) para testar estado INACTIVE na UI.
