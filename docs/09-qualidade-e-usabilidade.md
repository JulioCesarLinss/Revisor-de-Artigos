# Qualidade e Usabilidade — NormaReview AI

> Wikilink: [[Qualidade e Usabilidade]] · Sprint 0 — Fundação e Alinhamento

Este documento define como o projeto deve pensar qualidade e usabilidade durante o desenvolvimento. Ele não é um relatório final, mas um guia de como observar, decidir e melhorar.

---

## 1. Objetivo

A qualidade aqui é tanto comportamento quanto compreensão. O projeto busca:

- que o sistema funcione de forma previsível nos caminhos principais
- que as regras sejam corretas, legíveis e testáveis
- que a interface ajude o usuário a entender o que está acontecendo e o que fazer
- que a IA seja apresentada como assistente, sem confundir quem julga o que

---

## 2. O que é qualidade neste projeto

- **Corretude**: regras e análises devem responder ao problema real, não apenas gerar saída bonita.
- **Previsibilidade**: o usuário deve conseguir antecipar o que vai acontecer ao importar, analisar e editar.
- **Legibilidade**: problemas, mensagens e ações devem ser compreensíveis sem esforço desnecessário.
- **Segurança da informação**: não perder conteúdo nem corromper o rascunho nas edições.
- **Transparência**: deixa-se claro o que é exigência normativa e o que é sugestão assistida.
- **Resiliência**: o fluxo principal deve continuar útil mesmo quando algo falhar ou estiver indisponível.

---

## 3. Como pensar qualidade por módulo

### 3.1 Regras

- Uma regra deve ser testável isoladamente.
- Uma regra deve ter mensagem clara, severidade definida e, se relevante, referência ou justificativa.
- Uma regra não deve ser uma caixa-preta que apenas “aparece” no relatório.

### 3.2 Análise/review

- A análise deve estruturar resultados de forma previsível.
- O sistema deve saber onde um problema aparece e o que ele significa.
- Deve ser possível diferenciar tipos e severidades sem depender somente de texto solto.

### 3.3 Interface

- A interface deve comunicar o estado da revisão de forma semântica.
- Deve haver diferença visual entre dado problemático, sugestão e ação disponível.
- Deve haver estados vazios e de erro que ajudem em vez de só mostrar vazio.

### 3.4 IA

- A IA deve ser opcional para o fluxo principal.
- Quando a IA falhar ou estiver lenta, o usuário não deve ser obrigado a parar a revisão.
- A sugestão da IA deve deixar rastro e não ser apresentada como decisão normativa definitiva.

---

## 4. Tratamento de erros e estados vazios

> Esta seção está sendo consolidada agora na continuação da Sprint 0 e pode ser mais detalhada depois.

- Estado vazio: mostrar o que o usuário pode fazer a seguir, não só dizer “não tem nada”.
- Entrada inválida ou incompatível: avisar de forma compreensível e indicar como corrigir, quando possível.
- Falha de serviço ou indisponibilidade: tratar de forma que o usuário entenda que algo não está disponível, sem ocultar ou fingir que a análise foi completa.
- Perda de rascunho ou estado: deve ser tratada como grave, não como detalhe.

---

## 5. Critérios de usabilidade

A usabilidade não deve ser medida só pela estética. Para este projeto, o que importa:

- O usuário entende o que foi detectado?
- O usuário sabe onde está o problema?
- O usuário consegue agir sem mapear muitos passos?
- O usuário consegue distinguir regra de sugestão?
- O usuário sente que a revisão está avançando?

Se a ferramenta for bonita, mas confusa, ela não atende o objetivo do produto.

---

## 6. Como conduzir testes de usabilidade

- Use tarefas reais e curtas, como:
  - importar um texto
  - encontrar um problema
  - entender o que fazer com ele
  - avaliar uma sugestão
  - editar o texto
  - acompanhar o que mudou
- Observe pontos de atrito, freadas, confusão e redundância.
- Anote os obstáculos reais, não só impressões de “parece bom”.
- Poucos participantes já costumam revelar problemas grandes.

---

## 7. Como conduzir testes de qualidade

- Comece com os casos mais importantes e mais propensos a quebrar.
- Para regras, use exemplos reais e variantes plausíveis.
- Para fluxo principal, valide por exemplo: importar, analisar, editar, verificar se o estado reflete a mudança.
- Inclua casos de limite e erro, não só o caminho feliz.
- Mantenha os testes simples o suficiente para que sejam mantidos.

---

## 8. O que fazer antes de entregar um novo comportamento importante

- Definir o que “pronto” significa para aquela tarefa.
- Observar se a mudança afeta regras, apresentação ou estado.
- Verificar se a mudança mistura responsabilidades ou acopla coisas que deveriam ficar separadas.
- Atualizar a documentação quando o usuário precisar saber algo novo.
- Se a mudança for importante, deixar visível o risco e o critério de aceite.

---

## 9. Sinais de que a qualidade está indo mal

- Regras que ninguém consegue explicar rapidamente.
- Relatórios grandes que o usuário ignora.
- Mensagens que não dizem ao usuário o que fazer.
- IA sendo tratada como juiz normativo.
- O estado do rascunho se torna difícil de seguir.
- Testes que existem, mas não cobrem o que mais importa.

---

## 10. Como usar este documento

Use este documento como base para decisões de teste, revisão e melhoria. Quando vir um problema real de qualidade ou usabilidade, registre-o, sugira ajuste e, se relevante, conecte-o a alguma tarefa ou sprint.

---

> Documento complementar ao [[Cérebro do Projeto]] e ao [[Testes e Qualidade]].
