# Huddle Snapshot Summary — Acceptance Criteria & Evidence

**Date:** 2026-02-28
**Feature:** Huddle Snapshot Summary (Etapa 1.8.3)
**Author:** AI Agent

## 1. Contexto e Missão

O objetivo desta feature é registrar, dentro do documento de cada Huddle (`HuddleDoc`), uma captura do estado operacional ("foto") no momento de **início** e **fim** do Huddle. Isso atende ao objetivo Lean de comparar se as decisões tomadas naquele huddle surtiram impacto imediato/direção correta e embasa relatórios de engajamento diário.

## 2. Abordagem Técnica

Para não criar duplicação de lógicas de "snapshot" nem dependência complexa de CRON jobs e BigQuery:

- Usamos a mesma Cloud Function de obtenção de snapshot do Mission Control (`getAdminMissionControlSnapshot`).
- Criamos o `MissionControlRepository.getHuddleSnapshotSummary` abstraindo chamadas HTTP e extraindo apenas os 8 KR's essenciais (total/ocupados/bloqueados, max aging, altas 24h, sem revisão, pendências vencidas, escalonamentos críticos vencidos).
- Ao **iniciar** (`HuddleRepository.upsertHuddleStart`) ou **encerrar** (`HuddleRepository.setHuddleEnded`) um huddle, a foto atual é batida, tipada como `HuddleSnapshotSummary` e injetada no banco (`startSummary`, `endSummary`).

## 3. Modificações (Resumo)

- `src/domain/huddle.ts`: Adicionado as propriedades `startSummary?: HuddleSnapshotSummary` e `endSummary?: HuddleSnapshotSummary` no `HuddleDoc`.
- `src/repositories/MissionControlRepository.ts`: (NOVO) Encapsula a lógica de chamar a callable e retornar tipo formatado, com "fail-safe" (retorna undefined se a function falhar, e não quebra o Huddle).
- `src/repositories/HuddleRepository.ts`: Alteração nas funções de Start/Ended do Huddle para acoplar esse fetch assíncrono.
- `src/features/admin/components/ops/HuddleConsole.tsx`: Nova UI que consome `startSummary` e `endSummary`, calculando _deltas_ e exibindo indicadores (verde para melhoria, vermelho para piora, neutro mantido).

## 4. Evidência de Aceite

| Critério de Aceite | Status | Observação |
| :--- | :--- | :--- |
| **Início Huddle (Start)**: Salvar snapshot do instante da abertura | ✅ DONE | `upsertHuddleStart` agora busca o snapshot antes de salvar `startedAt`, persistindo na raiz do documento Huddle. |
| **Fim Huddle (End)**: Salvar snapshot do instante de encerramento | ✅ DONE | Função `setHuddleEnded` mapeada e injetada com get snapshot; o componente condicionalmente muda de formulário para finalizado. |
| **Comunicação Segura (Fail Safe)** | ✅ DONE | Se o cloud function falhar / offline, apenas captura snapshot = undefined e não bloqueia a continuação do uso do painel |
| **Visualização Deltas** | ✅ DONE | Criado component `MetricDeltaCard` que pinta o balão dinamicamente (para "Discharges", delta positivo é bom, logo +X no balanço final pinta de verde). |
| **Testes Iniciais/Seeds** | ✅ DONE | Script `seed-data.ts` foi expandido para colocar huddle histórico (`lastHuddleShiftKey`) já preenchido com dados ricos e deltas mockados de "antes" para "depois". |

## 5. Próximos Passos

Esta etapa finaliza a funcionalidade núcleo do Mission Control Operacional (Visão Huddle Lean).
Pode-se seguir com a Etapa 1.9 (se existir) na trilha de Release Candidate.
