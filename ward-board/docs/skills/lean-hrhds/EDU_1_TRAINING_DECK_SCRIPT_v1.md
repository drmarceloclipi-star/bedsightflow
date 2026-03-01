# EDU-1: Script do Treinamento Lean HRHDS (BedSight)

**Duração Estimada:** 30–45 minutos
**Público-Alvo:** Liderança, Equipe Multiprofissional e Operadores do BedSight.
**Objetivo:** Capacitar a equipe nos princípios do Lean adaptados às emergências do HRHDS e mostrar como o BedSight digitaliza e facilita esses ritos no turno.

---

## Bloco 1: Introdução (5 min) - "Por que Lean agora?"

**Objetivo:** Alinhar o problema e o propósito.

- **Mensagem Central:** Nossas emergências são dinâmicas. O paciente não pode esperar enquanto informações se perdem em cadernos ou trocas de plantão informais. O Lean visa eliminar "desperdícios de tempo" (ex: procurar o médico para saber a pendência).
- **Exemplo Real:** "Paciente internado há 4 dias porque estamos aguardando a liberação de um leito que, na verdade, já estava vago na enfermaria, mas não tínhamos visão do todo."
- **O Papel do BedSight:** O BedSight não é apenas um painel; é o motor do Lean. Ele traduz a filosofia em cores, avisos e listas de tarefas focadas no que realmente importa agora.

## Bloco 2: Gestão à Vista e Cadência — Kanban & Huddle (10 min)

**Objetivo:** Explicar a organização visual e as reuniões curtas.

- **Mensagem Central:** O quadro na parede agora é digital. O Kanban mostra quem precisa sair e quem está travado. O Huddle é onde sincronizamos o time baseado no que o quadro diz.
- **Como funciona:**
  - O Kanban é focado no paciente (Fluxo de Valor).
  - O Huddle AM/PM é rápido (10 min), focado em gargalos (ex: "Quantas altas teremos hoje?").
- **BedSight Action (Demo):**
  - Mostrar a TV da unidade.
  - Explicar o badge "HUDDLE PENDENTE".
  - Mostrar no painel de Administração (`/admin/ops`) como registrar o Huddle (AM ou PM), fazendo o aviso sumir instantaneamente da TV.

## Bloco 3: Segurança e Qualidade — Cartões Kamishibai (10 min)

**Objetivo:** Auditar processos na beira do leito.

- **Mensagem Central:** Kamishibai não é cobrança, é verificação de segurança. Precisamos saber se o paciente foi revisto em seu domínio (médico, Fisio, Enfermagem) neste plantão.
- **Como funciona:** "Cartões" visuais que devem ser virados. No BedSight, virar o cartão significa registrar o status "OK" ou "Impedimento".
- **BedSight Action (Demo):**
  - Mostrar o card do leito no Editor.
  - Clicar em uma especialidade (ex: Terapia Ocupacional) e registrar "OK". Isso renova o `reviewedAt` e melhora a "Freshness" (Tempo de Atualização) do leito.
  - Mostrar no Mission Control (`/admin/analytics`) o card "Não revisados neste turno".

## Bloco 4: Fluxo Contínuo — Pendências e Escalonamentos (10 min)

**Objetivo:** Agir em cima do que impede a alta.

- **Mensagem Central:** Identificamos um impedimento no Kamishibai? Ele vira uma pendência. Se a pendência demorar mais do que o esperado, ela é escalonada.
- **Como funciona:**
  - Registre tarefas com responsabilidade e prazo.
  - O sistema automaticamente alerta se passou do prazo (ex: > 12h = crítico).
- **BedSight Action (Demo):**
  - Mostrar o registro de uma Pendência no Bed Details. Colocar um `dueAt` no passado e mostrar como ela fica `⚠ Vencida` (vermelho).
  - Explicar a diferença: "Cancelar" (arquiva e mantém histórico) vs "Concluir" (foi feito).
  - Mostrar o quadro "🔥 Escalonamentos" no Mission Control, destacando que pendências vencidas há muito tempo ou bloqueios críticos (>24h) caem para o supervisor agir.

## Bloco 5: Visão Executiva — Mission Control (5 min)

**Objetivo:** Mostrar o painel de comando para supervisores.

- **Mensagem Central:** Com o time alimentando os blocos 2, 3 e 4, o supervisor não precisa "caçar" problemas. O sistema empurra o que é crítico ladeira acima.
- **BedSight Action (Demo):**
  - Exibir o Mission Control.
  - Clicar nos Drill-downs (ex: "Ver X pendências em atraso crônico" no escalonamento ou "Leitos bloqueados há muito tempo").
  - Demonstrar as "Listas de Ação" geradas.

## Bloco 6: Perguntas e Encerramento (5 min)

**Objetivo:** Retirar dúvidas e chamar para a ação.

- **Call to Action (CTA):** "Seu objetivo hoje não é dominar o sistema inteiro. É apenas fazer a sua revisão do Kamishibai e registrar as pendências que estão bloqueando seus pacientes. O sistema cuidará das cores."
