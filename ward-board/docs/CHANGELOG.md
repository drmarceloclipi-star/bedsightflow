# Changelog do Projeto LEAN

Este arquivo mapeia por data todas as mudanças funcionais, estruturais e de testes que aconteceram ao longo das sessões de trabalho, mantidas pelo ScribeAgent.

## [2026-03-01] Etapa 1.10 — Testes, UX e Hardening

### Adicionado

- Testes E2E Completos para o Mission Control (`tests/lean-mission-control-escalations.spec.ts`) validando aging e thresholds (Escalation v1).
- Integração Playwright local e emulator, usando login robusto via seed e bypassing `cross-origin-opener-policy`.
- `Huddle Snapshot Summary` — Novos métodos em repositórios e na UI para coletar métricas do leito no começo e fim de um Huddle.

### Alterado

- **Admin Mobile Design:** Navegação subdividida explicitamente entre `Mission Control` e `Analytics`.
- **UI:** Remoção de badges de Unidade redundantes nas views Admin para limpar o layout. Redesign do cabeçalho nas viws Mobile.
- **Botão EduCenter:** Trocado da navbar principal do Admin por um simples `?` flutuante no canto superior.
- Refinamento do Layout Header para espalhar os itens Top-Left e Top-Right até as bordas.

### Removido

- Bugs legados no Frontend/Functions de Permissão ao logar usuários com permissão EDITOR localmente (Insuficient Permissions no Fetch Beds/Units foram resolvidos testando rotas sem redirect em loop).

### Fix / Hardening

- Integrations Tests Gate para de Cloud Functions finalizados (P0 unit test cases finalizados, tsc sem erros).
