# Guia de Contribuição — NormaReview AI

> Wikilink: [[Contribuição e Colaboração]] · Sprint 0 — Fundação e Alinhamento

## 1. Objetivo

Este guia ajuda qualquer pessoa a contribuir com clareza, sem depender de memorizar favores. Ele não é burocracia: é como evitamos que o projeto vire caos quando mais gente participar.

## 2. Como contribuir

- Leia o [[Cérebro do Projeto]] antes de grandes mudanças.
- Use o [[Backlog v1]] para entender o que está sendo priorizado.
- Para mudanças pequenas, abra uma discussão ou um Pull Request direto com contexto.
- Para mudanças grandes, abra uma proposta antes de codificar.

## 3. Como abrir uma issue

Ao abrir uma issue, ajude quem vai ler depois:

- Qual problema real está sendo resolvido.
- Qual a urgência ou dependência.
- Se há decisão já tomada.
- O que “pronto” significa para essa tarefa.

Um exemplo rápido de título útil:
- “Permitir filtro por severidade na lista de problemas”
- “Regra X sem mensagem compreensível para o usuário”
- “Falta critério de aceite na tarefa Y”

Evite títulos como “melhorar revisão” sem explicar o que isso significa.

## 4. Onde guardar o que

- Decisões técnicas → [[Decisões Técnicas]] e [[Arquitetura por Módulos]].
- Modificações de produto/escopo → [[Sprints]], [[Backlog v1]], [[Lean Canvas do Projeto]].
- Termos e categoria semântica → [[Glossário]].

## 5. Tipos de contribuição

| Tipo | O que geralmente se espera |
|---|---|
| Correção pequena | Altera uma mensagem, um detalhe, um label ou um erro local. |
| Tarefa nova | Entrega uma funcionalidade com critério definido. |
| Regra/norma | Altera ou adiciona verificação, com teste ou critério. |
| UX/legibilidade | Tenta reduzir confusão ou fricção sem esconder o significado da mudança. |
| Documentação | Atualiza o [[Cérebro do Projeto]], glossário, decisões ou guia de contribuição. |

## 6. Como escolher a próxima tarefa

- Se o objetivo é começar rápido, escolha uma tarefa pequena e bem definida.
- Se o objetivo é reduzir risco, escolha uma tarefa que afete o fluxo principal ou o catálogo de regras.
- Evite começar por mudanças que exigem decisão não resolvida.
- Se o trabalho toca em mais de um módulo, deixe claro quais são as fronteiras.

## 7. Critérios para aceite de Pull Request

- A mudança tem um propósito claro.
- A mudança não deixa dívida sem avisar.
- Caminhos principais continuam funcionando.
- Se a mudança realmente altera comportamento, há critérios de aceite ou teste associados.
- A documentação relevante foi atualizada.

## 8. Checklist do PR

- [ ] Descrevemos o problema e a solução.
- [ ] A mudança está nos módulos certos.
- [ ] Não quebramos o fluxo principal.
- [ ] Testamos o caso comum e o caso de erro mais provável.
- [ ] Se o usuário precisa saber algo novo, atualizamos a documentação.

## 9. Checklist de prontidão do contribuidor

Antes de abrir o PR, vale revisar rapidamente:

- [ ] Entendi qual problema está sendo resolvido.
- [ ] Sei onde a mudança deve viver.
- [ ] Sei o que pode quebrar e o que não posso quebrar.
- [ ] Se a mudança afeta comportamento do usuário, consigo explicar em uma frase.
- [ ] Se a mudança é sobre regras, sei por que ela não é apenas uma opinião.

## 10. Boas práticas de código

- Pequenas mudanças > grandes reescritas sem necessidade.
- Separe regra de apresentação.
- Teste comportamentos importantes isoladamente.
- Deixe o código legível para quem vem depois.

---

> Próximos passos: essa página deve crescer junto com o time. Por enquanto, o foco é clareza e continuidade.
