# Audit Seeds: Lean Suite Coverage (Gap Analysis)

## Análise de Cobertura Atual (`scripts/seed-data.ts` vs Testes Lean)

Com base no inventário e análise de determinismo de `scripts/seed-data.ts`, a cobertura de testes para a "Lean Suite" é **parcial**. Há dados simulando o board que atendem às regras, mas o não-determinismo introduz inconsistências (flakiness) na validação dos testes E2E.

### Checklist Lean Suite (vs Seed Canonical)

| Requisito do Teste (Lean Suite) | Coberto no Seed? | Observações Gap |
| :--- | :---: | :--- |
| **Users / Configurações** |
| Users: admin/editor (role unit), auth ok | ✅ Sim | Usuários criados de forma determinística com roles adequados. |
| `settings/ops`: kamishibaiEnabled + schedule | ✅ Sim | Configurado (`kamishibaiEnabled: true, huddleSchedule: { amStart: '07:00'...}`). |
| `settings/mission_control`: thresholds de escalation | ✅ Sim | Valores de warning/critical default populados de maneira fixa. |
| **Beds & Domains** |
| 1 Leito vazio | ✅ Sim | Leito `302.3` criado explicitamente na lista de fix cases. |
| 1 Leito unreviewed | 🟡 Parcial | O caso em `301.4` simula entrada "na", que mapeia temporariamente para Unreviewed (legado), porém na v1 seria melhor um bed "ok/blocked" formal que não possui ou falhou match com o current shiftKey. Os demais leitos randômicos "podem" cair como unreviewed. |
| 1 Leito blocked c/ `blockedAt` e `mainBlockerBlockedAt` | ✅ Sim | Configurado em `301.1` e fix cases ESCALATION-02 e ESCALATION-03. Falta garantir determinismo nos timestamps (hoursAgo usa `Date.now()`). |
| 1 Leito com aplicabilidade excluindo 1 domínio | ✅ Sim | Leito `301.2` possui apenas `['medical', 'nursing', 'nutrition', 'psychology']` aplicáveis. |
| **Pendencies** |
| Estados Open / Overdue / Done / Canceled | ✅ Sim | Casos configurados nos perfis `301.x` e `302.x`. Entretanto, o tempo e os Ids ativadores são gerados dinamicamente via `Math.random` ou `hoursAgo()`. |
| **Escalonamentos (Escalations)** |
| Caso overdue critical forçado | ✅ Sim | Bed `ESCALATION-01` criado e populado para engatilhar >12h overdue. Depende do relógio local rodando. |
| Caso blocker critical forçado | ✅ Sim | Bed `ESCALATION-02` criado e populado para engatilhar mainBlocker > 24h. |
| **Huddle / LSW** |
| Prev shift c/ actions open | ✅ Sim | Carga manual da doc de `prevHuddleCmd` contendo summary e pendências `open` e `done` da squad. |
| Current shift c/ start/end summary | ❌ Não | Há seed do Last Huddle, mas o Huddle "Atual" (o turno corrente do teste) não tem dados start/endSummary simulados pela base de seed caso o teste assuma a carga completa dele para assert. |
| Tracking de métricas claras | 🟡 Parcial | Usa Math.random no turno anterior para timestamps e arrays, dificultando snapshots estritos com snapshot-plugins. |

---

## Conclusão da Cobertura

* **Status Global**: 🟡 **Adequado, porém instável (Flaky)**.
* **Causa do Gap Principal**: Em vez de ter uma *foto instantânea (snapshot)* de data/hora no emulador para o E2E ler (onde 9h da manhã de 2026-02-28 é sempre exata), o seed roda "em relação a agora" (hoursAgo). Isso requer que os E2Es calculem "agora" - atraso para achar o mock, o que abre brecha pra viradas de limites (time-boundaries shifts, turnos PM->AM) quebrarem a inferência se os testes rodarem no limite das 06:59 -> 07:00, ou em CIs assíncronos. E a geração de IDs de pendência bloqueia verificações de botões ou click mappings pelo Playwright (`click on #pendency-XYZ`).
