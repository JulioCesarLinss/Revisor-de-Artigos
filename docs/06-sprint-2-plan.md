# Plano da Sprint 2 — Motor de Regras Normativas

> Wikilink: [[Sprints]] · Sprint 2 — Motor de Regras Normativas

## Objetivo

Consolidar validações determinísticas e torná-las úteis para o usuário real.

## Escopo

- Separação entre [[Regras ABNT / Regra Normativa]] e assistência por IA.
- Catálogo inicial de regras.
- Relatório de conformidade por seção.
- Navegação até o trecho problemas.

## Critérios de aceitação

- Cada regra tem mensagem, origem/norma de referência e severidade.
- O usuário entende o que está errado e onde.
- Correções manuais refletem na análise.

## Entregáveis

- [x] Catálogo inicial de regras com id, título, severidade, mensagem e referência — definido como base do motor determinístico.
- [x] Motor de análise que aplica as regras ao documento em revisão — previsto no escopo já definido no [[Cérebro do Projeto]].
- [x] Relatório de conformidade por seção — previsto como formato legível de saída da análise.
- [x] Navegação até o trecho problema — prevista para ligar o relatório ao texto em revisão.
- [x] Critérios de aceite e testes para as regras incluídas neste ciclo — alinhados a [[Testes e Qualidade]] e ao [[Critério de Pull Request]].

## O que não está em escopo agora

- Assistência por IA.
- Fluxo de revisão guiada completo.
- Polimento final de qualidade e usabilidade.

Esses itens permanecem atribuídos a Sprints futuras, conforme o [[Cérebro do Projeto]].

## Estado

Concluída no plano, seguindo o mesmo critério documental das sprints anteriores: objetivo, escopo, critérios de aceite e entregáveis consolidados sem implementação em código (ver DC-14 em `docs/03-decisoes-tecnologias.md`).

## Critério de prontidão para encerrar a Sprint 2

Para poder seguir adiante, espera-se que:

- as regras entregues sejam legíveis e testáveis;
- o relatório ajude o usuário a localizar o problema;
- o usuário consiga distinguir regra normativa de assistência futura;
- o [[Cérebro do Projeto]] e o [[Backlog v1]] reflitam o que foi entregue.

## Estado

**Executada em código.** Catálogo normativo, relatório por seção e navegação ao trecho implementados e testados sobre a base da Sprint 1.

## Execução em código

- **Catálogo expandido para 10 regras determinísticas (R001–R010)**, cada uma com mensagem, severidade e origem/norma de referência — critério de aceite do ciclo:
  - R001 espaço antes da pontuação · R002 parágrafo longo · R003 aspas desbalanceadas · R004 sem pontuação final · R005 caixa-alta em excesso · R006 documento curto (classe da Sprint 1);
  - R007 **citação autor-data sem vírgula** (ABNT NBR 10520:2023) · R008 **citação direta longa sem página** (NBR 10520:2023) · R009 **entrada de referência sem ano** (NBR 6023:2018) · R010 **espaço duplo entre palavras** (NBR 14724:2011).
- **Relatório de conformidade por seção** (`src/review/secoes.ts`): títulos em caixa-alta (com reconhecimento de Resumo, Introdução, Metodologia, Considerações Finais, Referências etc.) delimitam seções; o painel “Conformidade por seção” resume parágrafos, problemas e severidade de cada uma.
- **Navegação até o trecho problema** (`src/ui/RevisarView.tsx`): botão “Localizar no texto”/clique na seção abre o modo revisar, com o parágrafo alvo realçado, rolagem automática e retorno à edição (Esc).
- **Correção reflete na análise**: nova ação rápida `colapsarEspacos` (R010) entra no fluxo existente aplicar → reanalisar.
- **Separação regra/IA preservada** (DC-02): todo card continua identificado como “Regra normativa”; nenhuma IA neste ciclo.
- **Verificação**: 33 testes (`bun test`, incluindo os novos para R007–R010, seções e relatório), `bun run typecheck` e `bun run build` limpos.

## Como usar este plano

Este plano é uma tradução direta do escopo já definido no [[Cérebro do Projeto]]. Sempre que um detalhe novo for necessário, ele deve ser registrado em documento complementar e vinculado a partir do CEREBRO, em vez de ser acoplado aqui sem critério.

> Documento complementar ao [[Cérebro do Projeto]] e ao [[Backlog v1]].
