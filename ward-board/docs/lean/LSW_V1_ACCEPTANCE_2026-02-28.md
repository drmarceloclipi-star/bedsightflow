# LSW_V1_ACCEPTANCE — 2026-02-28

**Missão:** entregar o Leader Standard Work v1 integrado à operação e à TV (sem CRON, alertas push ou mudanças excessivas no BD).  
**tsc --noEmit:** ✅ 0 erros (verificado 2026-02-28)

---

## Funcionalidades e Critérios de Aceite (Etapa 1.7)

| # | Critério | Status | Onde Ver |
|---|----------|--------|-----------|
| LSW1 | O componente HuddleConsole.tsx suporta LSW AM/PM com checklist | ✅ | \`src/features/admin/components/ops/HuddleConsole.tsx\` |
| LSW2 | A interface OpsScreen agora abriga nativamente o HuddleConsole | ✅ | \`src/features/admin/screens/OpsScreen.tsx\` |
| LSW3 | Ações do Top 3 podem ser adicionadas e concluídas (open/done) | ✅ | Console LSW na interface Admin > Área de "Top 3 Ações" |
| LSW4 | A interface da TV exibe "Top 3 Ações" (apenas status open) | ✅ | \`src/features/tv/pages/TvDashboard.tsx\` - Banner inferior |
| LSW5 | A interface da TV exibe pendências do turno anterior com "Review Pendente" | ✅ | \`src/features/tv/pages/TvDashboard.tsx\` - Banner inferior esquerdo |
| LSW6 | A interface da TV exibe banner dinâmico "🔥 Escalonamentos", calculado em runtime com default thresholds | ✅ | \`src/features/tv/pages/TvDashboard.tsx\` |
| LSW7 | \`HuddleRepository\` isola a camada de dados em \`huddles/{shiftKey}\` | ✅ | \`src/repositories/HuddleRepository.ts\` |
| LSW8 | Atualização automática do \`lastHuddleShiftKey\` nas configurações de operações ao finalizar Huddle | ✅ | \`HuddleRepository.ts\` -> \`endHuddle()\` |
| LSW9 | Dados mock/seeds disponíveis para validação da UI da TV | ✅ | \`scripts/seed-data.ts\` cria um \`PREV_SHIFT_KEY\` e o atrela as configuracões |

---

## Como Reproduzir no Emulador (Verificação E2E)

### Pré-condição

```bash
# Iniciar emulador num terminal
npm run emulators

# Em outro terminal, rodar o seed
npm run seed
```

### Passo 1: LSW Huddle e Top 3 Ações no Admin

1. Acesse o painel web admin (<http://localhost:4000> ou porta configurada) usando um seed account.
2. Navegue até a tela principal de **Gerenciamento (Ops)**.
3. Você verá o componente "Huddle (Quadro de LSW)".
4. Crie ou inicie o Huddle deste turno se não estiver iniciado.
5. Registre novas "Top 3 Ações" (ex: "Verificar leito X").
6. Conclua uma ação antiga para checar a mudança de status.
7. O campo \`lastHuddleShiftKey\` da unity setting (ops) será modificado automaticamente ao clicar em Finalizar Huddle.

### Passo 2: Reflexão dos Banners na TV LSW v1

1. Abra a visualização da TV: \`<http://localhost:5173/tv?unit=A\`>
2. Observe o rodapé inferior:
   - **Top 3 Ações**: Aparece no painel caso você tenha criado ações no turno atual (se recém-iniciado e preenchido no admin).
   - **Review Pendente**: O mock seed injetado no passo anterior carrega ações pendentes com dono "Enf. Maria" relacionadas ao turno em \`PREV_SHIFT_KEY\`.
   - **🔥 Escalonamentos**: No canto, exibe N escalonamentos (computado em runtime de acordo com leitos sem review há mais de X horas (threshold padrão=12h) e/ou \`mainBlocker\` crítico > 24h).

---

## Arquivos e Diretórios (Resumo da Mudança)

| Arquivo/Caminho | Tipo | Status |
|-----------------|------|--------|
| \`src/domain/huddle.ts\` | **NOVO** | Tipagens de domínio, constantes e helpers (\`HuddleDoc\`, \`HuddleAction\`) |
| \`src/repositories/HuddleRepository.ts\` | **NOVO** | Camada de isolamento de DB (CRUD em \`huddles/{shiftKey}\`, atomic transaction pra \`ops\`) |
| \`src/features/admin/components/ops/HuddleConsole.tsx\` | **NOVO** | UI Admin, isolada para gerir a sessão de Huddle, substituir o registro legado. |
| \`src/features/admin/screens/OpsScreen.tsx\` | MODIFY | Remoção de lógica Huddle mockada para inclusão nativa do \`HuddleConsole\` |
| \`src/features/tv/pages/TvDashboard.tsx\` | MODIFY | Construção visual da integração (Top 3 Ações, Review v1 e Escalonamento default) via useMemo/Subscriptions |
| \`scripts/seed-data.ts\` | MODIFY | Inclusão de Seed Script para criar dados do PREV_SHIFT_KEY contendo open/closed actions. |
| \`src/domain/escalation.ts\` | MODIFY | Adaptações de export/import de fallback defaults via \`DEFAULT_ESCALATION_THRESHOLDS\` |

---

## O que NÃO mudou

- Sem migrations massivas.
- Firebase Cloud Functions não recebeu regras adicionais de notificações (v2).
- Os leitos de Kanban não tiveram status alterado.
- Os modelos de Pendencies v1 continuam atuando separadamente, não foram fundidos (por design da etapa 1.7).
