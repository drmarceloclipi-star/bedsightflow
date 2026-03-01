# Avaliação de Conhecimento: Operação Lean no HRHDS

Preencha as questões a seguir para verificar seu alinhamento com os novos padrões de fluxo e uso do BedSight.

---

## Questões (V ou F)

1. ( ) O paciente que não está alocado ainda no sistema (leito vazio) continuará apresentando "pontinhos de N/A" na TV até preenchermos sua ausência.
2. ( ) Um bloqueio de equipe (indicador vermelho no Kamishibai) indica falta de competência daquele profissional responsável.
3. ( ) A virada do turno (AM para PM) reseta todo o quadro, substituindo os indicadores vermelhos ou verdes automaticamente para o estado em branco.
4. ( ) A cor do banner de previsão de alta do paciente (Kanban verde, amarelo, vermelho) não guarda relação alguma com o status de bloqueio ou liberação das equipes (Kamishibai).
5. ( ) É responsabilidade exclusiva do Coordenador da Unidade clicar em "Registrar Huddle" no sistema BedSight ao meio-dia e meia-noite.
6. ( ) Se um domínio (ex: Serviço Social) não atende um determinado leito ativo, o sistema BedSight exibirá o status N/A neste domínio, deixando-o propositalmente sem cor de alerta (diferente de "branco não revisado").
7. ( ) Se um exame tomográfico atrasa, a conduta correta no Lean é ligar constantemente para a radiologia para liberar o laudo, sem necessidade de sinalizar erro sistêmico na TV.
8. ( ) Um dos focos imediatos no Huddle é analisar todos os pacientes com previsão de alta para o dia (Kanban verde: <24h) e remover barreiras que os seguram.

## Múltipla Escolha

1. A ferramenta ou sistema cujo principal propósito é diferenciar de forma contínua o horizonte esperado para a liberação e saída de cada paciente é chamada de:
   a) A3
   b) Huddle
   c) Kamishibai
   d) Kanban de Altas

2. No contexto dos painéis BedSight, o status "verde" (OK) em um domínio de equipe para um paciente internado significa estritamente que:
   a) O paciente teve a alta garantida pelo médico
   b) A especialidade marcou a ronda e não registrou nenhum impedimento ativo que exija ação naquele turno exato.
   c) Toda a rotina daquele profissional para aquele doente se encerrou no dia e no mês.
   d) Nenhuma etapa futura de medicação atrasará.

3. O paciente João tem previsão de alta "Indefinida". O Kamishibai da fisioterapia está "Bloqueado" (Vermelho) porque aguarda ajuste do O2. O que ocorrerá na próxima "virada de turno" oficial?
   a) O paciente perderá o status e ficará Invisível (Vazio).
   b) O status vermelho se apaga, devendo a fisio avisar verbalmente ao próximo plantão.
   c) A previsão "Indefinida" muda para >3 dias.
   d) O status da Fisio continuará Vermelho (pois bloqueios sobrevivem a turnos, envelhecendo), sendo responsabilidade do próximo plantão resolvê-lo.

4. Quando o sistema aponta que um leito de enfermaria ficou em branco, ou seja, no status "sem cor/não revisado", a ação esperada é:
   a) Considerá-lo abandonado.
   b) Compreender que o plantão virou ou a admissão ocorreu recém, exigindo uma nova checagem e afirmação pela equipe logada do momento.
   c) Interpretar que o paciente evoluiu a óbito.
   d) Confirmar se não estaria apenas sem um paciente no leito (vazio).

5. Qual das abordagens a seguir representa uma aplicação correta do método A3 pelo hospital?
   a) Distribuir o A3 como receituário aos pacientes na saída do Pronto Socorro.
   b) Pegar os três maiores tempos de Bloqueio Nutricional do mês extraídos do BedSight e estudá-los numa folha em conjunto identificando contramedidas definitivas e causas-raiz.
   c) Anotar no A3 que o hospital vizinho transfere pacientes mal diagnosticados.
   d) Punir a escala do enfermeiro devido aos gráficos do painel de Aging.

6. Das cinco reuniões abaixo, qual caracteriza corretamente o "Huddle" da emergência/enfermaria Lean?
   a) Encontro quinzenal da diretoria comercial no anfiteatro avaliando contratos e AIH.
   b) Encontro diário de 1 a 2 horas (round extenso) para debater literatura e estudos de caso de cada paciente da UTI um a um.
   c) Rápida reunião visual de 15 minutos em pé, no Gemba, verificando Kanban (<24h), bloqueios (Vermelhos) e fechando acordos operacionais para as próximas 12 horas.
   d) Sessão individual sem pauta de feedback do líder para cada médico da equipe ao final do expediente.

7. O registro de Huddle (lastHuddleAt) no BedSight é acionado por quem e onde?
   a) Automaticamente via sensores biométricos de relógio de ponto da recepção.
   b) Automaticamente pelo relógio do servidor, assim que 07h00 da manhã inicia a rotação.
   c) Ativamente no Painel/Editor por um usuário com role de admin ou de edição após consumarem a reunião frente a TV.
   d) Exclusivamente no ERP da rede pública (ex: Tasy, MV) na guia de faturamento do SUS.

---

## Gabarito e Justificativas

1. F. Leito vazio desaparece; o "Sem Cor/Não revisado" difere fortemente do status Inativo.
2. F. O Kamishibai aponta falhas de processos e ferramentas do sistema ou do fluxo para ajudar os funcionários que precisam de recurso para prosseguir com segurança.
3. F. O status vermelho NUNCA reseta na virada; eles envelhecem. Somente o verde "acaba".
4. V. Kanban e Kamishibai monitoram coisas eixos diferentes (Kanban = horizonte temporal de altas; Kamishibai = barreiras, status das especialidades atuantes no agora).
5. F. O huddle é de todos, registrados preferencialmente por quem o mediou; todos com papel "editor" têm este poder na UI.
6. V. Esta é a regra N/A para não gerar um alarme de "sem cor" indesejado em especialidades que não foram alocadas clinicamente.
7. F. Pelo princípio de Tornar o Anormal Óbvio, o atraso precisa estar registrado e estampado com bloqueio vermelho no BedSight para a alta gestão notá-lo.
8. V. Altas < 24h são a grande chance de escoamento e puxada de fila da porta e o grande esforço diário interprofissional destas manhãs e tardes.
9. d) Kanban de Altas. Just: o foco no prazo temporal para as libertações programadas de leitos.
10. b) Foi revisado neste turno validando a ausência de impedimento ativo pendente.
11. d) Continuará Vermelho. Just: O contrato manda que os alertas vermelhos acompanhem os turnos em aging visível.
12. b) Compreender que o plantão virou... Just: "Sem cor" obriga todo plantão novo a atestar a normalidade (apertando o verde) por garantia.
13. b) Pegar os três maiores tempos... Just: O A3 aborda a padronização e causa-raiz usando dados verídicos e quantitativos como fonte da dor.
14. c) Reunião de 15 min em pé no Gemba... Just: É dinâmico e cirúrgico, foca apenas nos desvios, metas iminentes e ajustes operacionais coletivos para não tirar o foco da assistência médica intensiva do dia a dia.
15. c) Ativamente no Painel... Just: Ritual intencional, deve ser apertado por um preceptor/líder provando o ato humano que valida os dados assistenciais do plantão atualizador.
