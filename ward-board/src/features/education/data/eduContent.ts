export interface Playbook {
    id: string;
    title: string;
    when: string;
    who: string;
    input: string;
    steps: string[];
    doneCriteria: string;
}

export interface Microlesson {
    id: string;
    title: string;
    situation: string;
    error: string;
    leanRule: string;
    action: string;
    verification: {
        question: string;
        options: string[];
        correctKey: string;
    };
}

export interface AppTutorial {
    id: string;
    title: string;
    description: string;
    icon: string;
    steps: string[];
}


export const PLAYBOOKS: Playbook[] = [
    {
        id: 'huddle',
        title: 'Playbook do Huddle (Reuniões Rápidas de Alinhamento)',
        when: 'No início de cada turno (AM e PM).',
        who: 'Liderança do setor + equipe núcleo presente (Enf, Médico, Fisio).',
        input: 'O painel da TV da Unidade está apitando um badge amarelo de "⚠ HUDDLE PENDENTE".',
        steps: [
            'Em frente ao painel ou TV, perguntar em rápida sucessão: Qual o total de pacientes? Quantas altas esperamos nas próximas 12 horas? Qual o maior fogo a ser apagado agora?',
            'O Líder abre o tablet ou desktop na tela `/admin` da unidade e vai até a aba `Ops`.',
            'Clica no botão respectivo `Registrar Huddle AM` (ou PM, base no horário local calculado por `huddleSchedule`).',
            'Verifica o balão verde do Toast "✓ Huddle Registrado".'
        ],
        doneCriteria: 'O Badge "HUDDLE PENDENTE" sumiu imediatamente da TV, indicando que este turno cumpriu a rotina inicial de Lean.'
    },
    {
        id: 'kamishibai',
        title: 'Playbook do Kamishibai (Giro a Beira-Leito)',
        when: 'Interações individuais com paciente ao longo do turno.',
        who: 'Quaisquer profissionais que fazem o giro assistencial.',
        input: 'O profissional acessa o seu setor ou leito designado de um paciente na aba de \'Editor\'.',
        steps: [
            'Realizar o atendimento clínico e checagem com paciente.',
            'Abrir o App e clicar na especialidade vinculada à sua área.',
            'Se a etapa assistencial principal foi realizada sem falhas, marque o cartão visual como "OK" (Verde).',
            'Se ocorreu algum problema (medicamento faltante, exames em atraso), selecione "Impedimento" (Vermelho).'
        ],
        doneCriteria: 'O tempo base (`reviewedAt`) dos domínios revisados atualizará para a hora da ação. O Mission Control mostrará redução do contador de "Não Revisados No Turno".'
    },
    {
        id: 'pendencias',
        title: 'Playbook de Gestão de Pendências (Impedimentos do Paciente)',
        when: 'Descobre-se um bloqueio para as ações programadas ao paciente, como exames em falta, que requerem esforço pontual.',
        who: 'O profissional que constatou o impedimento.',
        input: 'Um Kamishibai marcado como "Impedimento" que exija ação extra sistemática.',
        steps: [
            'No painel da Beira-Leito ("Bed Details"), acesse a área de "Pendências".',
            'Adicione uma Nova Pendência explícita (Ex: "Falta de Hemocultura").',
            'Opcional mas Recomendado: Marque o dono e aplique no relógio uma previsão/ultimato (Campo `dueAt`).',
            'Quando resolvido: Marcar a tarefa ativa como "Concluída".',
            'Se for irrelevante: Clicar no botão "Cancelar (✕)", anotando porquê ela perdeu utilidade.'
        ],
        doneCriteria: 'As pendências estão catalogadas, aparecem em Mission Control ("Pendências abertas") sem gerar gargalos ocultos.'
    },
    {
        id: 'escalonamento',
        title: 'Playbook de Escalonamento (Missão Salva a Casa)',
        when: 'O problema "transbordou" os pactos normais ou fugiu da capacidade local de contenção da enfermagem da ponta.',
        who: 'Supervisor de Enfermagem / Gestor Unidade e/ou Direção Médica.',
        input: 'No painel principal `/admin/analytics`, no dashboard Mission Control, aparece destacada a linha 🔥 Escalonamentos. Há números listados lá.',
        steps: [
            'Clicar fisicamente no número aceso a vermelho.',
            'Analisar a tela de Ação: Pode ser lista virtual de `escalations_overdue` ou `escalations_blocker`.',
            'O supervisor age em nível hospitalar para desfazer aquele gargalo (ligar no andar de baixo para a sala de exame, solicitar liberação da cirurgia).'
        ],
        doneCriteria: 'Card do Escalonamento volta ao cinza ou aponta ZERO no Mission Control por conta da pendência vencida cancelada/concluída, ou bloqueador trocado/livre.'
    },
    {
        id: 'alta',
        title: 'Playbook — Kanban de Alta',
        when: 'Durante o turno / revisão diária.',
        who: 'Equipe Assistencial e Médica.',
        input: 'Paciente internado no leito + necessidade de previsão de alta por faixa no turno.',
        steps: [
            'Definir faixa atual: <24h, 2–3d, >3d ou indef. (compromisso revisável, não chute).',
            'Se >3d ou indef. → preencher/atualizar Bloqueador Principal (mainBlocker).',
            'Se o bloqueador mudar de fato → atualizar o relógio do bloqueio (ex.: mainBlockerBlockedAt).',
            'Revisar no huddle: “o que precisa acontecer para cair a faixa?” (barreiras viram pendências com dono e prazo).'
        ],
        doneCriteria: 'todos os leitos têm faixa atualizada no turno; leitos >3d/indef. têm bloqueador principal explícito e revisado.'
    }
];

