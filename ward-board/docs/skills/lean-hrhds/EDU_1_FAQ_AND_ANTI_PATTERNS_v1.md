# EDU-1: FAQ e Anti-Padrões Lean (BedSight)

Este documento compila as dúvidas mais frequentes da operação e os comportamentos tóxicos ("anti-padrões") que destroem a cultura Lean na unidade, juntamente com a forma como o BedSight tenta mitigá-los.

---

## Parte 1: Perguntas Frequentes (FAQ) - 15 Principais

**1. O que acontece se eu esquecer de registrar o Huddle?**
A TV da unidade continuará exibindo uma tarja amarela gigante "⚠ HUDDLE PENDENTE". Isso é visível para pacientes, familiares e toda a equipe, sinalizando que a unidade está voando "às cegas" naquele turno.

**2. Quem pode apagar uma pendência?**
Excluir fisicamente (botão 🗑️) é restrito a Perfis de Administrador. A equipe assistencial (Editores) deve usar o botão "Cancelar (✕)", que exige uma nota justificando o porquê a tarefa não será mais feita.

**3. O que é uma pendência "Overdue" (Vencida)?**
É qualquer pendência cujo prazo estipulado (`dueAt`) ficou no passado. Ela fica vermelha na interface e começa a contar para os indicadores de atraso no Mission Control.

**4. O que é o Escalonamento no BedSight?**
É um alerta passivo que sobe para o Mission Control quando a operação normal falha. Pendências atrasadas há mais de 12 horas ou pacientes bloqueados por mais de 24h acionam o "🔥 Escalonamentos" para a chefia interferir.

**5. Como o cartão Kamishibai fica "Verde" de novo?**
A cada revisão beira-leito, o profissional deve clicar no seu domínio e marcar "OK". Isso renova o relógio de `reviewedAt`. Os cartões expiram e voltam ao cinza na virada de cada turno (AM/PM).

**6. Posso alterar o horário do Huddle?**
Os horários padrão (ex: 07:00 e 19:00) são definidos no Firestore (`settings/ops`). Apenas a administração (TI/Liderança) pode alterá-los.

**7. O Kanban é atualizado sozinho?**
O _Modelo Passivo_ do BedSight (atual) reflete a cor primária baseada no BedStatus (Vago, Ocupado, Limpeza). A movimentação de etapas clínicas (Kanban) requer mudança ativa do status pelo usuário.

**8. O que é o "Main Blocker" (Bloqueador Principal)?**
É a principal restrição médica ou operacional que impede a progressão de alta (ex: "Aguardando Vaga UTI", "Aguardando Laudo RX"). Todo leito estagnado precisa ter um.

**9. Para que serve o campo `dueAt` na Pendência?**
Para definir o SLA. Se não for preenchido, a pendência é uma "tarefa sem dono/sem prazo" e não gera alerta vermelho de "Overdue". Recomendamos sempre usar.

**10. O que significa "Freshness" no Mission Control?**
Freshness (Frescor) é a métrica temporal da última vez que _alguém_ atestou que viu o paciente no Kamishibai (`reviewedAt`). Pacientes largados por 24h ou 48h caem nos baldes vermelhos de Alerta.

**11. E se um domínio não for da minha especialidade?**
Você só deve revisar (OK/Impedimento) a etapa do _seu_ domínio (Médico revisa Médico, Fisioterapia revisa Fisioterapia). Avaliações cruzadas não são o padrão ouro da auditoria Kamishibai.

**12. Por que a TV tem um "Renderer v1"?**
A TV foi projetada para rotacionar páginas sem interação. O renderer garante que as cores do Kamishibai e alertas de Huddle apareçam corretamente, mesmo a 10 metros de distância, sem precisar tocar na tela.

**13. O que faço se o paciente tem 5 pendências?**
Registre todas. O Mission Control contabiliza "Leitos com pendências" e "Total de pendências". Se 2 dessas 5 vencerem, o escalonamento acenderá.

**14. Como saber se o turno virou?**
O BedSight utiliza o `shiftKey` (ex: `2026-02-28-AM`). O sistema compara a hora local atual com a tabela de huddle. Se virar para PM, tudo que é atrelado ao AM "estalece" (expira).

**15. Qual a diferença entre "Impedimento no Kamishibai" e "Pendência"?**
O Impedimento (vermelho) marca que aquela especialidade encontrou um problema clínico/operacional. A Pendência é a _Ação_ descritiva (o "O Quê" e "Até Quando") derivada desse impedimento.

---

## Parte 2: Os 10 Anti-Padrões (O que "Mata" o Lean no Hospital)

**1. Apagar Rastros (Delete vs Cancel)**
_O que é:_ Excluir pendências em vez de cancelar.
_Impacto:_ Fura a auditoria. Não sabemos por que a ação foi abortada ou se o processo de prescrição é falho.

**2. Tarefas Fantasmas (Pendências sem Prazo)**
_O que é:_ Criar 10 pendências críticas, mas nenhuma com `dueAt`.
_Impacto:_ O relógio de "Overdue" nunca dispara. O escalonamento não avisa o supervisor. A espera afoga a unidade silenciosamente.

**3. O Huddle Fake (Click sem Reunião)**
_O que é:_ O membro clica no `Registrar Huddle` só para sumir o aviso da TV, sem alinhar o time.
_Impacto:_ Desalinhamento total. A operação parece saudável no sistema, mas o caos real permanece no plantão.

**4. Kamishibai "Tudo Verde" (Review Falso)**
_O que é:_ Na virada do plantão, marcar "OK" em todos os domínios só para zerar a lista de `Unreviewed Beds`.
_Impacto:_ Maqueia o indicador de "Freshness". Esconde os pacientes crônicos ou aqueles que precisavam de revisão imperativa.

**5. Ignorar a Fumaça (Escalonamento Ignorado)**
_O que é:_ O card de "🔥 Escalonamentos" brilha vermelho intenso, e o supervisor acha "normal".
_Impacto:_ Perda de confiança da base. Se a equipe escala via pendência vencida e nada é feito cima, eles param de alimentar o sistema.

**6. Bloqueador Crônico Mascarado (Atualização Pífia)**
_O que é:_ Ficar mudando pequenas vírgulas no leito para atualizar o relógio geral (`updatedAt`), fingindo frescor, quando o gargalo primário (`mainBlocker`) é o mesmo há 3 dias.
_Impacto:_ Por isso a V1 migrou o aging para `mainBlockerBlockedAt`. Mudar perfumaria não zera o relógio do bloqueio.

**7. Alta Surpresa (Falta de Visibilidade)**
_O que é:_ Não alterar o BedStatus no quadro para indicar previsão de alta.
_Impacto:_ O setor de limpeza e a recepção não são engatilhados com antecedência (Puxão Kanban falha), o time reage apenas após a cama vagar.

**8. Síndrome do Silo (Eu só olho a minha tela)**
_O que é:_ Enfermagem não conferir os bloqueios da Fisioterapia.
_Impacto:_ Quebra do Princípio Gestão Visual. A TV e os detalhes existem para sabermos as restrições uns dos outros e atuarmos em conjunto.

**9. Pedidos de Boca (Não Formalizar a Pendência)**
_O que é:_ Exigir insumos ou avaliações apenas pelo corredor.
_Impacto:_ A TV e o Dashboard do supervisor não ouvem conversas. O que não está no BedSight, não é gerenciado.

**10. O Kamishibai do Turno Anterior**
_O que é:_ Deixar o cartão verde do turno AM "valer" para o PM.
_Impacto:_ Falso senso de segurança. O protocolo Lean exige re-ateste sistemático (`shiftKey` expira os cartões).
