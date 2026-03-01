# EDU-1: Micro-Lições Lean (Onboarding BedSight)

Este material é projetado para integração de novos colaboradores ou pílulas semanais (5 minutos cada) via canal de comunicação (ex: WhatsApp/Teams).

**Formato:** `[SITUAÇÃO] -> [ERRO] -> [REGRA LEAN] -> [AÇÃO BEDSIGHT]`

---

## Lição 1: O Falso Início (Registrando o Huddle)

- **SITUAÇÃO:** O turno das 07h00 acabou de começar. A equipe se espalha. No corredor, a TV pisca `⚠ HUDDLE PENDENTE`.
- **ERRO:** Achar que "cada um sabe o que tem que fazer".
- **REGRA LEAN:** Comece todo plantão com um alinhamento (Huddle). Identifique altas, gargalos e metas do dia em 10 minutos.
- **AÇÃO BEDSIGHT:** Após conversar rapidamente, o líder vai em Admin > `Registrar Huddle AM`. O badge desaparece da TV imediatamente, informando a todos que o rumo do plantão está dado.

**Verificação:** O badge “HUDDLE PENDENTE” significa: (A) bug (B) rotina não registrada (C) paciente em alta

## Lição 2: Revisão Silenciosa (Kamishibai & Freshness)

- **SITUAÇÃO:** O plantonista médico viu o leito 301, prescreveu, mas não falou com a enfermagem, nem anotou nada rápido.
- **ERRO:** A equipe acha que o paciente não foi revisto. No Mission Control, o leito entra em alerta de "Freshness" (idade da verificação) ou "Não Revisado No Turno".
- **REGRA LEAN:** Comunicação da revisão é vital para a rede de apoio.
- **AÇÃO BEDSIGHT:** Após avaliar, abra o BedSight Editor. Clique em 'Médico' no Kamishibai e marque 'OK' ou 'Impedimento'. Isso atualiza o `reviewedAt` automaticamente do paciente, mantendo o indicador vivo.

**Verificação:** Marcar “OK” no Kamishibai atualiza: (A) reviewedAt (B) createdAt (C) deletedAt

## Lição 3: A Tarefa Perdida (Criando Pendências)

- **SITUAÇÃO:** O paciente precisa de um Raio-X urgente. O médico pede de boca, e o recepcionista anota num post-it.
- **ERRO:** Post-its caem. Pedidos de boca não têm prazo formalizado.
- **REGRA LEAN:** Todo gargalo (bloqueador) precisa virar um plano de ação rastreável, com dono e prazo de vencimento.
- **AÇÃO BEDSIGHT:** No Editor do paciente (Bed Details), abra a área de Pendências e adicione "Agendar RX Torax". Se puser um prazo (`dueAt`), o sistema vai ajudar cobrando depois.

**Verificação:** Pendência acionável precisa de: (A) texto (B) dono e prazo (C) print

## Lição 4: "Está Atrasado!" (Tick-tock das Pendências)

- **SITUAÇÃO:** A pendência do Raio-x do Leito 302 passou do prazo estipulado das 12:00.
- **ERRO:** Ninguém perceber ou cobrar ativamente, atrasando as próximas etapas.
- **REGRA LEAN:** O tempo de espera não agrega valor. Destacamos visualmente o que foge do SLA acordado.
- **AÇÃO BEDSIGHT:** Automático. A pendência com tempo passado de `dueAt` exibirá a tag vermelha `⚠ Vencida` no Editor. Ela subirá nos radares analíticos do supervisor.

**Verificação:** “⚠ Vencida” aparece quando: (A) dueAt passou (B) reviewedAt passou (C) shift virou

## Lição 5: Realidade vs Ocultação (Canceled vs Deleted)

- **SITUAÇÃO:** Uma pendência "Avaliar Sonda" foi criada, mas a prescrição mudou e não precisa mais.
- **ERRO:** O profissional acha um "jeitinho" ou apenas apaga a tarefa.
- **REGRA LEAN:** Transparência de processo. Se erramos o plano ou o plano mudou, devemos preservar que existia uma demanda.
- **AÇÃO BEDSIGHT:** Nunca mande apagar (exclusão fura a auditoria, apenas Admin consegue excluir fisicamente). Use o botão **Cancelar (✕)**. Ela ficará recolhida em "Canceladas", com sua nota do motivo, provando por que não foi feita.

