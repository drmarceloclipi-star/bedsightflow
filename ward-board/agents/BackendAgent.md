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
  "bedsWithOpenPendenciesIds": ["301.1", "301.2", "302.2"],
  "escalations_overdue": 2,
  "escalations_blocker": 1,
  "overdueCriticalBedIds": ["101.1"],
  "blockerCriticalBedIds": ["102.2"]
}
```

### LSW e Escalonamentos (Etapas 1.6 a 1.8.1)

- **Escalonamento Canônico:** Toda a lógica pesada de escalonamento baseada no tempo está centralizada em `src/domain/escalation.ts`. `computeEscalations(beds)` retorna os IDs e os totais de leitos com pendências ou bloqueios críticos.
- **Shared Functions:** O código de escalonamento foi duplicado (devido a restrições de build do functions V2) em `functions/src/shared/escalation.ts` e é usado na Cloud Function `getAdminMissionControlSnapshot.ts` para manter um Single Source of Truth para Mission Control, relatórios e TV.

### Dívida Técnica

- **RBAC server-side para `deletePendency`**: criar CF intermediária que valida `context.auth.token.admin === true` antes de executar remoção física.
