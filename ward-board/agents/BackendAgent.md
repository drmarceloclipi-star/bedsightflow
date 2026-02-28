# BackendAgent: Logic & Integration Specialist

The BackendAgent focuses on the server-side logic and integrations that power the LEAN system.

## Specializations

- **Cloud Functions**: Developing, deploying, and optimizing Firebase Cloud Functions (v2).
- **Business Logic**: Implementing complex server-side validations and workflows.
- **Third-Party APIs**: Managing integrations with external services.
- **Performance**: Optimizing backend latency and resource usage.
- **Security**: Ensuring secure communication between frontend and backend.

## Technical Stack

- Node.js
- TypeScript
- Firebase Cloud Functions (always use `southamerica-east1` region)
- Google Cloud Platform

---

## Estado Atual — getAdminMissionControlSnapshot (v1.3+1.4, 2026-02-28)

Arquivo: `functions/src/callables/analytics/getAdminMissionControlSnapshot.ts`

### Mudanças da Etapa 1.3 (Mission Control v1)

| Mudança | Detalhe |
|---|---|
| Aging real KPI1 | Usa `mainBlockerBlockedAt` (não mais `updatedAt`) |
| Freshness por domínio | `max(reviewedAt)` por leito dentre domínios aplicáveis |
| Thresholds configuráveis | `unitSettings.thresholds` com fallback para defaults hardcoded |
| `unreviewedBedIds[]` | Leitos com ≥1 domínio aplicável sem `reviewedShiftKey === current` |
| Falso positivo removido | `blockedAt` errado substituído por `mainBlockerBlockedAt` |

### Mudanças da Etapa 1.4 (Pendências v1.1)

```typescript
// Integridade: WARN se pendência sem id
const missingIds = rawPendencies.filter((p) => !p.id)
if (missingIds.length > 0) {
    console.warn('WARN_PENDENCY_MISSING_ID', { bedId, count: missingIds.length })
}

// Somente status='open' com id válido conta — 'canceled' e 'done' ignorados
const openPendencies = rawPendencies.filter(
    (p) => p.status === 'open' && p.id
)
```

### Payload atual

```json
{
  "generatedAt": "...",
  "source": "snapshot_firestore",
  "definitionsVersion": "v1",
  "totalBedsCount": 33,
  "activeBedsCount": 28,
  "blockedBedsCount": 4,
  "blockedBedIds": ["301.2", "..."],
  "unreviewedBedIds": ["302.3", "..."],
  "openPendenciesCount": 5,
  "overduePendenciesCount": 3,
  "bedsWithOpenPendenciesCount": 3,
  "bedsWithOpenPendenciesIds": ["301.1", "301.2", "302.2"]
}
```

### Dívida v1.2

- **RBAC server-side para `deletePendency`**: criar CF intermediária que valida `context.auth.token.admin === true` antes de executar remoção física.
- **`totalBedsCount` = 33, não 36**: verificar se seed ou filtro exclui leitos sem `patientAlias`.