export const MICROLESSONS: Microlesson[] = [
    {
        id: 'm1',
        title: 'O Falso Início (Registrando o Huddle)',
        situation: 'O turno das 07h00 acabou de começar. A equipe se espalha. No corredor, a TV pisca ⚠ HUDDLE PENDENTE.',
        error: 'Achar que "cada um sabe o que tem que fazer".',
        leanRule: 'Comece todo plantão com um alinhamento (Huddle). Identifique altas, gargalos e metas do dia em 10 minutos.',
        action: 'Após conversar rapidamente, o líder vai em Admin > Registrar Huddle AM. O badge desaparece da TV imediatamente, informando a todos que o rumo do plantão está dado.',
        verification: { question: 'O badge “HUDDLE PENDENTE” significa:', options: ['(A) bug', '(B) rotina não registrada', '(C) paciente em alta'], correctKey: '(B)' }
    },
    {
        id: 'm2',
        title: 'Revisão Silenciosa (Kamishibai & Freshness)',
        situation: 'O plantonista médico viu o leito 301, prescreveu, mas não falou com a enfermagem, nem anotou nada rápido.',
        error: 'A equipe acha que o paciente não foi revisto. No Mission Control, o leito entra em alerta de "Freshness" ou "Não Revisado No Turno".',
        leanRule: 'Comunicação da revisão é vital para a rede de apoio.',
        action: 'Após avaliar, abra o BedSight Editor. Clique em \'Médico\' no Kamishibai e marque \'OK\' ou \'Impedimento\'. Isso atualiza o `reviewedAt` automaticamente do paciente.',
        verification: { question: 'Marcar “OK” no Kamishibai atualiza:', options: ['(A) reviewedAt', '(B) createdAt', '(C) deletedAt'], correctKey: '(A)' }
    },
    {
        id: 'm3',
        title: 'A Tarefa Perdida (Criando Pendências)',
        situation: 'O paciente precisa de um Raio-X urgente. O médico pede de boca, e o recepcionista anota num post-it.',
        error: 'Post-its caem. Pedidos de boca não têm prazo formalizado.',
        leanRule: 'Todo gargalo (bloqueador) precisa virar um plano de ação rastreável, com dono e prazo de vencimento.',
        action: 'No Editor do paciente (Bed Details), abra a área de Pendências e adicione "Agendar RX Torax". Se puser um prazo (`dueAt`), o sistema vai ajudar cobrando depois.',
        verification: { question: 'Pendência acionável precisa de:', options: ['(A) texto', '(B) dono e prazo', '(C) print'], correctKey: '(B)' }
    },
    {
        id: 'm4',
        title: '"Está Atrasado!" (Tick-tock das Pendências)',
        situation: 'A pendência do Raio-x do Leito 302 passou do prazo estipulado das 12:00.',
        error: 'Ninguém perceber ou cobrar ativamente, atrasando as próximas etapas.',
        leanRule: 'O tempo de espera não agrega valor. Destacamos visualmente o que foge do SLA acordado.',
        action: 'Automático. A pendência com tempo passado de `dueAt` exibirá a tag vermelha `⚠ Vencida` no Editor. Ela subirá nos radares analíticos do supervisor.',
        verification: { question: '“⚠ Vencida” aparece quando:', options: ['(A) dueAt passou', '(B) reviewedAt passou', '(C) shift virou'], correctKey: '(A)' }
    },
    {
        id: 'm5',
        title: 'Realidade vs Ocultação (Canceled vs Deleted)',
        situation: 'Uma pendência "Avaliar Sonda" foi criada, mas a prescrição mudou e não precisa mais.',
        error: 'O profissional acha um "jeitinho" ou apenas apaga a tarefa.',
        leanRule: 'Transparência de processo. Se erramos o plano ou o plano mudou, devemos preservar que existia uma demanda.',
        action: 'Nunca mande apagar. Use o botão **Cancelar (✕)**. Ela ficará recolhida em "Canceladas", com sua nota do motivo, provando por que não foi feita.',
        verification: { question: 'Cancelar é melhor que deletar porque:', options: ['(A) limpa tela', '(B) preserva auditoria', '(C) é mais rápido'], correctKey: '(B)' }
    },
    {
        id: 'm6',
        title: 'Fogo no Teto! (O Escalonamento V1)',
        situation: 'A pendência do Raio-X agora tem 14h de atraso. Niguém fez nada.',
        error: 'A liderança achar que as unidades correm soltas e só investigar amanhã de manhã porque não foi avisada.',
        leanRule: 'Se o processo padrão falha (o prazo expirou), a linha de produção (escalonamento) para e aciona a Liderança (Puxão Andon).',
        action: 'No painel Mission Control do Admin, o card **🔥 Escalonamentos** entrará em alerta crítico. Clicando nele, o supervisor vê onde o fogo está na unidade.',
        verification: { question: 'Escalonamento serve para:', options: ['(A) punir', '(B) acionar cadeia de ajuda', '(C) gerar ranking'], correctKey: '(B)' }
    },
    {
        id: 'm7',
        title: 'Desde quando ele está esperando? (Aging de Bloqueio)',
        situation: 'Paciente está no leito 201 aguardando "Estabilização hemodinâmica".',
        error: 'Saber o motivo, mas não saber HÁ QUANTO TEMPO ele é o motivo. O tempo total do leito mascara o tempo do gargalo exato atual.',
        leanRule: 'Meça quão crônico é um impedimento ativo.',
        action: 'O Mission Control KPI1 mede o `mainBlockerBlockedAt`. Se esse bloqueador durar mais de 24h consecutivas, ele aciona os Escalonamentos.',
        verification: { question: 'Aging do bloqueio mede:', options: ['(A) tempo internado', '(B) tempo do bloqueador atual', '(C) tempo do turno'], correctKey: '(B)' }
    },
    {
        id: 'm8',
        title: 'O Abandono de 48 Horas (Staleness / Freshness)',
        situation: 'Paciente crônico está bem. O time decide "não o olharemos hoje".',
        error: 'Esquecer que leitos não auditados podem estar bloqueando um leito precioso ou tendo declínio silencioso.',
        leanRule: 'Todo paciente, no mínimo todo dia, deve passar por giro do Kamishibai.',
        action: 'Mission Control acusa via dashboard se aquele leito não tiver novos registros caíndo nas caçambas de 24h ou 48h (Stale Beds).',
        verification: { question: 'Freshness ruim indica:', options: ['(A) piora clínica', '(B) revisão não registrada', '(C) falta de leito'], correctKey: '(B)' }
    },
    {
        id: 'm9',
        title: 'O Huddle Esquecido',
        situation: 'A equipe fez a reunião matinal, mas ninguém anotou e todos já foram atender.',
        error: 'Quem chegou atrasado entra num ecossistema "cego" de prioridades e os analíticos quebram indicando "Falta Huddle".',
        leanRule: 'Se não está documentado/formalizado, a gestão inteira cai. O BedSight é a "Gestão Visual à Vista".',
        action: 'Voltem no iPad central e toquem no botão "Registrar Huddle". São 2 cliques em `Admin > Ops`! Isso marca que a rotina girou.',
        verification: { question: 'Huddle feito, mas não registrado → sistema fica:', options: ['(A) ok', '(B) cego', '(C) mais rápido'], correctKey: '(B)' }
    },
    {
        id: 'm10',
        title: 'O Supervisor Proativo (Drilldown)',
        situation: 'O Coordenador olha os analíticos e vê que há 5 Pendências Abertas.',
        error: 'Mandar mensagem geral no grupo perguntando "de quem são essas pendências?".',
        leanRule: 'Use dados para ir direto na causa raiz do desperdício (Gemba real, sem fofoca).',
        action: 'Clique no card "Pendências Abertas" no Mission Control. O sistema filtrará e abrirá uma Lista apontando exatamente onde estao as tarefas.',
        verification: { question: 'Drill-down existe para:', options: ['(A) evitar gemba', '(B) ir direto no leito certo', '(C) criar reunião'], correctKey: '(B)' }
    }
];

