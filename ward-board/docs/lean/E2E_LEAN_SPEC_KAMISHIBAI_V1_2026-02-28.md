# E2E — Spec (Lean Suite) — Kamishibai v1 (TTL + N/A + Inativo + Toggle)

**Data**: 28 de Fevereiro de 2026
**Estatus**: Implementado e Testado

## Missão

Validar o renderer Kamishibai v1 (TV + Editor) abordando:

- Diferenciação visual entre leitos ativos (MÉDICA), inativos (vazios), N/A (domínios excluídos).
- O recálculo de prazo (TTL) do status "Conforme" (verde) baseado em turno, exigindo revalidação (unreviewed).
- Persistência contínua do status "Impedido" (vermelho), sem expiração automática no fim do turno.
- Refletir atualizações de status feitas no Editor em tempo real na tela Kamishibai da TV.
- Testar o liga/desliga geral (`kamishibaiEnabled`) via painel de Operações (Admin).

---

## Pré-condições (Semeadura)

A execução com êxito deste script depende fortemente de pré-condições de seed garantidas via `npm run seed`:

- **Admin/Editor Account**: `admin@unit-a.com` e `editor@unit-a.com` semeadas em `/unitUsers`.
- **Kamishibai Enabled**: Em `/units/A/opsSettings`, o campo `kamishibaiEnabled: true` e a escala de huddle definida como `07:00/19:00`.
- **Bed `301.4` (TTL Test)**:
  - Leito ativo com `status='ok'`.
  - Contudo, **sem um `reviewedShiftKey` válido ou correspondente ao turno atual**, simulando uma conformidade expirada do turno anterior.
  - (Resultado esperado: cinza "Não Revisado").
- **Bed `301.2` (Blocked Test & N/A Test)**:
  - Leito ativo.
  - O domínio Médica está marcado com `status='blocked'` (Resultado esperado: vermelho "Impedido", sem influência do TTL).
  - O domínio Fisioterapia (`physio`) ou Serviço Social estão ausentes do `applicableDomains` do leito. (Resultado esperado: marcador branco tracejado N/A).
- **Bed `302.3` (Inactive Test)**:
  - Leito sem paciente associado (`patientAlias` vazio) e totalmente sem marcações de Kamishibai. (Resultado esperado: pontos cinzas escurecidos de placeholder inativo).

---

## Cenários de Teste

### Cenário 1 — TV Kamishibai (Estados Visuais)

1. **Ação**: Acessar `/tv?unit=A&screen=kamishibai`. (Uso do `&screen=` acelera o teste fixando a tela sem aguardar o ciclo de rotação).
2. **Validações**:
   - **Inactive**: Verificar se na linha do leito `302.3`, a coluna exibe o placeholder de um leito não ocupado. (`data-state="inactive"`)
   - **TTL/Unreviewed**: No leito `301.4`, confirmar que, apesar de ele talvez ter `status='ok'`, por estar em um turno novo, sua cápsula Médica está classificada como Não Revisada. (`data-state="unreviewed"`)
   - **Blocked**: O leito `301.2` deve apresentar a cor vermelha marcante (`blocked`) no domínio Médica.
   - **N/A (Not Applicable)**: O leito `301.2` deve apresentar a formatação tracejada para o domínio `physio`. (`data-state="not_applicable"`)

### Cenário 2 — Toggle `kamishibaiEnabled`

1. **Ação**: Fazer login como Admin e acessar `/admin/unit/A/ops`.
2. **Ação**: Localizar a seção "Recursos e Alertas" ou "Visão Geral", desmarcar o toggle do **Quadro Kamishibai**.
3. **Validações**:
   - Abrir a rota da TV `?unit=A&screen=kamishibai` e observar os leitos ativos (por exemplo, `301.2` e `301.4`).
   - Ao invés de suas cores dinâmicas, todas as marcações devem cair para o fallback inativo (`data-state="inactive"`).
4. **Reversão**:
   - Retornar ao painel de Operações, e ligar o toggle do Kamishibai novamente.
   - Observar na TV que as marcações visuais imediatas com cores do leito voltaram.

### Cenário 3 — Editor: Registro de Conformidade no Painel

1. **Ação**: Logado como Editor, navegar para os detalhes do paciente no leito `301.4` (`/editor/bed/bed_301.4`).
2. **Ação**: Observar a tabela Kamishibai do Editor e acionar o botão "Tudo Conforme" (OK) para a especialidade Médica.
3. **Validações**:
   - Checar de forma implícita e responsiva que a gravação ocorreu com sucesso (`BedRepository` atualiza o card sem disparar erro, enviando `blockedAt` corrigido e limpando ou preservando flags prévias).
4. **Ação**: Abir a aba da TV (`/tv?unit=A&screen=kamishibai`).
5. **Validações**:
   - Na respectiva linha e coluna do `301.4`, certificar-se que a bolinha de status deixou de constar como "Não Revisada" e agora brilha verde como Conforme (`data-state="ok"` ou a classe pertinente `.kamishibai-dot--ok`).

---

## Considerações Técnicas Adicionais

- **TV Rotation Hack**: Adicionou-se `forceScreen` ao componente `TvRotationContainer` (consumindo o query string `?screen=xyz`) para que a suíte Playwright não timeout aguardando um longo ciclo de quadros (Kanban, Escalonamento, então Kamishibai).
- Foi corrigido um payload `undefined` acionando erro de Firestore nativo dentro do componente `BedDetails` / `KamishibaiStatusPicker` do modo Editor na hora do commit de gravação (`undefined` na atribuição do null de `blockedAt`).
