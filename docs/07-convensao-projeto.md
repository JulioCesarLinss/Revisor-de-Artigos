# Convenções de Projeto — NormaReview AI

> Wikilink: [[Convenções de Projeto]] · Sprint 0 — Fundação e Alinhamento

Este documento define como o projeto deve ser escrito, organizado e conduzido. O objetivo não é burocracia: é deixar claro, para quem vem depois, o que existe de acordo e o que ainda está aberto.

---

## 1. Objeto deste documento

As convenções aqui descritas valem para o repositório atual e para os documentos do projeto. Elas são suficientes para a Sprint 0 e para o início da Sprint 1. Se algo faltar, o ideal é documentá-lo quando for usado pela primeira vez, não criar regras genéricas para tudo.

---

## 2. Princípios de organização

- **Um ponto central de recepção**: o [[Cérebro do Projeto]] é o arquivo principal de compreensão do projeto. Se uma decisão, módulo ou critério for importante, deve ter resumo e/ou link ali.
- **Documentos complementares no `docs/`**: o detalhe que não cabe no cérebro vai para `docs/`, mas sempre com referência cruzada.
- **Preferir consistência interna a perfeição externa**: enquanto o time for pequeno, o que importa é que as escolhas sejam legíveis e rastreáveis.
- **Separar propósito das implementações**: a definição do produto, a definição de módulos e a decisão técnica não devem ser misturadas sem necessidade.

---

## 3. Língua e tom

- Documentação e comentários podem ser em português, já que o público inicial do projeto é brasileiro.
- Se um termo técnico for usado, ele deve estar definido no [[Glossário]] ou ser óbvio pelo contexto.
- Evite frases longas e genéricas; prefira frases que expliquem o porquê da escolha.
- Em código, comentários devem explicar o não-óbvious, não repetir o que o código já diz.

---

## 4. Princípios de código

- Pequenos módulos com responsabilidade definida.
- Regras próximas ao domínio, não escondidas na interface.
- Lógica determinística isolada e testável.
- IA tratada como serviço com porta definida, não como dependência onipresente.
- Estado derivado quando fizer sentido, estado mutável só quando precisar.
- Evitar acoplamento global por conveniência.

Estes princípios já estão resumidos em [[Princípios de Design]] e em [[Arquitetura por Módulos]].

---

## 5. Organização de arquivos e pastas

O projeto pode ser documentação-centric por enquanto, mas deve ser organizado como se pudesse crescer para código real.

### 5.1 Separação sugerida

- `README.md` — entrada pública do projeto, curta e orientada a quem chega agora.
- `CEREBRO_PROJETO.md` — documento central com sprints, decisões, organização e links.
- `docs/` — documentos complementares temáticos.
- código futuro deve ser organizado pelo módulo, não apenas por tipo de arquivo.

### 5.2 Nomes

- Use nomes em minúsculas com hífen para arquivos e pastas, exceto quando houver convenção já estabelecida.
- Use nomes significativos e consistentes entre documentos e códigos.
- Evite misturar categorias: um arquivo deve ter um propósito claro.

---

## 6. Padrão de documentação

### 6.1 Documentos do projeto

- Cada documento importante deve ter:
  - título claro
  - objetivo
  - contexto ou decisão relevante
  - links para os outros documentos que ele depende
- Não espalhar a mesma informação em vários lugares sem indicar onde é a fonte principal.

### 6.2 Wikilinks

- Use `[[Nome Do Documento]]` quando quiser referenciar outro documento do projeto.
- Ao criar ou renomear um documento, atualize os links que apontam para ele.
- Prefira links para documentos existentes antes de criar novos.

---

## 7. Padrão de código agora e depois

A Sprint 0 ainda não define a stack final. Por isso, o padrão técnico agora é:

- Escrever antes a decisão e o escopo.
- Organizar o que já existe de forma legível.
- Deixar claro onde o código futuro deve entrar.
- Não criar um esqueleto de código vazio só por cause de estrutura; criar quando houver tarefa real.

Quando o código começar a aparecer, o esperado é:

- separação por módulos nos termos de [[Arquitetura por Módulos]]
- pequenos arquivos com uma ideia principal
- testes para o que for importante ou frágil
- mensagens de commit que expliquem o porquê

---

## 8. Padrão de commits

Um commit é mais útil quando diz o motivo, não apenas o arquivo mexido.

### 8.1 Título

- Use frases no imperativo ou forma nominal consistente, desde que clara.
- Indique o domínio quando ajudar, por exemplo:
  - `docs: consolidar convenções e critério de PR`
  - `docs: adicionar estrutura de entregáveis técnicos da Sprint 0`
  - `docs: alinhar links do Cérebro do Projeto`

### 8.2 Corpo

- Explique o porquê quando a mudança não for óbvia.
- Se relevante, mencione decisão, módulo ou risco relacionado.
- Evite commits muito grandes com motivos dispersos.

---

## 9. Onde guardar o que

Use esta divisão como guia:

- Decisões importantes → [[Decisões Técnicas]] e [[Arquitetura por Módulos]].
- Escopo, prioridade e sprint → [[Sprints]], [[Plan Sprint 0]], [[Backlog v1]].
- Termos e semântica → [[Glossário]].
- Condução e critério do projeto → [[Convenções de Projeto]], [[Critério de Pull Request]], [[Qualidade e Usabilidade]].
- Entregáveis técnicos → [[Primeiros Entregáveis Técnicos — Sprint 0]].

---

## 10. O que não é convenção rígida

Nada aqui deve ser usado como regra absoluta quando ela atrapalhar o trabalho real. Se uma convenção precisar mudar, registre a mudança no [[Cérebro do Projeto]] ou aqui, com breve justificativa.

---

## 11. Continuidade

Esta convenção deve ser revisitada quando o projeto tiver:

- uma stack definida
- código ativo e não só documentos
- mais de uma pessoa contribuindo com frequência

Nesse ponto, o documento pode ganhar detalhes mais técnicos, mas só a partir do uso real.

---

> Documento complementar ao [[Cérebro do Projeto]].
