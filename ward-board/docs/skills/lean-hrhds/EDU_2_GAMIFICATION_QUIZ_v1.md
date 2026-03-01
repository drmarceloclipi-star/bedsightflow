# EDU-2: Estrutura de Gamificação (Lean Quiz)

**Objetivo:** Transformar as questões de nível operacional (construídas na fase EDU-0) em um formato dinâmico de gamificação para encerramentos de treinamento de 15 minutos. Isso fixa o conhecimento através da competição saudável (estilo _Kahoot!_ ou _Mentimeter_).

---

## Regras do Jogo (O Setup)

1. **Ferramenta Sugerida:** Kahoot! (Conta Free) ou Forms interativo.
2. **Tempo por Questão:** 20 a 30 segundos (evita consultas lentas, força instinto).
3. **Público:** Aberto para todos que assistiram aos ensinamentos (médicos, residentes, enfermagem). Dividir em times (Ex: Time Setor A vs Time Setor B).
4. **Premiação Simbólica:** Ingressos de refeitório, botton no crachá "Lean Ninja", pausas bonificadas, etc.

---

## O Roteiro do Jogo (Módulo Sobrevivência no HRHDS)

O apresentador (Agile Coach) lança a tela no projetor. As perguntas pulsam com música de tensão (se kahoot) e opções de cores.

### Round 1: Aquecimento Visual (O Quadro)

**[🔥 Pergunta 1]** Você entra na Unidade às 07:15. A TV gigante no posto de enfermagem está piscando uma enorme faixa amarela `HUDDLE PENDENTE`. O que houve?

- [A] O sistema quebrou e perdeu o WiFi.
- [B] A rotina de limpeza do corredor atrasou 15 min.
- **[C] Ninguém avisou formalmente o BedSight que a reunião matinal rápida foi feita. (CERTA)**
- [D] O médico principal ainda não bateu o ponto na catraca.

**[Comentário Pós-Reposta]:** Exatamente. Lean precisa de cadência. Se o Huddle for feito, mas não registrado em Admin > Ops, a TV mostrará para toda a unidade que estamos "operando no escuro".

**[🔥 Pergunta 2]** O status primário de um leito na TV dita sua etapa no fluxo de valor (Kanban). Se a cama estiver **VERDE**, significa:

- [A] Paciente está estável.
- **[B] O processo de ALTA se iniciou (fluxo de saída ativado). (CERTA)**
- [C] Cama limpa.
- [D] Paciente liberado para ir à cirurgia.

### Round 2: A Fronteira do Paciente (Kamishibai & Pendências)

**[🔥 Pergunta 3]** Você avaliou o leito 301, conversou com a família e ajustou a dieta. No entanto, não havia o suplemento na farmácia local. Qual a ação corretiva sob a ótica Lean no sistema?

- [A] Marcar o card de Kamishibai como "OK" porque sua parte médica foi feita e falar no corredor com alguém.
- [B] Marcar como "OK" mas avisar no WhatsApp da farmácia.
- **[C] Marcar "Impedimento" no seu domínio e criar e formalizar uma Pendência com prazo. (CERTA)**
- [D] Deletar o registro de internação do paciente para que as horas parem de contar até chegar o suplemento.

**[Comentário Pós-Reposta]:** Perfeito. "Impedimento" sinaliza o problema. A Pendência gera a _ação_ consertiva, criando um prazo explícito que o sistema vai rastrear.

**[🔥 Pergunta 4]** A sua pendência criada acima possuía um prazo (`dueAt`). Esse prazo passou. Qual a consequência principal (Andon) gerada na plataforma?

- **[A] Marca visual vermelha ⚠ Vencida e contagem subindo nos painéis dos supervisores. (CERTA)**
- [B] O plantonista leva bronca do diretor geral após 3 horas.
- [C] A pendência é sumariamente deletada pelo app após bater 24 horas.
- [D] O leito em si muda da cor Azul para Roxo (Limpeza) indicando erro crítico.

### Round 3: Nível Avançado (Chefia & Escalonamento)

**[🔥 Pergunta 5]** Como a chefia (Supervisão/Direção) usa os artefatos se eles não estão na beira do leito prescrevendo?

- [A] Eles recebem um PDF engessado de 40 páginas toda sexta-feira.
- [B] Eles devem perguntar no rádio para cada enfermeiro "O que está faltando?"
- **[C] Eles abrem o painel Mission Control, checam a linha de "Escalonamento" crônico e agem para derrubar os piores gargalos que o sistema lhes avisa. (CERTA)**
- [D] A chefia cancela manualmente todos os Huddles.

### Round 4: A Pegadinha Comportamental (Anti-Padrão)

**[🔥 Pergunta 6] (Verdadeiro ou Falso)**
_Se uma tarefa não faz mais sentido (ex: O Raio-X que era prioridade foi cancelado pois o paciente vai de alta amanhã diretão), eu devo apertar EXCLUIR para sumir com a pendência e deixar a tela mais visualmente limpa pra todo mundo._

- **[A] Falso. (CERTA)**
- [B] Verdadeiro.

**[Comentário Pós-Reposta]:** Falso! Não esconda o que planejou. No BedSight os usuários normais nem _podem_ excluir, apenas Cancelar (✕). Cancelar preserva a inteligência (histórico do "porquê" a equipe desistiu), exclusão mascara a auditoria Lean.
