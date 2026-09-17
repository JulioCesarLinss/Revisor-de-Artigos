# Revisor-de-Artigos

Projeto de revisão acadêmica com foco em normas ABNT e assistência por IA.

## O que é

Ferramenta web para revisão de artigos e trabalhos acadêmicos: catálogo determinístico de regras com referência ABNT (NBR 10520/6023/14724), relatório de conformidade por seção, navegação ao trecho problema, correções com rastro, assistência IA opcional e fluxo guiado rascunho → revisão → versão final com comparação lado a lado.

## Como rodar

```bash
bun install
bun run dev        # http://localhost:5173
bun test           # 53 testes
bun run typecheck
bun run build      # produção em dist/
```

Assistência IA (opcional): informe uma chave de API compatível OpenAI na própria interface, ou defina `VITE_OPENAI_API_KEY`.

## Objetivo inicial

- Tornar a revisão mais rápida e mais compreensível.
- Separar o que é exigência normativa do que é recomendação por IA.
- Oferecer um fluxo claro de importar, analisar, editar e acompanhar revisão.

## Documentação do projeto

- [[Cérebro do Projeto]] — documento central com sprints, decisões e organização do produto.
- `docs/` — documentos complementares da Sprint 0:
  - `docs/00-lean-canvas.md`
  - `docs/01-backlog.md`
  - `docs/02-arquitetura-modulos.md`
  - `docs/03-decisoes-tecnologias.md`
  - `docs/04-contributing.md`
  - `docs/05-lingua-glossario.md`
  - `docs/06-sprint-0-plan.md`
  - `docs/06-sprint-1-plan.md`
  - `docs/06-sprint-2-plan.md`
  - `docs/06-sprint-3-plan.md`
  - `docs/06-sprint-4-plan.md`
  - `docs/06-sprint-5-plan.md`
  - `docs/11-entrega-v1.md` — documentação v1 de manutenção

## Próximos passos

- Sprints 0 a 5 estão encerradas no nível documental (planos em `docs/06-sprint-*-plan.md`).
- **Sprint 1 executada em código**: app em `src/` (Vite + React + TypeScript) com importar → analisar → corrigir → reanalisar.
- **Sprint 2 executada em código**: catálogo normativo R001–R010 com referência ABNT (NBR 10520/6023/14724), relatório de conformidade por seção e navegação até o trecho problema.
- **Sprint 3 executada em código**: assistência IA opcional (endpoint compatível OpenAI, chave do usuário) com sugestão pontual, explicação, aceitar/editar/ignorar e histórico com rastro manual vs IA.
- **Sprint 4 executada em código**: fluxo rascunho → revisão → versão final com snapshots, comparação lado a lado por parágrafo e feedback “isso ajudou?”.
- **Sprint 5 executada em código**: testes dos caminhos principais e limites (53 no total), acessibilidade e [[Documentação v1]] em `docs/11-entrega-v1.md`.
- **Ciclo 1→5 completo.** Manutenção: comece por `docs/11-entrega-v1.md`; priorização de expansão segue DC-12 em `docs/03-decisoes-tecnologias.md`.

## Como contribuir

Veja `docs/04-contributing.md` para orientações sobre issue, Pull Request e critérios de aceite.
