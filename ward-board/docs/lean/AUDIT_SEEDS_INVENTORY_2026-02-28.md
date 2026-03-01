# Audit Seeds: Inventory

## 1. Mapeamento de Arquivos de Seed

| Path | Tipo | Entradas / Env | O que cria (Coleções/Docs) | Quem chama / Contexto |
| :--- | :--- | :--- | :--- | :--- |
| `scripts/seed-data.ts` | Script Node/TS | `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` | `users`, `authorized_users`, `units`, `units/{id}/users`, `units/{id}/settings`, `units/{id}/beds`, `units/{id}/huddles` | NPM script: `npm run seed` (E2E tests pressupõem execução prévia) |
| `functions/src/__tests__/analytics/getAdminFlowMetricsBQ.test.ts` (`seedReset`, `seedUpdateClear`, `seedUpdateNonDischarge`) | Helper E2E/Unitário (Jest/Vitest) | `date`, `expectedDischarge` | Documentos de log na simulação de flow (mockados para testes do BigQuery export) | Testes unitários internos do arquivo |
| `functions/src/__tests__/analytics/getAdminTrendComparisonBQ.test.ts` (`seedAuditLog`) | Helper E2E/Unitário | `unitId`, `date`, `entityType` | Documentos em `audit_logs` simulando o histórico de eventos | Testes unitários internos do arquivo |

## 2. Resumo da Distribuição

O repositório possui uma base simplificada:

* Não há profusão de scripts divergentes (`seed-base`, `seed-stress`, etc). Existe um **seed canônico monolítico** focado em popular todo o emulador Firebase local, que é o arquivo `scripts/seed-data.ts`.
* Funcionalidades E2E (testados com Playwright via `tests/*.spec.ts`) não criam seu próprio estado (em sua maioria); eles partem do princípio que o desenvolvedor/CI rodou `npm run seed` antes de inciar a suite E2E.
* Há pequenos helpers com sufixo ou nome `seed` dentro da pasta `functions/__tests__`, gerando "audit logs" para testar extratores do BigQuery. Mas eles são estritamente escopados à função que testam, não impactando o ambiente de emulador global.
