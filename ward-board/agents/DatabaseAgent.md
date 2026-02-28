# DatabaseAgent: Firestore & Data Specialist

The DatabaseAgent is specialized in everything related to the project's data layer, specifically Firebase Firestore.

## Specializations

- **Schema Design**: Defining collections, documents, and nested structures.
- **Security Rules**: Writing and optimizing `firestore.rules`.
- **Indexes**: Managing composite indexes for complex queries.
- **Data Integrity**: Ensuring consistency across the database.
- **Seed Data**: Creating and managing scripts for populating development and testing environments.

## Technical Stack

- Firebase Firestore (always use `southamerica-east1` region)
- Firebase Security Rules
- TypeScript (for data models and seeding scripts)

---

## Schema Atual — `units/{unitId}/beds/{bedId}`

### Pendências v1.1 (2026-02-28)

O campo `pendencies` é um **array embarcado** no documento do bed:

```typescript
export type PendencyStatus = 'open' | 'done' | 'canceled';

export interface Pendency {
  id: string;            // crypto.randomUUID() — gerado no client
  title: string;
  status: PendencyStatus;
  domain?: SpecialtyKey; // opcional (D2: sem owner obrigatório em v1)
  note?: string;
  dueAt?: TimestampLike;
  createdAt: TimestampLike;
  createdBy: ActorRef;   // { id, name }
  updatedAt?: TimestampLike;
  updatedBy?: ActorRef;
  doneAt?: TimestampLike;
  doneBy?: ActorRef;
  canceledAt?: TimestampLike;  // preserva evidência (≠ delete físico)
  canceledBy?: ActorRef;
}
```

### Regras de Integridade

- **Cancel ≠ Delete**: `canceled` preserva evidência no documento. Delete físico é operação de admin via `runTransaction`.
- **Concorrência**: `addPendency` usa `arrayUnion`; `markPendencyDone` e `cancelPendency` usam `runTransaction`.
- **Campos obrigatórios**: `id`, `title`, `status`, `createdAt`, `createdBy`.
- **WARN_PENDENCY_MISSING_ID**: CF loga `console.warn` quando pendência sem `id` é detectada.

### Kamishibai v1 (schema vigente)

```typescript
interface KamishibaiEntry {
  status: 'ok' | 'blocked' | 'na';
  updatedAt: TimestampLike;
  updatedBy: ActorRef;
  note: string;
  reviewedShiftKey?: string;  // 'YYYY-MM-DD_AM' | 'YYYY-MM-DD_PM' — v1
  reviewedAt?: TimestampLike;
  blockedAt?: TimestampLike;  // v1 — quando bloqueio iniciou
  reason?: string;
}
```

### Campos do Bed (nível raiz)

- `applicableDomains: SpecialtyKey[]` — domínios aplicáveis ao leito
- `mainBlocker: string` — bloqueador principal do fluxo
- `mainBlockerBlockedAt?: TimestampLike` — quando bloqueio principal iniciou
- `kamishibai: Record<SpecialtyKey, KamishibaiEntry>`
- `pendencies: Pendency[]`
- `expectedDischarge?: '24h' | '48-72h' | '>3d' | ''`

### Documentos de Referência

- `docs/lean/LEAN_CONTRACT_HRHDS.md` — contrato canônico
- `docs/lean/LEAN_MIGRATION_MAP_v0_to_v1.md` — migração v0 → v1
- `docs/lean/SCHEMA_V1_CHANGELOG.md` — changelog do schema