**Verificação:** Cancelar é melhor que deletar porque: (A) limpa tela (B) preserva auditoria (C) é mais rápido

## Lição 6: Fogo no Teto! (O Escalonamento V1)

- **SITUAÇÃO:** A pendência do Raio-X agora tem 14h de atraso. Niguém fez nada.
- **ERRO:** A liderança achar que as unidades correm soltas e só investigar amanhã de manhã porque não foi avisada.
- **REGRA LEAN:** Se o processo padrão falha (o prazo expirou), a linha de produção (escalonamento) para e aciona a Liderança (Puxão Andon).
- **AÇÃO BEDSIGHT:** No painel Mission Control do Admin, o card **🔥 Escalonamentos** entrará em alerta crítico refletindo `overdueCriticalBedIds`. Clicando nele, o supervisor vê onde o fogo está na unidade.

**Verificação:** Escalonamento serve para: (A) punir (B) acionar cadeia de ajuda (C) gerar ranking

## Lição 7: Desde quando ele está esperando? (Aging de Bloqueio)

- **SITUAÇÃO:** Paciente está no leito 201 aguardando "Estabilização hemodinâmica".
- **ERRO:** Saber o motivo, mas não saber HÁ QUANTO TEMPO ele é o motivo. O tempo total do leito mascara o tempo do gargalo exato atual.
- **REGRA LEAN:** Meça quão crônico é um impedimento ativo.
- **AÇÃO BEDSIGHT:** O Mission Control KPI1 mede o `mainBlockerBlockedAt`. Se esse bloqueador durar mais de 24h consecutivas (threshold), ele aciona os Escalonamentos também para a chefia interferir.

**Verificação:** Aging do bloqueio mede: (A) tempo internado (B) tempo do bloqueador atual (C) tempo do turno

## Lição 8: O Abandono de 48 Horas (Staleness / Freshness)

- **SITUAÇÃO:** Paciente crônico está bem. O time decide "não o olharemos hoje".
- **ERRO:** Esquecer que leitos não auditados podem estar bloqueando um leito precioso ou tendo declínio silencioso.
- **REGRA LEAN:** Todo paciente, no mínimo todo dia, deve passar por giro do Kamishibai.
- **AÇÃO BEDSIGHT:** Mission Control acusa via dashboard de Freshness se aquele leito não tiver novos registros de `reviewedAt` caíndo nas caçambas de 24h ou 48h (Stale Beds).

**Verificação:** Freshness ruim indica: (A) piora clínica (B) revisão não registrada (C) falta de leito

## Lição 9: O Huddle Esquecido

- **SITUAÇÃO:** A equipe fez a reunião matinal, mas ninguém anotou e todos já foram atender.
- **ERRO:** Quem chegou atrasado entra num ecossistema "cego" de prioridades e os analíticos quebram indicando "Falta Huddle".
- **REGRA LEAN:** Se não está documentado/formalizado, a gestão inteira cai. O BedSight é a "Gestão Visual à Vista".
- **AÇÃO BEDSIGHT:** Voltem no iPad central e toquem no botão "Registrar Huddle". São 2 cliques em `Admin > Ops`! Isso marca que a rotina girou naquele turno.

**Verificação:** Huddle feito, mas não registrado → sistema fica: (A) ok (B) cego (C) mais rápido

## Lição 10: O Supervisor Proativo (Drilldown)

- **SITUAÇÃO:** O Coordenador olha os analíticos e vê que há 5 Pendências Abertas.
- **ERRO:** Mandar mensagem geral no grupo perguntando "de quem são essas pendências?".
- **REGRA LEAN:** Use dados para ir direto na causa raiz do desperdício (Gemba real, sem fofoca).
- **AÇÃO BEDSIGHT:** Clique exatamente no card "Pendências Abertas" no Mission Control. O sistema filtrará e abrirá uma Lista de Ação apontando exatamente em quais leitos estao as 5 tarefas, economizando 30 minutos na varredura.

**Verificação:** Drill-down existe para: (A) evitar gemba (B) ir direto no leito certo (C) criar reunião
