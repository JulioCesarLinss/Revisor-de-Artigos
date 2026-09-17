# Plano da Sprint 5 — Polimento, Qualidade e Entrega

> Wikilink: [[Sprints]] · Sprint 5 — Polimento, Qualidade e Entrega

## Objetivo

Levantar a qualidade geral, usabilidade e confiabilidade antes de expansão.

## Escopo

- [[Testes de Usabilidade]] com tarefas reais.
- [[Testes de Qualidade]] automatizados.
- Tratamento de erros e estados vazios.
- Ajustes de UX, copy e acessibilidade.
- Documentação v1 para manutenção.

## Critérios de aceitação

- A ferramenta funciona de modo previsível nos caminhos principais.
- Problemas críticos têm tratamento claro.
- Novas pessoas conseguem ler o [[Cérebro do Projeto]] e entender o sistema.

## Entregáveis

- [x] Testes de usabilidade com tarefas reais previstos conforme [[Testes de Usabilidade]].
- [x] Testes de qualidade automatizados previstos conforme [[Testes de Qualidade]].
- [x] Tratamento de erros e estados vazios definido como requisito dos caminhos principais.
- [x] Ajustes de UX, copy e acessibilidade previstos a partir do uso real.
- [x] Documentação v1 de manutenção incluída como entregável de fechamento do ciclo.

## O que não está em escopo agora

- Expansão de escopo do produto além do definido no [[Cérebro do Projeto]].
- Novas sprints de funcionalidade antes de estabilizar qualidade.
- Escolha final de stack, deploy e operação, que podem ser decididas durante a execução em código.

## Estado

Concluída no plano, seguindo o mesmo critério documental das sprints anteriores: objetivo, escopo, critérios de aceite e entregáveis consolidados sem implementação em código. Com este ciclo, todas as sprints definidas no [[Cérebro do Projeto]] (0 a 5) estão encerradas no nível documental (ver DC-14 em `docs/03-decisoes-tecnologias.md`).

## Critério de prontidão para encerrar a Sprint 5

Para poder considerar o ciclo fechado, espera-se que:

- os caminhos principais se comportem de modo previsível;
- problemas críticos tenham tratamento claro;
- novas pessoas consigam ler o [[Cérebro do Projeto]] e entender o sistema;
- o [[Backlog v1]] reflita o que foi entregue.

## Estado

**Executada em código.** Ciclo de fechamento: qualidade automatizada dos caminhos principais, tratamento de erros/limites, acessibilidade e documentação v1.

## Execução em código

- **Testes automatizados dos caminhos principais** (`src/quality/caminhosPrincipais.test.ts`): cinco fluxos reais de ponta a ponta — importar → analisar → corrigir → reanalisar → avançar fluxo; sugestão IA aceita com rastro; fluxo 100% funcional sem IA (DC-03); falha de rede da IA sem quebrar; documento realista de 30 parágrafos com seções.
- **Tratamento de erros e limites** (`src/quality/limites.test.ts`): texto vazio/whitespace, 500 parágrafos, parágrafo de 50 mil caracteres, emojis/unicode composto, mojibake, índices de correção inválidos, separadores não convencionais — nada trava, nada perde conteúdo.
- **Acessibilidade** (`src/index.css`, `src/App.tsx`): skip link para o manuscrito, `:focus-visible` global, respeito a `prefers-reduced-motion`, classe `sr-only`, rótulos ARIA no relatório por seção e histórico.
- **Documentação v1**: `docs/11-entrega-v1.md` — arquitetura implementada, comandos de operação, contratos estáveis e o que fica para depois.
- **Verificação final**: 53 testes, `tsc --noEmit` estrito limpo, `bun run build` de produção OK.

## Como usar este plano

Este plano é uma tradução direta do objetivo e escopo já definidos no [[Cérebro do Projeto]] para a Sprint 5. Sempre que um detalhe novo for necessário, ele deve ser registrado em documento complementar e vinculado a partir do CEREBRO, em vez de adicionar comportamento fora do escopo.

> Documento complementar ao [[Cérebro do Projeto]] e ao [[Backlog v1]].
