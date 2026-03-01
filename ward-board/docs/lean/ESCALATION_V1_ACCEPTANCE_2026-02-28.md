# Aceite de Funcionalidade: Escalonamento v1 (Somente Visual)

**Data:** 28 de Fevereiro de 2026
**Funcionalidade:** Escalonamento v1 (Cloud Functions & Mission Control)
**Critérios Aceitos Em:** `docs/lean/LEAN_CONTRACT_HRHDS.md` e Mission Control Specifications.

---

## 1. Resumo da Implementação

Foi implementada a primeira versão do sistema de escalonamento Lean. Em alinhamento com os requisitos de design system e minimização de infraestrutura adicional (sem novos CRONs ou subscrições ativas), o escalonamento atua processando passivamente sobre os snapshots analíticos atuais gerados a cada recarga do Mission Control do Admin.

O foco é trazer à tona ("surface") imediatamente as restrições que estão em nível Crítico:

1. **Pendências com longo prazo de vencimento:** quando uma pendência de escopo médico ultrapassa 12 horas desde seu estipulado \`dueAt\`.
2. **Bloqueadores críticos prolongados:** leitos bloqueados há mais de 24 horas consecutivas pela mesma restrição (\`mainBlockerBlockedAt\` vs \`now\`).

---

## 2. Thresholds e Parametrização

Para governança, os thresholds são dinâmicos através das settings do Firestore (`units/{unitId}/settings/mission_control`), suportando default fallbacks de segurança em hardcode:

| Atributo | Default Fallback (Horas) | Finalidade |
| --- | --- | --- |
| `escalationOverdueHoursWarning` | 6 | SLA amarelo para atraso de pendências (reservado para exp. futura) |
| `escalationOverdueHoursCritical` | 12 | SLA vermelho para atraso de pendências |
| `escalationMainBlockerHoursWarning` | 8 | SLA amarelo para age de main blockers (reservado) |
| `escalationMainBlockerHoursCritical` | 24 | SLA vermelho para age de main blockers |

---

## 3. Modificações de Backend (Cloud Functions)

A Cloud Function \`getAdminMissionControlSnapshot\` foi expandida para iterar sobre as regras de escalonamento durante o censo:

- Ao inspecionar `openPendencies`, se qualquer uma das abertas possuir idade de vencimento \`>= escalationOverdueHoursCritical\`, o *Bed ID* é promovido ao bucket de \`overdueCriticalBedIds\`.
- Ao inspecionar \`blockedMs\` (seja via *realtime tracker* \`mainBlockerBlockedAt\` ou o proxy \`updatedAt\`), se a idade de bloqueio for \`>= escalationMainBlockerHoursCritical\`, o *Bed ID* é acrescido em \`blockerCriticalBedIds\`.
- O snapshot emitido consolida uma assinatura `escalations: EscalationCounts` totalizando o status combinando ambos sem duplicatas cruzadas.

---

## 4. UI e Mission Control

- **MissionControlCard**: A interface de base para KPIs foi tunada para processar drilldowns múltiplos (ação dividida ou combinada).
- **Mission Control Tab**: O dashboard operacional agora detém uma nova linha de observação de **🔥 Escalonamentos**, apresentando cor visual dinâmica baseada em `escalationStatus()` que inflama a cor para CRITICAL perante a existência de `>= 1` paciente nessa fila.
- **Drilldowns Dedicados**: Um supervisor pode clicar em "Ver X pendências de longo atraso" ou "Ver Y bloqueios graves". Esses botões disparam rotas de List para *resolução*.
- **Analytics List Filters**: O sistema de listas do admin comporta duas novas resoluções virtuais (\`escalations_overdue\` e \`escalations_blocker\`), onde a query client-side recalcula no exato threshold para emular a perspectiva do snapshot num painel linear de Action Items.

---

## 5. Passos para Validação do Cliente (QA Workflow)

Para validar a integridade estrita deste modelo:

1. Abra um leito. Gere um Impedimento principal, ajuste (em emulador manual DB) a data da field \`mainBlockerBlockedAt\` para `now - 25 horas`. Recarregue o Admin. Um Escalonamento deve pipocar no Mission Control.
2. Desbloqueie o mesmo leito. Crie uma pendência operacional cujo \`dueAt\` foi setada para um dia no passado (Ex: `now - 14h`). Recarregue o Admin. A contagem do Escalonamento também deve flag-lo.
3. Teste o drilldown visual no botão; você deve ser guiado à lista específica destes exatos leitos.

---
**Status Final:** ✅ Concluído. Zero typescript errors. Design System e arquitetura passivos integralmente acomodados.
