# BedSight 360 — Auditoria Lean (2026-02-28)

> **Missão:** somente leitura. Nenhum código foi alterado.
> **Objetivo:** coletar evidências suficientes para o plano de migração/refatoração Lean.

---

## Documentos gerados

| Documento | Conteúdo |
| ----------- | ---------- |
| [AUDIT_LeanAlignment_2026-02-28.md](./AUDIT_LeanAlignment_2026-02-28.md) | **Documento mestre.** Features, flags, CFs, testes, respostas às 6 perguntas, gap list K+H+M |
| [AUDIT_Kamishibai_States_2026-02-28.md](./AUDIT_Kamishibai_States_2026-02-28.md) | Estados `ok/blocked/na`, ordem canônica de domínios, onde é lido/escrito, 5 gaps |
| [AUDIT_Firestore_Model_2026-02-28.md](./AUDIT_Firestore_Model_2026-02-28.md) | Schema canônico de todas as coleções, exemplos JSON anonimizados, 5 casos problemáticos |
| [AUDIT_MissionControl_2026-02-28.md](./AUDIT_MissionControl_2026-02-28.md) | Spec reverso dos 4 KPIs, thresholds hardcoded, drill-downs, fontes, 6 gaps |
| [AUDIT_Analytics_Freshness_Aging_2026-02-28.md](./AUDIT_Analytics_Freshness_Aging_2026-02-28.md) | Pipeline Firestore live vs BigQuery (com 500), freshness, aging, 7 gaps |
| [AUDIT_TV_Rotation_2026-02-28.md](./AUDIT_TV_Rotation_2026-02-28.md) | Telas TV (Kanban/Kamishibai/Summary), rotação, cores de badges, 5 gaps |
| [AUDIT_Cadencia_Huddle_2026-02-28.md](./AUDIT_Cadencia_Huddle_2026-02-28.md) | Suporte a rituais Lean (Huddle AM/PM, checklists, TTL de turno), schema necessário, 8 gaps |

---

## Gaps críticos (resumo executivo)

| Prioridade | Gap | Arquivo detalhe |
| ----------- | ----- | ---------------- |
| 🔴 ALTA | Verde Kamishibai sem TTL de turno — `ok` de ontem persiste | Kamishibai_States G3, Cadencia R2 |
| 🔴 ALTA | Estado "sem cor/inativo" não existe — `na` é ambíguo | Kamishibai_States G1, LeanAlignment K1 |
| 🔴 ALTA | Sem `lastHuddleAt` — sistema não suporta rituais AM/PM | Cadencia R1, LeanAlignment H1 |
| 🔴 ALTA | Pipeline BigQuery com 500 — Analytics Exploração inoperante | Analytics G3 |
| 🟡 MÉDIA | `blockedAt` não existe — aging usa `updatedAt` como proxy impreciso | Analytics G1, MissionControl G2 |
| 🟡 MÉDIA | Pendências não sobrevivem ao turno | Cadencia R4, LeanAlignment H3 |
| 🟡 MÉDIA | `topBlockerNow` calculado mas não exibido no Mission Control tab | MissionControl G1 |
| 🟡 MÉDIA | Freshness usa `updatedAt` do leito inteiro, não por domínio | MissionControl G5 |
| 🟡 MÉDIA | Thresholds de alerta 100% hardcoded no frontend | MissionControl G4 |
| 🟢 BAIXA | `note` em KamishibaiEntry existe no schema mas não tem UI | Kamishibai_States G5 |
| 🟢 BAIXA | `kanbanMode` ACTIVE_LITE sem enforcement backend | Firestore G4, LeanAlignment K8 |

---

## Perguntas de conclusão — status

| # | Pergunta | Respondida? |
| --- | --------- | ------------ |
| 1 | Quais estados/cor existem e onde definidos? | ✅ AUDIT_Kamishibai_States + AUDIT_LeanAlignment §6.1 |
| 2 | Como Kamishibai é ligado/desligado? | ✅ AUDIT_Kamishibai_States §5 + AUDIT_LeanAlignment §2 |
| 3 | Como Mission Control depende dos estados? | ✅ AUDIT_MissionControl §7 |
| 4 | Quais métricas existem e como calculadas? | ✅ AUDIT_Analytics_Freshness_Aging §1 |
| 5 | Onde thresholds/regras estão codificados? | ✅ AUDIT_MissionControl §6 + AUDIT_LeanAlignment §6.5 |
| 6 | Mudanças de alto risco? | ✅ AUDIT_LeanAlignment §6.6 |

**Conclusão: auditoria 360 concluída. Todos os critérios de encerramento foram atendidos com evidências.**
