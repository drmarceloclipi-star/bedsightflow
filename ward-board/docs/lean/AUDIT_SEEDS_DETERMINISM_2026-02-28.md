# Audit Seeds: Determinism and Flakiness

## Análise de Flakiness no `scripts/seed-data.ts`

A atual implementação do seed contém múltiplos focos de **não-determinismo** que introduzem "flakiness" em testes E2E e unitários dependentes deste banco.

| Elemento | Status | Linhas Afetadas | Risco | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `Math.random()` | 🔴 Alta Frequência | 100-103, 107-112, 147, 176, 191-193, 208, 220-223, 540, 543, 546, 549 | Quebra E2E | Usado extensivamente para definir: Blockers aleatórios, Tempo de Alta (Discharge), Status do Kamishibai (`ok` vs `blocked`), tempo do `blockedAt` (1h a 18h atrás), categorias de _Staleness_ (Freshness analytics) e aplicabilidade de domínios. Isso gera renderizações de UI completamente imprevisíveis entre as execuções. |
| `Date.now()` / `new Date()` | 🔴 Alta Frequência | 38, 42-43, 217, 245, 250, 265, 270, 301, 355, 631, etc. | Quebra E2E (Time-sensitive) | Todas as métricas baseadas em tempo (Due, Overdue, Freshness age, Blocker age, Huddle Summaries) dependem do relógio _real_ do momento da execução. Testes que busquem "pacientes bloqueados há >24h" podem falhar se a execução passar por viradas de dia ou limites de shift. |
| Timezone | 🟡 Médio | 16-36 | Possível quebra | `seedComputeShiftKey` hardcodou `America/Sao_Paulo`, o que é bom para consistência do script. Entretanto, a dependência do relógio local (item acima) acoplado com o fixed TZ cria bordas imprevisíveis se rodado à meia-noite em um CI com timezone UTC. |
| IDs Dinâmicos | 🔴 Alta Frequência | 147 | Quebra E2E | Os IDs de pendências são gerados via `Math.random().toString(36)`. Testes não conseguem mirar em `.tv-badge--pendencies[data-id="X"]`, forçando o uso do texto e posições possivelmente ambíguas na tela. |
| Ordem / Race Conditions | 🟢 Aceitável | Geral | Baixo | As escritas principais ocorrem após transações resolvidas (`await doc.set(...)` num loop `for...of`), logo os dados são previsíveis no tempo de "commit" final. |
| Limpeza (Teardown) | 🟡 Médio | 362-370 | Lixo Acumulado | O script deleta `beds` existentes da Unit A, mas não limpa de forma granular `huddles` antigos, ou usuários sobressalentes que não estejam no scope original, deixando resíduos se o emulador for reaproveitado e não reiniciado clean. |

## Resumo dos Casos Forçados (Determinísticos) vs Aleatórios

**Casos Forçados Existentes (Bons):**

* Os leitos listados explicitamente no dicionário `V1_BED_PROFILES` (`301.1` até `302.3`) têm valores mockados com strings fixas em suas bases, **mas** a inicialização de horários neles usa `hoursAgo()` que depende de `Date.now()`.
* Leitos `ESCALATION-01/02/03` tentam fixar dados para as lógicas de escalonamento.

**Gerados Dinamicamente (Ruins):**

* A geração de IDs das pendências usa Math.random mesmo nos casos forçados.
* Nos leitos em `V1_BED_PROFILES`, os horários base chamam `hoursAgo(...)`, o que move os buckets de tempo à cada chamada do script. Exemplo: um teste que espera "Pendência overdue há > 6h" pode ser validado pela matemática do script, mas na UI, a formatação de "Due in X hours" (ex: relative time plugin) pode gerar outputs variáveis.
* O resto dos leitos (~27 leitos) recebem status, domínios, timers randômicos.
