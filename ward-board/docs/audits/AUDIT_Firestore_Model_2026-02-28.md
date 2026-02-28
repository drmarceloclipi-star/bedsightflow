# AUDIT — Firestore Model Canônico

**Data:** 2026-02-28 | **Auditor:** Agente Antigravity | **Missão:** somente leitura

---

## 1. Mapa de coleções

```
/authorized_users/{uid}          ← whitelist global de usuários autorizados
/units/{unitId}                  ← documento raiz da unidade
/units/{unitId}/beds/{bedId}     ← leito (dado operacional principal)
/units/{unitId}/settings/board   ← configurações da TV (rotação, duração)
/units/{unitId}/settings/ops     ← configurações operacionais (kanbanMode)
/units/{unitId}/users/{uid}      ← RBAC por unidade (role: admin|editor|viewer)
/units/{unitId}/audit_logs/{id}  ← logs imutáveis de auditoria
```

> **Não existe:** coleção `patients`, `kamishibai` top-level, `kanban` top-level, `mission_control`, `analytics_snapshots`. Tudo está embutido no documento `bed`.

---

## 2. Schemas detalhados

### 2.1 `/units/{unitId}` — Unit

**Evidência:** [`src/domain/types.ts:85-90`](../../../src/domain/types.ts#L85)

```typescript
interface Unit {
    id: string;
    name: string;
    totalBeds: number;
    specialties: SpecialtyKey[]; // especialidades disponíveis na unidade
}
```

**Exemplo real (seed-data.ts:177-182):**

```json
{
  "id": "A",
  "name": "Unidade A",
  "totalBeds": 36,
  "specialties": ["medical", "nursing", "physio", "nutrition", "psychology", "social"]
}
```

---

### 2.2 `/units/{unitId}/beds/{bedId}` — Bed

**Evidência:** [`src/domain/types.ts:68-83`](../../../src/domain/types.ts#L68)

```typescript
interface Bed {
    id: string;
    unitId: string;
    number: string;                           // Ex: '301.1', '303'
    patientAlias?: string;                    // Nome social ou iniciais (leito vazio = '')
    expectedDischarge: DischargeEstimate;     // '24h' | '2-3_days' | '>3_days' | 'later'
    mainBlocker: string;                      // texto livre, '' = sem bloqueador
    involvedSpecialties: SpecialtyKey[];      // especialidades envolvidas no caso
    kamishibai: Record<SpecialtyKey, KamishibaiEntry>;
    updatedAt?: string | Timestamp;
    updatedBy?: { uid: string; email: string; displayName?: string };
}
```

**Critério "leito ativo":** `patientAlias !== ''` (trim). Evidência: `getAdminMissionControlSnapshot.ts:66`.

**ID do documento:** `bed_{number}` — ex: `bed_301.1`. Evidência: `seed-data.ts:231`.

**Exemplo de leito ativo (anonimizado):**

```json
{
  "id": "bed_301.1",
  "unitId": "A",
  "number": "301.1",
  "patientAlias": "JC",
  "expectedDischarge": "2-3_days",
  "mainBlocker": "Aguardando laudo RX",
  "involvedSpecialties": ["medical"],
  "kamishibai": {
    "medical":    { "status": "blocked", "updatedAt": "2026-02-28T10:00:00Z", "note": "", "updatedBy": { "id": "uid_abc", "name": "Dr. Silva" } },
    "nursing":    { "status": "ok",      "updatedAt": "2026-02-28T08:30:00Z", "note": "", "updatedBy": { "id": "uid_def", "name": "Enf. Maria" } },
    "physio":     { "status": "na",      "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "seed",   "name": "System Seed" } },
    "nutrition":  { "status": "ok",      "updatedAt": "2026-02-28T09:15:00Z", "note": "", "updatedBy": { "id": "uid_def", "name": "Enf. Maria" } },
    "psychology": { "status": "na",      "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "seed",   "name": "System Seed" } },
    "social":     { "status": "blocked", "updatedAt": "2026-02-27T16:00:00Z", "note": "", "updatedBy": { "id": "uid_ghi", "name": "AS Fernanda" } }
  },
  "updatedAt": { "_seconds": 1740747600, "_nanoseconds": 0 },
  "updatedBy": { "uid": "uid_abc", "email": "dr.silva@hrhds.br", "displayName": "Dr. Silva" }
}
```

**Exemplo de leito vazio (sem paciente):**

```json
{
  "id": "bed_308",
  "unitId": "A",
  "number": "308",
  "patientAlias": "",
  "expectedDischarge": "2-3_days",
  "mainBlocker": "",
  "involvedSpecialties": ["medical"],
  "kamishibai": {
    "medical":    { "status": "na", "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "seed", "name": "System Seed" } },
    "nursing":    { "status": "na", "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "seed", "name": "System Seed" } },
    "physio":     { "status": "na", "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "seed", "name": "System Seed" } },
    "nutrition":  { "status": "na", "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "seed", "name": "System Seed" } },
    "psychology": { "status": "na", "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "seed", "name": "System Seed" } },
    "social":     { "status": "na", "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "seed", "name": "System Seed" } }
  },
  "updatedAt": "2026-02-28T08:00:00Z"
}
```

---

### 2.3 `/units/{unitId}/settings/board` — BoardSettings

**Evidência:** [`src/domain/types.ts:101-115`](../../../src/domain/types.ts#L101)

```typescript
interface BoardSettings {
    unitId: string;
    rotationEnabled: boolean;
    screens: BoardScreenConfig[];
    kanbanBedsPerPage: number;     // default: 18
    kanbanColumnsPerPage?: number; // default: 1
    kamishibaiBedsPerPage: number; // default: 18
    kamishibaiColumnsPerPage?: number; // default: 1
    updatedAt?: string | Timestamp;
    updatedBy?: { uid: string; email: string; displayName?: string };
}
```

---

### 2.4 `/units/{unitId}/settings/ops` — UnitOpsSettings

**Evidência:** [`src/domain/types.ts:145-147`](../../../src/domain/types.ts#L145)

```typescript
interface UnitOpsSettings {
    kanbanMode: KanbanMode; // 'PASSIVE' | 'ACTIVE_LITE'
}
```

**Fallback default:** `'PASSIVE'` (se documento não existir). Evidência: `UnitSettingsRepository.ts:23`.

---

### 2.5 `/units/{unitId}/audit_logs/{logId}` — AuditLog

**Evidência:** [`src/domain/audit.ts`](../../../src/domain/audit.ts)

```typescript
interface AuditLog {
    id: string;
    unitId: string;
    actor: { uid: string; email: string; displayName?: string; role: 'admin' | 'editor' };
    action: string;
    entityType: 'bed' | 'board_settings' | 'unit_user' | 'unit' | 'system';
    entityId: string;
    targetPath: string;
    source: { appArea: 'mobile' | 'tv' | 'admin' | 'system'; screen?: string; feature?: string };
    before?: Record<string, any> | null;
    after?: Record<string, any> | null;
    diff?: Record<string, { before: any; after: any }> | null;
    reason?: string | null;
    correlationId?: string | null;
    createdAt: unknown;
}
```

**Quem grava:** apenas o Trigger `auditBedWrites` (backend) — regra `allow write: if false` no Firestore. Evidência: `firestore.rules:74`.

**Exemplos de audit_logs (anonimizados):**

```json
[
  { "action": "UPDATE_BED", "entityType": "bed", "entityId": "bed_301.1", "actor": { "uid": "uid_abc", "email": "dr@hrhds.br", "role": "editor" }, "diff": { "mainBlocker": { "before": "", "after": "Aguardando laudo RX" } } },
  { "action": "UPDATE_BED", "entityType": "bed", "entityId": "bed_302.1", "actor": { "uid": "uid_def", "email": "enf@hrhds.br", "role": "editor" }, "diff": { "kamishibai.nursing.status": { "before": "na", "after": "blocked" } } },
  { "action": "RESET_BED_KAMISHIBAI", "entityType": "bed", "entityId": "bed_303", "actor": { "uid": "uid_abc", "email": "admin@lean.com", "role": "admin" }, "reason": "Reset de turno" },
  { "action": "UPDATE_BOARD_SETTINGS", "entityType": "board_settings", "entityId": "board", "diff": { "kamishibai[0].enabled": { "before": true, "after": false } } },
  { "action": "SET_UNIT_USER_ROLE", "entityType": "unit_user", "entityId": "uid_xyz", "diff": { "role": { "before": "viewer", "after": "editor" } } }
]
```

---

## 3. Tabela "Conceito → Campo → Valores → Origem → UI"

| Conceito | Campo Firestore | Valores possíveis | Origem do cálculo | Onde renderiza |
|----------|-----------------|-------------------|-------------------|----------------|
| Leito ativo | `patientAlias.trim() !== ''` | boolean derivado | Frontend + Backend | Kanban, Kamishibai, Mission Control |
| Cor/badge Kanban alta | `expectedDischarge` | `'24h'` (verde), `'2-3_days'` (amarelo), `'>3_days'` (vermelho), `'later'` (sem cor/dashed) | Frontend (CSS class) | TV KanbanScreen |
| Status Kamishibai por domínio | `kamishibai.{domain}.status` | `'ok'`, `'blocked'`, `'na'` | Frontend direto | TV KamishibaiScreen |
| Estado "sem cor" Kamishibai | `status === 'na'` ou entry ausente | `'na'` / fallback | Frontend | TV KamishibaiScreen (dot cinza) |
| Modo operacional | `settings/ops.kanbanMode` | `'PASSIVE'`, `'ACTIVE_LITE'` | Frontend (toggle) | TV topbar, Editor topbar, OpsScreen |
| Bloqueador ativo | `mainBlocker.trim() !== ''` | boolean derivado | Backend (snapshot) | Mission Control, Analytics, Kanban |
| Freshness | `updatedAt` vs `now` | 12h / 24h / 48h buckets | Backend (snapshot) | Mission Control cards |
| Impedimento Kamishibai | qualquer `kamishibai.{domain}.status === 'blocked'` | boolean derivado | Backend (snapshot) | Mission Control context card |
| Previsão alta | `expectedDischarge` | enum 4 valores | Frontend direto | Kanban badge |

---

## 4. Regras de escrita (Firestore Security Rules)

**Evidência:** [`firestore.rules`](../../../firestore.rules)

| Coleção | Quem lê | Quem escreve |
|---------|---------|--------------|
| `authorized_users` | qualquer autenticado | global admin |
| `units/{unitId}` | qualquer autenticado | global admin |
| `units/{unitId}/beds/{bedId}` | unit member | unit editor ou admin |
| `units/{unitId}/settings/{doc}` | unit member | **unit admin apenas** |
| `units/{unitId}/audit_logs/{id}` | unit admin | **ninguém** (false) |
| `units/{unitId}/users/{uid}` | unit admin | unit admin |

> **Global Admin** = `auth.token.admin == true` OU email hardcoded (`drmarceloclipi@gmail.com`, `admin@lean.com`).

---

## 5. Numeração de leitos (seed canônico, Unidade A)

36 leitos com padrão `{quartoNúmero}.{subLeito}`:

```
301.1, 301.2, 301.3, 301.4
302.1, 302.2, 302.3
303
304.1, 304.2, 304.3
305.1, 305.2, 305.3, 305.4
306.1, 306.2, 306.3
307.1, 307.2, 307.3, 307.4
308
309.1, 309.2, 309.3
310.1, 310.2
311.1, 311.2, 311.3
312.1, 312.2, 312.3
313.1, 313.2
```

---

## 6. Casos problemáticos observados no modelo

| # | Problema | Evidência | Risco |
|---|---------- |-----------|-------|
| P1 | `updatedAt` do leito não distingue "usuário atualizou kanban" de "usuário atualizou kamishibai" — aging é calculado com esse único timestamp | `getAdminMissionControlSnapshot.ts:95-109` | Aging de bloqueador pode ser subestimado/superestimado |
| P2 | Não existe `blockedAt` dedicado — aging de bloqueador usa `updatedAt` como proxy | `snapshot.ts:95` comentário: "best we have without a dedicated blockedAt" | KPI de aging é impreciso se o leito foi atualizado por outro motivo após o bloqueio |
| P3 | Leito vazio tem kamishibai com status `'na'` — indistinguível de "especialidade não aplicável em leito com paciente" | `seed-data.ts` e `KamishibaiScreen.tsx:30` | Lean: leito sem paciente não deveria ter card kamishibai com cor |
| P4 | Não existe `kanbanMode` protegendo escrita de kamishibai — modo `PASSIVE` não desabilita edição de nada | `UnitSettingsRepository.ts` | KanbanMode é só visual/UI, sem enforcement backend |
| P5 | `note` existe no schema KamishibaiEntry mas não há evidência de UI de edição no Editor | `types.ts:60` | Campo morto — desperdício de schema space |
