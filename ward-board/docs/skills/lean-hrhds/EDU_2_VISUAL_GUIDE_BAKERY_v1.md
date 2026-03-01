# EDU-2: E-Book Visual (Blueprint Bakery)

**Missão:** Produzir o rascunho (script-blueprint) exato para que um Web Designer / Equipe de Marketing possa "assar" o E-book visual do Lean HRHDS.
**Por que:** Profissionais de saúde têm pouco tempo; imagens do sistema com tags explicativas são 10x mais eficientes que blocos de texto.

---

## Estrutura Visual do E-Book

O documento final deve ser em formato PDF (estilo carrosel/slides), paisagem (16:9), focado primeiramente em mobile (celular vertical) e secundariamente em desktop/TV.

### Slide 1: Capa

- **Título:** Lean nas Emergências - O Modo de Operar HRHDS
- **Subtítulo:** Como o BedSight transforma quadros brancos em inteligência operacional.
- **Imagem Principal:** Uma foto realista de uma TV na unidade mostrando o _TV Dashboard_ com cartões multi-coloridos, dividindo espaço com um profissional segurando um tablet.

### Slide 2: O Fim do "Onde está a informação?"

- **Texto:** No Lean, a Gestão Visual à Vista (_Gemba_ e _Kanban_) é regra básica.
- **Ação do Designer:** Fazer upload local do app em desktop (`/tv`).
- **Screenshot 1:** TV Dashboard inteiro.
- **Destacar (Caixa Vermelha):**
  - O relógio no canto superior direito.
  - O código de cores dos leitos (ex: Azul para Internado, Verde para Alta).
- **Legenda:** A TV é a fonte da verdade única. Sem mexer no mouse, você sabe o status de 30 pacientes.

### Slide 3: O Puxão Matinal (Huddle)

- **Texto:** Todo plantão começa com alinhamento (Cadência). O sistema te lembra se você esquecer.
- **Ação do Designer:** Acessar a `/tv` _sem_ um Huddle registrado hoje. Depois acessar `/admin` > Ops.
- **Screenshot 1:** A TV exibindo a grande tarja amarela `⚠ HUDDLE PENDENTE`.
- **Screenshot 2:** O painel `/admin` mostrando o botão verde "Registrar Huddle AM".
- **Legenda:** Uma reunião de 10 minutos diária previne 10 horas de trabalho duplo. Faça o Huddle e clique em Registrar.

### Slide 4: O "Giro" da Segurança (Kamishibai)

- **Texto:** Mais do que apenas ver o paciente, o sistema quer saber _quem_ viu e _quando_.
- **Ação do Designer:** Acessar o BedSight Editor em versão Mobile (inspecionar elemento -> iPhone).
- **Screenshot 1:** O `PatientCard` de um leito com os domínios (Médico, Enf, Fisio) no rodapé.
- **Destacar (Seta apontando):** Um domínio que está verde ("OK") e um que está cinza ("A Avaliar").
- **Legenda:** O Kamishibai beira-leito. Se você viu seu paciente e está tudo bem, clique e marque "OK". Isso avisa o hospital inteiro que a sua etapa clínica está fresca.

### Slide 5: Não Deixe Escondido (Pendências & Andon)

- **Texto:** Faltou algo para a alta? Não peça "de boca". Formalize.
- **Ação do Designer:** A tela "Pendências" em Bed Details (`/editor/301`).
- **Screenshot 1:** Lista de pendências. Uma específica deve ter um `dueAt` no passado.
- **Destacar:** A flag em vermelho chamativo `⚠ Vencida`.
- **Legenda:** Cada impedimento do paciente vira uma Pendência. Se ela passar do prazo, o sistema dispara bandeiras vermelhas para que o problema não seja esquecido (Andon).

### Slide 6: O Fogo Sobe (Escalonamento)

- **Texto:** Quando a linha de frente não consegue resolver (pendências muito atrasadas ou bloqueios de dias), a liderança é acionada.
- **Ação do Designer:** Tela de `/admin/analytics` -> Mission Control.
- **Screenshot 1:** O painel tático inteiro do supervisor.
- **Destacar (Círculo de Ênfase):** A linha de "🔥 Escalonamentos" brilhando com números (ex: "Ver 5").
- **Legenda:** O supervisor não caça problemas. Os problemas críticos são empurrados ladeira acima automaticamente pela ferramenta. O Lean atua protegendo o fluxo através de níveis de ajuda hierárquicos.

### Slide 7: Resumo Regra de Ouro

- **Texto e Ícones Centrais:**
  - 👁️ **Veja a TV:** A cor dita o estágio do fluxo (Kanban).
  - 🗣️ **Fale Rápidamente:** O Huddle alinha todo mundo.
  - ✅ **Clique no OK:** O Kamishibai garante a revisão diária de cada cérebro no paciente.
  - 🛑 **Alerte o Fogo:** Pendências registram gargalos; atrasos acionam o escalonamento.