export const APP_TUTORIALS: AppTutorial[] = [
    {
        id: 'tut-chamados',
        title: 'Como abrir um chamado pelo Admin Celular',
        description: 'Guia de como a liderança pode interagir com os cards do Mission Control na visão de bolso (smartphone).',
        icon: 'smartphone',
        steps: [
            'Acesse o aplicativo no seu celular utilizando um perfil com permissões de Admin/Supervisor.',
            'Na tela inicial do Mobile Admin, identifique os alertas vermelhos na seção superior primária (Mission Control).',
            'Toque sobre o card de alerta (ex: "Escalonamentos" ou "Pendências Abertas").',
            'O aplicativo abrirá o "Drill-down", mostrando a lista exata dos leitos ou tarefas que precisam de suporte da coordenação.',
            'Clique no item desejado e atue sobre o bloqueio diretamente junto às áreas de apoio do hospital.'
        ]
    },
    {
        id: 'tut-kanban',
        title: 'Como usar o Modo Kanban de Alta na prática',
        description: 'Aprenda a visualizar sua unidade de saúde através das faixas de Kanban (previsão de alta).',
        icon: 'layout-dashboard',
        steps: [
            'Acesse a tela principal do Editor (Beira-Leito) ou Painel do Posto.',
            'No cabeçalho, localize e ative o interruptor (Toggle) de visualização nomeado Modo Kanban.',
            'Os leitos deixarão de ser ordenados numericamente (quarto 1, quarto 2) e passarão a ser agrupados nas colunas verticais.',
            'As faixas visuais são organizadas por urgência: Menos de 24h (Verde), 2 a 3 dias (Amarelo) e Mais de 3 dias/Indefinido (Cinza).',
            'Use esta visão para a passagem de plantão, mantendo o foco em tentar destrancar os bloqueadores dos pacientes que estão nas colunas de 2-3 dias ou mais largas para acelerar as altas.'
        ]
    },
    {
        id: 'tut-resetar',
        title: 'Como resetar um leito na Alta',
        description: 'Instruções de como liberar corretamente a interface de um leito devolvendo-o à fase "Vazio".',
        icon: 'bed-double',
        steps: [
            'Abra individualmente o Editor do paciente (Bed Details) que já deixou fisicamente da unidade.',
            'Se a "Faixa de Internação" atual não for "Alta", troque o status para Alta.',
            'Resolva ou limpe as Pendências abertas daquele caso em específico.',
            'No painel de detalhes do leito, clique no campo nome para remover o nome do paciente antigo e garantir que ele volte a ficar com a etiqueta de "Leito Vazio".',
            'Sempre garanta que esse processo é feito imediatamente após a saída física do paciente.'
        ]
    }
];
