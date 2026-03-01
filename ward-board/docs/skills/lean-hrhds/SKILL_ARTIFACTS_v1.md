# Artefatos e Templates: Lean no HRHDS

Este documento contém os templates práticos para a execução da rotina Lean suportada pelo BedSight na unidade do HRHDS.

---

## 1. Script do Huddle (10 – 15 minutos)

**Frequência:** 2x ao dia (Início do Turno AM `07:00` e Início do Turno PM `19:00`).
**Local:** Em frente ao painel TV BedSight (Gemba).
**Participantes:** Médico Diarista/Horizontal, Enfermeiro Líder do plantão, Fisioterapeuta, Serviço Social, Psicologia, Nutrição.

**Passo a passo do Ritual:**

1. **(1 min) Abertura:** A Liderança reúne a equipe e declara o início do Huddle (ex: "Bom dia equipe, iniciando Huddle AM").
2. **(4 min) Foco nas Altas (Kanban Verde <24h):** Filtrar visualmente no painel os pacientes com alta prevista para "Hoje".
   - _Pergunta unificadora:_ "Quais são as barreiras exatas para essas altas acontecerem até o almoço?"
   - _Ação:_ Se houver bloqueio (Kamishibai vermelho), designar um responsável nominal para resolver.
3. **(5 min) Varredura de Bloqueios Críticos (Kamishibai Vermelho em Aging):** Varredura visual de quem está vermelho na TV há mais tempo (aging).
   - _Pergunta:_ "Paciente X está com exame travado desde as 03:00. O que precisamos fazer agora?"
4. **(3 min) Pacientes sem Cor (Não revisados):** Cobrar que todas as disciplinas validem seus pacientes do turno atual (tirar os leitos ativos do status branco/neutro verificando se estão OK ou Bloqueados).
5. **(2 min) Fechamento e Registro:** Líder clica no botão "Registrar Huddle AM/PM" no sistema BedSight, gerando a evidência oficial (`lastHuddleAt`) e formalizando o fim do ritual.

> **Critério de Done:** Ao final da reunião, o botão "Registrar Huddle" foi acionado no sistema por um Editor/Admin.

---

## 2. Checklist de Início de Turno (Equipe Multiprofissional)

**Responsabilidade:** Todos os profissionais escalados (Médico, Enfermagem, Fisio, Nutrição, Psico, Serviço Social).
**Momento:** Nas primeiras duas horas de cada plantão.

- [ ] Participar do Huddle com o Líder da unidade.
- [ ] Abrir o BedSight no tablet, celular ou computador (Visão Editor).
- [ ] Filtrar os pacientes sob seu cuidado na unidade.
- [ ] Para cada leito ativo, checar se a sua disciplina:
  - Não atua neste paciente: marcar ou confirmar como **N/A**.
  - Tem pendências estruturais (ex: laudos atrasados, vaga negada): marcar seu domínio como **Bloqueado (Vermelho)** detalhando o motivo.
  - O fluxo está normal hoje: marcar como **OK (Verde)** validando o turno atual.
- [ ] Atualizar o horizonte de alta (Kanban) se você é o médico/líder responsável pelo plano terapêutico (<24h, 2-3 dias, etc).

> **Critério de Done:** Não deve haver nenhum paciente da sua responsabilidade no status "Sem cor / Branco" no término da sua rotina de passagem de plantão.

---

## 3. Regra de Escalonamento de Bloqueios (Rascunho v1)

Esta regra orienta a equipe de gestão quando um bloqueio sistêmico do Kamishibai (vermelho) permanece não resolvido. Na v1 do HRHDS, este processo é visual e manual.

### Nível 1 (Operacional / Beira-leito)

- Tempo em Bloqueio: `0 a 4 horas`
- Ação: O profissional que declarou o bloqueio (vermelho) tenta resolver diretamente com as áreas de apoio (laboratório, exames, etc.). A resolução é cobrada ativamente no próximo Huddle.

### Nível 2 (Liderança da Unidade)

- Tempo em Bloqueio: `4 a 8 horas`
- Ação: No Huddle, o líder assume a tratativa corporativa. Exemplos: O Coordenador de Enfermagem contacta a Coordenação do Laboratório; o Médico Rotineiro liga para o Radiologista de plantão.

### Nível 3 (Alta Gestão / Escalada Tática)

- Tempo em Bloqueio: `Maior que 8 horas` (o bloqueio já sobreviveu a uma mudança de turno)
- Ação: O bloqueio visivelmente envelhecido entra no radar do Núcleo Interno de Regulação (NIR) e Diretoria Clínica/Técnica para pressão institucional (ex: liberação de vagas externas de UTI, sobreposição governamental).

> **Critério de Done:** Qualquer impedimento com _aging_ superior a 8 horas recebe trâmite prioritário pela Direção / NIR na busca imediata por resolução.
