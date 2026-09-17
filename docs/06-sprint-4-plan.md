# Plano da Sprint 4 — Fluxo de Revisão Guiada

> Wikilink: [[Sprints]] · Sprint 4 — Fluxo de Revisão Guiada

## Objetivo

Transformar a ferramenta em um processo, não apenas um relatório.

## Escopo

- Rascunho, revisão, versão final.
- Comparação lado a lado original × sugerido.
- Histórico de revisões e estados.
- Precisão e feedback do usuário ("isso ajudou?") para refinamento.

## Critérios de aceitação

- O usuário pode conduzir uma revisão do início ao fim.
- Alterações são versionadas internamente.
- O fluxo reduz a carga cognitiva em vez de aumentá-la.

## Entregáveis

- [x] Estados de fluxo definidos: rascunho → revisão → versão final, conforme o [[Cérebro do Projeto]].
- [x] Comparação lado a lado entre original e sugerido prevista como entregável do ciclo.
- [x] Histórico de revisões e estados definido dentro da persistência mínima já orientada no [[Cérebro do Projeto]].
- [x] Feedback do usuário ("isso ajudou?") previsto como insumo de refinamento do fluxo.
- [x] Critérios de aceite do ciclo registrados neste plano e no [[Backlog v1]].

## O que não está em escopo agora

- Polimento final de qualidade e usabilidade (assunto da Sprint 5).
- Expansão do catálogo de regras além do definido na Sprint 2.
- Novos comportamentos de IA além dos definidos na Sprint 3.

Esses itens permanecem atribuídos a sprints próprias, conforme o [[Cérebro do Projeto]].

## Estado

Concluída no plano, seguindo o mesmo critério documental das sprints anteriores: objetivo, escopo, critérios de aceite e entregáveis consolidados sem implementação em código. A execução em código deste ciclo permanece como decisão explícita de ciclo futuro (ver DC-14 em `docs/03-decisoes-tecnologias.md`).

## Critério de prontidão para encerrar a Sprint 4

Para poder seguir adiante, espera-se que:

- o fluxo de revisão possa ser conduzido do início ao fim por um usuário real;
- as alterações tenham rastro e possam ser recuperadas;
- o fluxo reduza a carga cognitiva em vez de aumentá-la;
- o [[Cérebro do Projeto]] e o [[Backlog v1]] reflitam o que foi entregue.

## Estado

**Executada em código.** Fluxo guiado, comparação lado a lado, histórico versionado e feedback implementados sobre a base das Sprints 1–3.

## Execução em código

- **Fluxo rascunho → revisão → versão final** (`src/workspace/fluxo.ts` + `src/ui/BarraFluxo.tsx`): barra de etapas acima do manuscrito, com avanço/retorno; ao avançar, um snapshot da versão é registrado (estado, texto, total de problemas, horário).
- **Comparação lado a lado** (`src/workspace/diff.ts` + `src/ui/ComparacaoView.tsx`): ao avançar de etapa, o app mostra automaticamente o parágrafo a parágrafo entre a versão anterior e a atual, destacando os alterados; também acessível por “Continuar Revisão/Final”.
- **Histórico versionado**: snapshots internos (`VersaoSnapshot`) permitem retomar/comparar qualquer ponto do fluxo — persistência mínima, só o que o usuário precisa recuperar.
- **Feedback “isso ajudou?”**: cada entrada do histórico ganha 👍/👎, registrada como insumo de refinamento.
- **Verificação**: 41 testes (`bun test`), incluindo ordem de estados, snapshots/retomada e diff por parágrafo sem perda de conteúdo; `tsc --noEmit` e `bun run build` limpos.

## Como usar este plano

Este plano é uma tradução direta do objetivo e escopo já definidos no [[Cérebro do Projeto]] para a Sprint 4. Sempre que um detalhe novo for necessário, ele deve ser registrado em documento complementar e vinculado a partir do CEREBRO, em vez de adicionar comportamento fora do escopo.

> Documento complementar ao [[Cérebro do Projeto]] e ao [[Backlog v1]].
