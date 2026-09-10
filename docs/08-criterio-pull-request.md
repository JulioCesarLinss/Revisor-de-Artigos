# Critério de Pull Request — NormaReview AI

> Wikilink: [[Critério de Pull Request]] · Sprint 0 — Fundação e Alinhamento

Este documento define quando um Pull Request é aceito, o que o mantenedor deve olhar antes de aprovar e como decidir quando uma mudança precisa de mais discussão.

---

## 1. Objetivo

O critério serve para:

- reduzir trabalho binário desnecessário
- deixar claro o que queremos em uma contribuição
- evitar aprovações que criam dívida ou confusão
- dar um caminho previsível para quem contribui e para quem revisar

---

## 2. O que um PR deve ser

- **Um propósito claro**: o PR deve resolver uma coisa principal, não dez ao mesmo tempo.
- **Escopo coerente com o módulo ou documento**: a mudança deve estar onde faz sentido segundo [[Arquitetura por Módulos]] ou as convenções do projeto.
- **Justificada quando mudar comportamento**: se o PR altera algo que afeta o usuário ou o resultado da revisão, deve conter o porquê e, de preferência, um critério de aceite.
- **Com risco visível**: se a mudança pode quebrar um caminho principal, isso deve ficar claro antes da aceitação.

---

## 3. Tipos de PR

### 3.1 Correção pequena

- Alteração isolada de texto, mensagem, detalhe de interface, link ou similar.
- Geralmente pode ser Reviewed rapidamente.
- O foco é corrigir sem introduzir mudança de comportamento não pretendida.

### 3.2 Tarefa nova ou funcionalidade

- Adiciona algo que o sistema ou a documentação não tinha.
- Deve ter:
  - o que está sendo entregue
  - por que isso importa
  - como saber que está pronto
- Se o escopo for grande, deve ser dividido ou proposto antes.

### 3.3 Mudança de regra, norma ou lógica de revisão

- Pode alterar o resultado da análise.
- Deve ser tratado com mais cuidado:
  - o que mudou
  - o que isso significa para o usuário
  - se precisa de critério ou teste
- Em especial, evita-se misturar regra com sugestão IA sem deixar claro a separação.

### 3.4 Documentação ou organização

- Atualiza o [[Cérebro do Projeto]], glossário, decisões, convenções, plano ou similar.
- Deve ser útil e não apenas reorganizar por reorganizar.
- Se for criar um novo documento, ele deve ter um propósito claro e, de preferência, ser referenciado de algum lugar relevante.

---

## 4. O que o revisor deve checar

- A mudança tem um propósito claro?
- Ela está no lugar certo?
- Ela quebra ou prejudica qualquer caminho principal?
- Se muda comportamento, existe explicação ou critério?
- Se precisa de teste, ele está contemplado ou a falta está justificada?
- A documentação relevante foi atualizada?

---

## 5. Checklist básico do PR

- [ ] O problema ou objetivo está explícito.
- [ ] A mudança está nos módulos/documentos certos.
- [ ] O escopo não está misturando coisas muito diferentes.
- [ ] Se a mudança altera comportamento, existe critério ou explicação.
- [ ] Se a mudança muda regra ou lógica de revisão, o impacto ficou visível.
- [ ] Caminhos principais prováveis não foram prejudicados.
- [ ] Testes ou critérios necessários estão contemplados quando exigidos.
- [ ] Documentação relevante foi atualizada.
- [ ] O PR está num tamanho que permite revisão real.

---

## 6. Quando um PR deve ser discutido antes de codar

Abra discussão antes de codar quando:

- a mudança é ampla
- o escopo não está claro
- a mudança pode definir ou mudar um comportamento importante
- o PR toca mais de um módulo e as fronteiras não são óbvias
- não há consenso sobre como algo deve funcionar

Nesse caso, o ideal é primeiro alinhar no [[Cérebro do Projeto]], no [[Backlog v1]] ou em uma issue, e só depois codar.

---

## 7. Critério de aceite para documentação

Para documentação, consideramos aceito quando:

- o texto tem um propósito claro
- a informação está coerente com o resto do projeto
- links e referências estão coerentes
- não foi introduzida confusão desnecessária

---

## 8. Critério de aceite para código

Para código, consideramos aceito quando:

- a mudança resolve o problema proposto
- ela está organizada nos módulos adequados
- o que for importante ou frágil tem teste ou critério visível
- o resultado não prejudica os fluxos principais esperados
- a decisão, quando relevante, fica documentada

---

## 9. O que não queremos ver

- PRs enormes com motivos dispersos.
- Mudanças de comportamento sem explicação.
- Regras misturadas com apresentação sem necessidade.
- Dívida introduzida sem aviso.
- Reorganização sem benefício claro.

---

## 10. Como usar este critério

Use este documento como guia de revisão, não como burocracia. Se um PR for pequeno e seguro, a revisão deve ser rápida. Se for importante, o critério deve ajudar a deixar o que é obrigatório explícito.

---

> Documento complementar ao [[Cérebro do Projeto]] e ao [[Guia de Contribuição]].
