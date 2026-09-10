# Decisões Técnicas — Sprint 0

> Wikilink: [[Decisões Técnicas]] · Sprint 0 — Fundação e Alinhamento

## Autoria inicial

- Decisões registradas aqui são hipóteses organizadas para alinhamento, não leis imutáveis.
- Todo vez que uma decisão for alterada, o [[Cérebro do Projeto]] deve ser atualizado e a razão deve ficar visível.

---

## DC-01 — O que é produto

- Decisão: o NormaReview AI é uma ferramenta de revisão acadêmica, não um conversor universal de formatos.
- Por quê: o problema central é revisão e compreensão de problemas, não apenas reformatação.
- Consequência: vamos priorizar clareza de relatório, explicações e fluxo de uso.

---

## DC-02 — Separação regra / IA

- Decisão: as regras normativas são base confiável; a IA é assistente.
- Por quê: o usuário precisa saber o que é exigência e o que é recomendação.
- Consequência: a IA não deve ser apresentada como juiz normativo.

---

## DC-03 — IA opcional

- Decisão: fluxo principal não deve depender da IA para funcionar.
- Por quê: indisponibilidade ou qualidade variável não devem bloquear o trabalho do usuário.
- Consequência: vamos tratar IA como um módulo/serviço com falhas esperadas.

---

## DC-04 — Texto como primeira classe

- Decisão: trataremos o texto/Manuscripto como peça central do domínio.
- Por quê: a revisão acadêmica gira em torno do conteúdo e não apenas de metadados.
- Consequência: toda a estrutura deve permitir importar, analisar, editar e exportar sem perda básica de conteúdo.

---

## DC-05 — Módulos de domínio claros

- Decisão: vamos organizar o projeto em módulos com fronteiras definidas.
- Por quê: facilita manutenção, teste e expansão.
- Consequência: o primeiro esforço de organização é documentado em [[Arquitetura por Módulos]].

---

## DC-06 — Testabilidade antes de sofisticação

- Decisão: investimos em testes e critérios de aceitação desde o início.
- Por quê: revisão acadêmica exige confiança e rastreabilidade.
- Consequência: algumas tarefas do backlogLista só são consideradas prontas com testes adequados.

---

## DC-07 — Garner simplicidade e evoluir

- Decisão: começar pequeno e iterar por uso real.
- Por quê: muitos detalhes serão descobertos na Sprint 1 e 2.
- Consequência: o produto deve ser útil antes de ser perfeito.

---

## DC-08 — Respostas de revisão com estrutura definida

- Decisão: cada problema relatado deve seguir um formato estruturado mínimo.
- Por quê: evita mensagens soltas e dificulta testabilidade e reutilização em UI.
- Consequência: `review` e `rules` devem produzir problemas com forma previsível.
- Exemplo mínimo de campos esperados:
  - id do problema
  - tipo ou categoria
  - severidade
  - mensagem legível
  - referência de onde было encontrado
  - ação disponível, se houver

---

## DC-09 — Versionamento leve de regras

- Decisão: o catálogo de regras deve ter versionamento interno, mesmo que simples.
- Por quê: evita que uma mudança silenciosa altere resultado sem que ninguém perceba.
- Consequência: mudança de regra pode exigir reavaliação ou aviso.
- Regra prática:
  - pequenas mudanças podem ser internas;
  - mudanças de comportamento relevante merecem critério de aceite separado.

---

## DC-10 — Limitar dependências de 오늘

- Decisão: não incorporar dependências pesadas só porque são modernas.
- Por quê: o projeto ainda está buscando forma e o custo de troca pode ser alto.
- Consequência: escolhas de ferramenta são preferidas por simplicidade de manutenção, não por modismo.
