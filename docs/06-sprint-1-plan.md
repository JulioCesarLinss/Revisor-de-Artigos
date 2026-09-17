# Plano da Sprint 1 — MVP de Revisão Manual

> Wikilink: [[Sprints]] · Sprint 1 — MVP de Revisão Manual

## Objetivo

Permitir que o usuário submeta um texto/Manuscrito, visualize problemas identificados e faça correções manuais.

## Escopo

- Upload ou colagem de conteúdo acadêmico.
- Renderização básica do documento/Manuscrito.
- Primeira classe de verificações (ex.: estrutura básica, problemas óbvios de formatação).
- Lista de problemas com severidade.
- Ações de correção manual.

## Critérios de aceitação

- O usuário consegue importar um texto e ver uma análise preliminar.
- Problemas são apresentados de forma legível e ação.
- Não há perda de conteúdo durante o fluxo básico.

## Entregáveis

- [x] Entrada de texto/Manuscrito (colagem ou importação simples) — planejada como primeira tarefa da revisão manual.
- [x] Representação básica do texto em revisão — comportamento definido pelo objetivo já existente no [[Cérebro do Projeto]].
- [x] Primeira classe de verificações/aplicação inicial de regras — escopo mantido no nível previsto para a Sprint 1.
- [x] Lista de problemas com severidade — critério alinhado à separação entre o que é problema e o que ainda será assistência futura.
- [x] Ação manual de correção que atualize o rascunho — definida como parte do fluxo de revisão manual, sem acrescentar IA ou versionamento avançado.

## O que não está em escopo agora

- Assistência por IA.
- Catálogo grande ou especializado de regras ABNT.
- Fluxo de revisão guiada completo, diff avançado e versionamento completo.

Esses itens permanecem atribuídos a Sprints futuras, conforme o [[Cérebro do Projeto]].

## Critério de prontidão para encerrar a Sprint 1

Para poder seguir adiante, espera-se que:

- o usuário consiga importar, analisar e corrigir manualmente um texto de exemplo;
- a análise preliminar seja compreensível e não traga perda de conteúdo;
- o [[Cérebro do Projeto]] e o [[Backlog v1]] reflitam o que foi entregue.

## Estado

**Executada em código.** O fluxo importar → analisar → corrigir → reanalisar está implementado e testado, com escopo restrito ao já definido no [[Cérebro do Projeto]].

## Execução em código

- **Stack** (DC-10, dependências mínimas): Vite + React + TypeScript; testes com o runner nativo do Bun.
- **Módulos** (conforme [[Arquitetura por Módulos]]): `src/document` (importação, representação, correções), `src/rules` (catálogo + motor), `src/review` (orquestração), `src/ui` (canvas do manuscrito, resumo, cards de problema).
- **Primeira classe de verificações**: catálogo R001–R006 determinístico — espaço antes da pontuação, parágrafo longo, aspas desbalanceadas, parágrafo sem pontuação final, caixa-alta em excesso, documento curto. Cada problema segue a estrutura do DC-08 (id, categoria, severidade, mensagem, referência, local, trecho, ação).
- **Correção manual**: edição direta do texto (fonte de verdade) e correções rápidas determinísticas por parágrafo, com reanálise imediata; nenhum conteúdo é descartado.
- **Testes**: 22 testes (`bun test`) cobrindo importação, ações, catálogo, ordenação por severidade, determinismo e o fluxo principal; `bun run typecheck` e `bun run build` limpos.
- **Como rodar**: `bun install` · `bun run dev` (http://localhost:5173) · `bun test` · `bun run build`.

## Como usar este plano

Este plano é uma tradução direta do objetivo e escopo já definidos no [[Cérebro do Projeto]] para a Sprint 1. Sempre que um detalhe novo for necessário, ele deve ser registrado em documento complementar e vinculado a partir do CEREBRO, em vez de adicionar comportamento fora do escopo.

## Observação sobre material externo

Durante a análise do repositório, foi encontrado um caminho de exemplo em `stitch_revisor_de_artigos_abnt/` com documentos de layout e estruturas visuais relacionadas ao tema de revisão ABNT. Isso foi registrado como um caminho encontrado pelo repositório, não como base consolidada para esta sprint.

Entregar a Sprint 1 a partir do que já está definido no [[Cérebro do Projeto]] e, se fizer sentido a partir do uso real, decidir depois se algum material desse caminho auxilia o produto.

> Documento complementar ao [[Cérebro do Projeto]] e ao [[Backlog v1]].
