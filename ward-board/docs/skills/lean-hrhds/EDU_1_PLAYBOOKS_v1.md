# EDU-1: Playbooks Operacionais (HRHDS x BedSight)

Este material define as "receitas de bolo" (fluxogramas operacionais diretos) para usar o BedSight na sustentação dos ritos Lean.

---

## 1. Playbook do Huddle (Reunião Rápidas de Alinhamento)

**Quando:** No início de cada turno (AM e PM).
**Quem:** Liderança do setor + equipe núcleo presente (Enf, Médico, Fisio).

1. **Input:** O painel da TV da Unidade está apitando um badge amarelo de "⚠ HUDDLE PENDENTE".
2. **Steps (Reunião Fisíca):**
   - Em frente ao painel ou TV, perguntar em rápida sucessão:
     - Qual o total de pacientes?
     - Quantas altas esperamos nas próximas 12 horas?
     - Qual o maior fogo a ser apagado agora?
3. **Steps (BedSight Action):**
   - O Líder abre o tablet ou desktop na tela `/admin` da unidade e vai até a aba `Ops`.
   - Clica no botão respectivo `Registrar Huddle AM` (ou PM, base no horário local calculado por \`huddleSchedule\`).
   - Verifica o balão verde do Toast "✓ Huddle Registrado".
4. **Done Criteria:** O Badge "HUDDLE PENDENTE" sumiu imediatamente da TV, indicando que este turno cumpriu a rotina inicial de Lean.

---

## 2. Playbook do Kamishibai (Giro a Beira-Leito)

**Quando:** Interações individuais com paciente ao longo do turno.
**Quem:** Quaisquer profissionais que fazem o giro assistencial.

1. **Input:** O profissional acessa o seu setor ou leito designado de um paciente na aba de 'Editor'.
2. **Steps:**
   - Realizar o atendimento clínico e checagem com paciente.
   - Abrir o App e clicar na especialidade vinculada à sua área.
   - Se a etapa assistencial principal foi realizada sem falhas, marque o cartão visual como **"OK"** (Verde).
   - Se ocorreu algum problema (medicamento faltante, exames em atraso), selecione **"Impedimento"** (Vermelho).
3. **Done Criteria:**
   - O tempo base (\`reviewedAt\`) dos domínios revisados atualizará para a hora da ação.
   - O Mission Control mostrará redução do contador de "Não Revisados No Turno".

---

## 3. Playbook de Gestão de Pendências (Impedimentos do Paciente)

**Quando:** Descobre-se um bloqueio para as ações programadas ao paciente, como exames em falta, que requerem esforço pontual.
**Quem:** O profissional que constatou o impedimento.

1. **Input:** Um Kamishibai marcado como "Impedimento" que exija ação extra sistemática.
2. **Steps:**
   - No painel da Beira-Leito ("Bed Details"), acesse a área de "Pendências".
   - Adicione uma Nova Pendência explícita (Ex: "Falta de Hemocultura").
   - Opcional mas Recomendado: Marque o dono e aplique no relógio uma previsão/ultimato (Campo \`dueAt\`).
3. **Steps Subsecutivos:**
   - Quando resolvido: Marcar a tarefa ativa como "Concluída".
   - Se for irrelevante: Clicar no botão "Cancelar (✕)", anotando porquê ela perdeu utilidade.
4. **Done Criteria:** As pendências estão catalogadas, aparecem em Mission Control ("Pendências abertas") sem gerar gargalos ocultos.

---

## 4. Playbook de Escalonamento (Missão Salva a Casa)

**Quando:** O problema "transbordou" os pactos normais ou fugiu da capacidade local de contenção da enfermagem da ponta.
**Quem:** Supervisor de Enfermagem / Gestor Unidade e/ou Direção Médica.

1. **Input:** No painel principal `/admin/analytics`, no dashboard Mission Control, aparece destacada a linha 🔥 **Escalonamentos**. Há números listados lá.
2. **Steps:**
   - Clicar fisicamente no número aceso a vermelho.
   - Analisar a tela de Ação:
     - Pode ser lista virtual de \`escalations_overdue\` -> Pendências que passaram pelo limiar \`escalationOverdueHoursCritical\` (Default: > 12h do horário pretendido).
     - Pode ser lista virtual de \`escalations_blocker\` -> Paciente detendo a Unidade há mais de 24h (\`mainBlockerBlockedAt\`).
   - O supervisor age em nível hospitalar para desfazer aquele gargalo (ligar no andar de baixo para a sala de exame, solicitar liberação da cirurgia).
3. **Done Criteria:** Card do Escalonamento volta ao cinza ou aponta ZERO no Mission Control por conta da pendência vencida cancelada/concluída, ou bloqueador trocado/livre.

---

## 5. Playbook — Kanban de Alta (faixas <24h / 2–3d / >3d / indef.)

**Entrada:** paciente internado no leito + necessidade de previsão de alta por faixa no turno.

**Passos:**

1. Definir faixa atual: <24h, 2–3d, >3d ou indef. (compromisso revisável, não chute).
2. Se >3d ou indef. → preencher/atualizar Bloqueador Principal (mainBlocker).
3. Se o bloqueador mudar de fato → atualizar o relógio do bloqueio (ex.: mainBlockerBlockedAt).
4. Revisar no huddle: “o que precisa acontecer para cair uma faixa?” (barreiras viram pendências com dono e prazo).

**Done Criteria:** todos os leitos têm faixa atualizada no turno; leitos >3d/indef. têm bloqueador principal explícito e revisado.
