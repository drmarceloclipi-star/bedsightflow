# AUDIT — Kamishibai States & Colors

**Data:** 2026-02-28 | **Auditor:** Agente Antigravity | **Missão:** somente leitura

---

## 1. Estados definidos hoje

**Evidência:** [`src/domain/types.ts:12`](../../../src/domain/types.ts#L12)

```typescript
export type KamishibaiStatus = 'ok' | 'blocked' | 'na';
```

| Estado | Valor | Significado no código | Cor/CSS |
| -------- | ------- | ----------------------- | --------- |
| OK / Concluído | `'ok'` | Sem bloqueio, tarefa realizada | `kamishibai-dot ok` → CSS verde |
| Bloqueado | `'blocked'` | Impedimento ativo para esta equipe | `kamishibai-dot blocked` → CSS vermelho |
| N/A | `'na'` | Especialidade não envolvida no caso | `kamishibai-dot na` → CSS cinza/sem cor |

**Evidência de renderização:** [`src/features/tv/components/KamishibaiScreen.tsx:30`](../../../src/features/tv/components/KamishibaiScreen.tsx#L30)

```tsx
<div className={`kamishibai-dot ${entry?.status || 'na'}`} />
```

> **IMPORTANTE:** Se `entry` é `undefined` (especialidade não mapeada para o leito), o componente faz fallback para `'na'`. Não existe estado "sem cor" explícito — `'na'` é o estado padrão implícito de leitos sem paciente ou sem entry registrada.

---

## 2. Domínios Kamishibai e ordem canônica

**Evidência:** [`src/domain/specialtyUtils.ts:15-17`](../../../src/domain/specialtyUtils.ts#L15)

```typescript
export const KAMISHIBAI_DOMAINS: SpecialtyKey[] = [
    'medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social'
];
```

Ordem canônica explicitamente documentada no código:
> `MÉDICA · ENFERMAGEM · FISIOTERAPIA · NUTRIÇÃO · PSICOLOGIA · SERVIÇO SOCIAL`

**Rótulos exibidos na TV:**

```typescript
// specialtyUtils.ts:83-92
medical:    'MÉDICA'
nursing:    'ENFERMAGEM'
physio:     'FISIOTERAPIA'
nutrition:  'NUTRIÇÃO'
psychology: 'PSICOLOGIA'
social:     'SERVIÇO SOCIAL'
```

---

## 3. Onde o estado é calculado (frontend vs backend)

| Operação | Local | Evidência |
| ---------- | ------- | ----------- |
| **Leitura/exibição** do status | Frontend (`KamishibaiScreen.tsx`) | `entry?.status \|\| 'na'` |
| **Escrita** do status | Frontend → Firestore direto via `BedsRepository.updateBed()` | `BedsRepository.ts:47-62` |
| **Contagem de impedimentos** (Analytics) | Backend — Cloud Function `getAdminMissionControlSnapshot` | `functions/src/callables/analytics/getAdminMissionControlSnapshot.ts:112-120` |
| **Reset de kamishibai** | Backend — Cloud Function `resetBedKamishibai` | `functions/src/callables/resetBedKamishibai.ts` |

O status kamishibai **não tem lógica de transição automática** — é 100% manual (escrito pelo usuário via Editor).

---

## 4. Onde o status é armazenado no Firestore

**Path:** `units/{unitId}/beds/{bedId}.kamishibai.{domainKey}`

**Estrutura do campo:**

```typescript
// types.ts:56-61
export interface KamishibaiEntry {
    status: KamishibaiStatus;     // 'ok' | 'blocked' | 'na'
    updatedAt: string | Timestamp;
    updatedBy?: ActorRef;
    note?: string;
}
```

**Exemplo JSON (seed-data.ts:240-247):**

```json
{
  "kamishibai": {
    "medical":     { "status": "ok",      "updatedAt": "2026-02-28T14:30:00Z", "note": "", "updatedBy": { "id": "uid_abc", "name": "Dr. Silva" } },
    "nursing":     { "status": "blocked", "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "uid_abc", "name": "Dr. Silva" } },
    "physio":      { "status": "na",      "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "seed", "name": "System Seed" } },
    "nutrition":   { "status": "ok",      "updatedAt": "2026-02-28T10:15:00Z", "note": "", "updatedBy": { "id": "uid_abc", "name": "Dr. Silva" } },
    "psychology":  { "status": "na",      "updatedAt": "2026-02-28T08:00:00Z", "note": "", "updatedBy": { "id": "seed", "name": "System Seed" } },
    "social":      { "status": "blocked", "updatedAt": "2026-02-27T16:00:00Z", "note": "", "updatedBy": { "id": "uid_def", "name": "Enf. Maria" } }
  }
}
```

---

## 5. Como o Kamishibai é ligado/desligado

**Não existe flag de enable/disable do Kamishibai** no sistema atual. O Kamishibai é ligado/desligado **indiretamente**, controlando se a screen `'kamishibai'` está habilitada no BoardSettings:

**Path:** `units/{unitId}/settings/board.screens[]`

```typescript
// BoardSettingsRepository.ts:11-15
const DEFAULT_SCREENS: BoardScreenConfig[] = [
    { key: 'kanban', label: 'Quadro Kanban', durationSeconds: 15, enabled: true },
    { key: 'kamishibai', label: 'Quadro Kamishibai', durationSeconds: 15, enabled: true },
    { key: 'summary', label: 'Resumo da Unidade', durationSeconds: 10, enabled: true },
];
```

O campo `enabled: boolean` por screen controla se a tela aparece na rotação da TV. Mas **os dados kamishibai no Firestore existem independentemente** — não há "modo kamishibai desabilitado" que impeça gravação ou leitura dos dados.

---

## 6. Gaps identificados vs Lean do hospital

| # | Gap | Impacto |
| --- | ----- | --------- |
| G1 | Não existe estado "sem cor" / "inativo" binário — `'na'` serve tanto para "não aplicável" quanto para "leito vazio" | Kamishibai Lean exige: sem cor = leito inativo; verde = OK; vermelho = bloqueado |
| G2 | Não há `updatedAt` por kamishibai sendo comparado com horário do huddle | Sem visibilidade de "foi revisado neste turno?" |
| G3 | O status `'ok'` não tem TTL (não reseta entre turnos) — um `ok` de ontem ainda aparece verde | Lean exige que verde seja "revisado e ok NESTE turno" |
| G4 | Ausência de campo `reviewedAt` ou `lastHuddleAt` por domínio | Impossível rastrear quando a revisão aconteceu |
| G5 | `note` existe no schema mas não é visível/editável na TV nem no Editor (audit a confirmar) | Campo morto no MVP |
