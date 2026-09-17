# Plano da Sprint 3 — Assistência por IA

> Wikilink: [[Sprints]] · Sprint 3 — Assistência por IA

## Objetivo

Introduzir sugestões inteligentes sem confundir o usuário com regras automáticas.

## Escopo

- Sugestões de reescrita pontual.
- Explicação contextual da regra infringida.
- Aplicação controlada de sugestões (aceitar / editar / ignorar).

## Critérios de aceitação

- IA aparece como assistente, não como juiz normativo.
- O usuário pode rastrear o que foi alterado.
- O sistema permanece útil mesmo quando a IA não responde como esperado.

## Entregáveis

- [x] Sugestão pontual de reescrita por assistência IA — definida como complemento, nunca substituto das regras (ver DC-02 e DC-13).
- [x] Explicação associada à regra infringida, quando aplicável — prevista conforme a separação regra/IA do [[Cérebro do Projeto]].
- [x] Forma controlada de aceitar, editar ou ignorar a sugestão — decisão final sempre com o usuário.
- [x] Rastro do que foi alterado por sugestão IA, em contraste com a correção manual — requisito de transparência já definido.
- [x] Critérios de aceite e tratamento de falhas/indisponibilidade para o uso assistido — alinhados a DC-03.

## O que não está em escopo agora

- Substituir as regras normativas determinísticas pelo comportamento da IA.
- Processar recomendações em larga escala sem controle claro.
- Transformar a IA no centro obrigatório do fluxo principal.

Esses limites permanecem conforme o [[Cérebro do Projeto]].

## Estado

Concluída no plano, seguindo o mesmo critério documental das sprints anteriores: objetivo, escopo, critérios de aceite e entregáveis consolidados sem implementação em código (ver DC-14 em `docs/03-decisoes-tecnologias.md`).

## Critério de prontidão para encerrar a Sprint 3

Para poder seguir adiante, espera-se que:

- o usuário entenda que a sugestão é assistência, não imposição normativa;
- a origem da sugestão e o rastro da alteração sejam distinguíveis;
- o fluxo principal continue útil mesmo quando a assistência IA não estiver disponível ou não for boa o suficiente;
- o [[Cérebro do Projeto]] e o [[Backlog v1]] reflitam o que foi entregue.

## Estado

**Executada em código.** Assistência IA implementada como sugestão controlada com explicação e rastro, sobre a base das Sprints 1 e 2.

## Execução em código

- **Módulo `ai`** (`src/ai/`): cliente para endpoint compatível OpenAI (bring-your-own-key, sem SDK — DC-10), prompt controlado que proíbe decisão normativa, timeout de 20 s e falha sempre tratada como resultado legível — nunca quebra o fluxo (DC-03).
- **Sugestão pontual com explicação**: cada problema do catálogo ganha o botão “Sugerir com IA”; a resposta traz trecho reescrito + justificativa, associada à regra (R0xx) quando aplicável.
- **Aplicação controlada** (`src/ui/PainelSugestao.tsx`): aceitar / editar antes / ignorar, com diff Atual × Sugerido e nota explícita de que a decisão editorial é do autor (DC-02).
- **Rastro distinguível** (`src/workspace/historico.ts` + painel): cada alteração registrada com origem “Correção manual” ou “Sugestão IA aceita”, parágrafo e horário (DC-13).
- **IA opcional**: sem chave configurada, o fluxo de regras/relatório/correções continua 100% funcional; a chave é fornecida pelo usuário na UI (padrão BYO-key) ou via `VITE_OPENAI_API_KEY`.
- **Verificação**: 36 testes (`bun test`), incluindo aplicação de sugestão preservando demais parágrafos e rastro manual vs IA; `tsc --noEmit` e `bun run build` limpos.

## Provedor de IA

- Recomendado: API da OpenAI compatível (`api.openai.com/v1`, modelo default `gpt-4o-mini`); qualquer endpoint compatível funciona via campo de URL base.
- Chave: fornecida pelo usuário por sessão na UI; em produção, definir `VITE_OPENAI_API_KEY` (ou migrar a chamada para um backend — decisão futura, fora do escopo desta sprint).

## Como usar este plano

Este plano é uma tradução direta do objetivo e escopo já definidos no [[Cérebro do Projeto]] para a Sprint 3. Sempre que um detalhe novo for necessário, ele deve ser registrado em documento complementar e vinculado a partir do CEREBRO, em vez de adicionar comportamento fora do escopo.

> Documento complementar ao [[Cérebro do Projeto]] e ao [[Backlog v1]].
