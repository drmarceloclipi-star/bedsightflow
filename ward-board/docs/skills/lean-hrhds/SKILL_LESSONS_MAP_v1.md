# Mapa de Lições: Lean HRHDS x BedSight

Este mapa conecta os conceitos Lean operacionais às funcionalidades do sistema BedSight, orientando o aprendizado prático da equipe na unidade.

## Lição 1: O Conceito de Valor e os 8 Desperdícios

Na saúde, **valor** é tudo o que transforma clinicamente o paciente ou apressa sua cura. Esperas por laudos, movimentações desnecessárias de macas e excesso de burocracia são desperdícios que prolongam a internação. A equipe deve focar em enxergar o que não agrega valor e atrasa o fluxo de saída.

- **O que o BedSight implementa:** O quadro Kamishibai dá visibilidade imediata a esperas (bloqueios vermelhos) e seu tempo de atraso (aging).
- **O que falta implementar na unidade:** A análise e eliminação física de desperdícios de layout, excesso de estoques (5S) e rotas de transporte (diagrama de espaguete).

## Lição 2: Gestão Visual e o Poder do Gemba

Gestão à vista significa criar um ambiente onde problemas fiquem evidentes em 3 segundos. O "Gemba" é o local onde o trabalho acontece (a beira do leito ou posto de enfermagem). Levar as informações cruciais para o Gemba, em telas visíveis, acelera a tomada de decisão em equipe.

- **O que o BedSight implementa:** Painéis de TV de grande formato com a situação atualizada em cores (Kanban previsional e status Kamishibai).
- **O que falta implementar na unidade:** Criação de painéis físicos complementares para gestão de materiais ou quadro com indicadores estratégicos impressos para a alta gestão.

## Lição 3: Rituais de Cadência — O Huddle

Reuniões ágeis (10-15 min) diárias em pé diante do quadro, com a equipe multiprofissional. O foco é tático e imediato: quais são as altas de hoje (<24h)? Quais leitos estão bloqueados (vermelho)? Qual o plano de ação rápido para desbloquear o fluxo do paciente?

- **O que o BedSight implementa:** O registro formal e inalterável (`lastHuddleAt`) atestando que os rituais AM/PM ocorreram, atrelando a validade do painel à reunião.
- **O que falta implementar na unidade:** A disciplina de horário, o foco e a condução comportamental da liderança durante a execução presencial do ritual.

## Lição 4: Kanban de Altas — Planejando o Horizonte de Saída

O Kanban organiza a transição de cuidado do paciente. Diferenciar visualmente pacientes com alta "para hoje" dos que ficarão "mais de 3 dias" permite focar energia onde a liberação do leito é iminente, articulando retornos e burocracias de alta com antecedência.

- **O que o BedSight implementa:** A categorização visual obrigatória em cores (verde: <24h, amarelo: 2-3 dias, vermelho: >3 dias) vinculada ao horizonte.
- **O que falta implementar na unidade:** A articulação assistencial fina com o NIR (Núcleo lnterno de Regulação) e a padronização médica das desospitalizações diárias.

## Lição 5: Kamishibai — Checagem Rítmica por Especialidade

O Kamishibai "audita" a situação de cada domínio (Médico, Enfermagem, Fisio, Serviço Social, Psicologia, Nutrição) em cada turno. O objetivo nunca é punição, mas apontar gargalos sistêmicos de fluxo antes que estendam a permanência do paciente no leito da emergência.

- **O que o BedSight implementa:** Os 6 domínios fixos com status binário explícito (OK verde / Bloqueado vermelho).
- **O que falta implementar na unidade:** O cruzamento das informações do quadro com checagens no formato "ronda" ou "auditoria beira-leito" pelos líderes da unidade.

## Lição 6: Tornar o Anormal Óbvio e a Vida dos Bloqueios

Quando uma etapa não avança, a falha deve gritar ao olhar de todos, e seu envelhecimento deve ser crônico. Bloqueios vermelhos no quadro que não se resolvem e atravessam turnos indicam falhas não resolvidas no processo hospitalar, exigindo intervenção rápida.

- **O que o BedSight implementa:** A persistência incondicional do status vermelho na virada de turno e o rastreamento real do envelhecimento (aging) do bloqueio.
- **O que falta implementar na unidade:** Regras institucionais de escalonamento hierárquico automatizado ou chamados de WhatsApp/SMS direto para as lideranças quando o aging estourar.

## Lição 7: O Tempo de Vida da Informação (TTL do Turno)

A cadência no hospital vive em turnos. Ao girar o relógio para AM ou PM, o status OK (verde) expira; afinal, um aval dado ontem de manhã não significa que está tudo bem hoje. O quadro não-revisado perde as cores para exigir reavaliação humana.

- **O que o BedSight implementa:** A expiração inteligente (TTL baseado no `shiftKey`) que força os pontos verdes (OK) a voltarem ao estado "Sem cor/Neutro" a cada transição de AM ou PM.
- **O que falta implementar na unidade:** A responsabilização de cada disciplina para nunca entregar ou encerrar um turno deixando seus leitos ativos sem a devida cor de revisão na tela.

## Lição 8: Kaizen e Resolução de Problemas (Método A3)

Problemas que o quadro pinta constantemente de vermelho (ex: rotina de laboratório muito lenta) não devem ser discutidos só com reclamações. Times usam ferramentas (como o relatório A3 ou os 5 Porquês) para achar a causa-raiz e mudar a raiz da ineficiência de forma definitiva.

- **O que o BedSight implementa:** A volumetria exata e o arquivamento dos bloqueios por tipo e duração, gerando a base de dados para o diagnóstico das falhas operacionais.
- **O que falta implementar na unidade:** O preenchimento humano do método A3 e o treinamento nas sessões de brainstorming, consolidando reuniões pós-bloqueios para fomento de melhoria contínua.
