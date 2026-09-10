# 🧠 Cérebro do Projeto — Revisor-de-Artigos / NormaReview AI

> **Objetivo do documento**: organizar sprints, normas de programação, arquitetura por módulos, estratégia de teste e decisões técnicas do site/app de revisão ABNT, tudo em um único arquivo com [[Wikilinks]] para navegação interna.

---

## 1. Identidade do Projeto

- **Nome proposto**: [[NormaReview AI]]
- **Repositório atual**: `Revisor-de-Artigos`
- **Contexto atual**: há um `README.md` e um `stitch_revisor_de_artigos_abnt/normareview_ai/DESIGN.md`.
- **Problema de negócio**: acelerar e padronizar a revisão de artigos acadêmicos segundo normas ABNT, combinando validação determinística com assistência por IA.
- **Público-alvo**: pesquisadores, estudantes de pós-graduação, revisores, repositórios institucionais.

## 2. Visão Geral da Solução

[[NormaReview AI]] é uma ferramenta de revisão acadêmica focada em:
- Verificação de conformidade com normas ABNT relevantes (ex.: formatação, citações,Referências ABNT).
- Detecção e classificação de irregularidades por nível de severidade.
- Assistência por IA para sugestões, reformulações e justificativas normativas.
- Fluxo de revisão guiado, com rascunho, comparação lado a lado e histórico de correções.

> Por enquanto o produto deve ser pensado como **um trabalho editorial + assistente de redação acadêmica**, não como apenas um "conversor de formato".

## 3. Princípios de Design e Qualidade

- [[Princípios de Design]]
  - Clareza sobre engenharia abstrata.
  - Privacidade e controle do texto acadêmico do usuário.
  - Transparência: toda sugestão deve deixar claro se é regra normativa ou inferência por IA.
  - Resiliência: falhas de IA não devem bloquear validações base.
  - Acessibilidade e legibilidade no fluxo de revisão.

## 4. Visão Técnica Rápida

- [[Stack Proposta]]
- [[Arquitetura por Módulos]]
- [[Estados e Persistência]]
- [[Testes e Qualidade]]
- [[Decisões Técnicas]]
- [[Contribuição e Colaboração]]
- [[Convenções de Projeto]]
- [[Critério de Pull Request]]
- [[Qualidade e Usabilidade]]
- [[Primeiros Entregáveis Técnicos — Sprint 0]]

## 5. Visão do Produto em Camadas

- [[Frontend]]
- [[Backend / Serviços]]
- [[IA e Regras]]
- [[Infra e Dispositivos]]

---

# [[Sprints]]

> Esta seção organiza o desenvolvimento em ciclos curtos, entregáveis mensuráveis e critérios claros de aceitação.

## 0. Sprint 0 — Fundação e Alinhamento

**Objetivo**: definir escopo mínimo, arquitetura inicial, convenções e capacidade básica de entrega.

**Entregáveis**:
- [[Lean Canvas do Projeto]] ou documento equivalente.
- [[Backlog v1]] priorizado.
- Definição de pasta/módulos base.
- [[Configuração Inicial do Projeto]].
- [[Glossário]].
- [[Guia de Contribuição]].
- [[Plan Sprint 0]].

**Critérios de sucesso**:
- Equipe entende o problema, o usuário e o MVP.
- Existe um esqueleto do projeto que compila/executa conforme o planejamento.
- As decisões de módulos estão documentadas em [[Decisões Técnicas]].

---

## 1. Sprint 1 — MVP de Revisão Manual

**Objetivo**: permitir que o usuário submeta um texto/Manuscrito, visualize problemas identificados e faça correções manuais.

**Escopo sugerido**:
- Upload ou colagem de conteúdo acadêmico.
- Renderização básica do documento/Manuscrito.
- Primeira classe de verificações (ex.: estrutura básica, problemas óbvios de formatação).
- Lista de problemas com severidade.
- Ações de correção manual.

**Critérios de aceitação**:
- O usuário consegue importar um texto e ver uma análise preliminar.
- Problemas são apresentados de forma legível e ação.
- Não há perda de conteúdo durante o fluxo básico.

---

## 2. Sprint 2 — Motor de Regras Normativas

**Objetivo**: consolidar validações determinísticas e torná-las úteis para o usuário real.

**Escopo sugerido**:
- Separação entre [[Regras ABNT / Regra Normativa]] e assistência por IA.
- Catálogo inicial de regras.
- Relatório de conformidade por seção.
- Navegação até o trecho problemas.

**Critérios de aceitação**:
- Cada regra tem mensagem, origem/norma de referência e severidade.
- O usuário entende o que está errado e onde.
- Correções manuais refletem na análise.

---

## 3. Sprint 3 — Assistência por IA

**Objetivo**: introduzir sugestões inteligentes sem confundir o usuário com regras automáticas.

**Escopo sugerido**:
- Sugestões de reescrita pontual.
- Explicação contextual da regra infringida.
- Aplicação controlada de sugestões (aceitar / editar / ignorar).

**Critérios de aceitação**:
- IA aparece como assistente, não como juiz normativo.
- O usuário pode rastrear o que foi alterado.
- O sistema permanece útil mesmo quando a IA não responde como esperado.

---

## 4. Sprint 4 — Fluxo de Revisão Guiada

**Objetivo**: transformar a ferramenta em um processo, não apenas um relatório.

**Escopo sugerido**:
- Rascunho, revisão, versão final.
- Comparação lado a lado original × sugerido.
- Histórico de revisões e estados.
- Precisão e feedback do usuário ("isso ajudou?") para refinamento.

**Critérios de aceitação**:
- O usuário pode conduzir uma revisão do início ao fim.
- Alterações são versionadas internamente.
- O fluxo reduz a carga cognitiva em vez de aumentá-la.

---

## 5. Sprint 5 — Polimento, Qualidade e Entrega

**Objetivo**: levantar a qualidade geral, usabilidade e confiabilidade antes de expansão.

**Escopo sugerido**:
- [[Testes de Usabilidade]] com tarefas reais.
- [[Testes de Qualidade]] automatizados.
- Tratamento de erros e estados vazios.
- Ajustes de UX, copy e acessibilidade.
- Documentação v1 para manutenção.

**Critérios de aceitação**:
- A ferramenta funciona de modo previsível nos caminhos principais.
- Problemas críticos têm tratamento claro.
- Novas pessoas conseguem ler [[Cérebro do Projeto]] e ententer o sistema.

---

# [[Backlog v1]]

> O Backlog v1 deve ser mantido como uma lista de tarefas vinculadas a [[Sprints]] e a decisões de [[Arquitetura por Módulos]].

**Exemplos de tipos de tarefa**:

- **Ferramenta**:
  - [ ] Importação de texto/Manuscrito.
  - [ ] Renderização do manuscripto.
  - [ ] Exportação da versão revisada.

- **Regras / Norma**:
  - [ ] Detecção de problemas estruturais básicos.
  - [ ] VerIFICação de padrões de citação/reference.
  - [ ] Classificação por severidade.

- **IA**:
  - [ ] Sugestão de reescrita contextual.
  - [ ] Explicação da alteração proposta.

- **Qualidade**:
  - [ ] [[Testes de Qualidade]] unitários/integração.
  - [ ] [[Testes de Usabilidade]] em tarefas-chave.

---

# [[Decisões Técnicas]]

> Esta seção guarda as escolhas que impactam arquitetura e manutenção. Cada decisão deve ter contexto, alternativas e consequência.

**Exemplos de decisões para documentar**:
- Como o texto/Manuscripto entra no sistema e como é armazenado.
- Como as regras ABNT são implementadas e versionadas.
- Como o Spring IA é acoplado e quando pode ser interrompido.
- Como o estado do rascunho é gerenciado.
- Como testes são organizados para evitar lentidão e manutenção cara.

---

# [[Arquitetura por Módulos]]

> O sistema deve ser organizado para que cada módulo tenha responsabilidade clara, interfaces definidas e dependências minimizadas.

**Sugestão de módulos**:

- `document`
  - Importação, representação interna e serialização de artigos/Manuscritos.
- `review`
  - Motor de análise, estado de revisão, relatório de problemas.
- `rules`
  - Catálogo de regras normativas, avaliação determinística.
- `ai`
  - Orquestração de assistência IA, prompts, controle de falhas e confiança.
- `workspace`
  - Rascunho, versões, histórico, comparação.
- `ui`
  - Componentes de análise, correção, diff, status normativo.
- `quality`
  - Teste, validação, métricas de usabilidades e qualidade.

---

# [[Stack Proposta]]

> Deve ser ajustada conforme o projeto real. Como princípio, favoreça ferramentas já familiares ao time e com boa composição de teste.

Sugestões iniciais para discutir:
- Frontend: um framework com renderização declarativa e bom suporte a estados complexos.
- Backend/Serviços: API clara separando regras determinísticas de assistentes IA.
- Persistência: mínimo no início, apenas o necessário para rascunhos e estado de revisão.
- IA: tratada como serviço com porta definida, não como dependência onipresente.

---

# [[Princípios de Design]]

## Princípios gerais
- Separar **o que a norma exige** de **o que a IA sugere**.
- Manter a interface orientada a tarefa, não a feature.
- Evitar "correções mágicas": toda mudança deve ter rastro.
- Preferir simplicidade iterável a arquiteturas geniais antes do necessário.

## Princípios de código
- Pequenos módulos com uma responsabilidade.
- Interfaces estáveis entre módulos.
- Validação próxima ao domínio, não espalhada na interface.
- Lógica de regex/parsing isolada e testável.
- Estado derivado preferido onde fizer sentido.

## Princípios de condução
- Documentar antes de dispersar.
- Definir critério de PR e qualidade desde o início.
- Organizar os primeiros entregáveis técnicos com prioridade.
- Só codar quando o escopo e o módulo estiverem claros.

---

# [[Frontend]]

**Responsabilidade**: interface de leitura, análise, correção e acompanhamento do progresso de revisão.

**Padrões sugeridos**:
- Componentes com propósito claro: importação, visualização do manuscripto, lista de problemas, inspetor de trecho, diff, ações de correção.
- Feedback imediato e semântico para status normativo.
- Estado local mínimo; preferir estado organizado por tarefa/revisão.

---

# [[Backend / Serviços]]

**Responsabilidade**: orquestração, validação, persistência básica, integração com assistência IA.

**Padrões sugeridos**:
- Endpoint/funcoes por tarefa, não por tela.
- Separação entre regras determinísticas e assistência IA.
- Respostas estruturadas: problema, localização, severidade, tipo, ação disponível.

---

# [[IA e Regras]]

**Objetivo**: a IA deve ampliar a revisão, não substituir a clareza normativa.

**Padrões sugeridos**:
- Regras ABNT são a base confiável.
- IA ocupa os espaços de julgamento, sugestão, reformulação e explicação.
- O sistema deve tolerar indisponibilidade ou qualidade variável da IA.

---

# [[Estados e Persistência]]

**Estados principais**:
- Texto/Manuscripto importado.
- Em revisão.
- Problemas identificados.
- Correções aplicadas.
- Comparativo antes/depois.
- Versão final/revisada.

**Diretriz**: só persistir o que o usuário precisa recuperar ou continuar.

---

# [[Testes e Qualidade]]

> Esta seção define como o projeto vai garantir qualidade sem virar processo burocrático.

## [[Testes de Qualidade]]
Responsáveis por verificar que o sistema funciona como código, não apenas como ideia.

## [[Qualidade e Usabilidade]]
Esta seção foi ampliada na continuação da Sprint 0 e agora guarda também o critério de como observar qualidade e usabilidade ao longo do desenvolvimento.
- Testes de regras normativas com exemplos reais.
- Testes de transformação/importação de texto/Manuscripto.
- Testes de fluxo principal: importar → analisar → corrigir → export.
- Testes de tratamento de erro e limites.

## [[Testes de Usabilidade]]
Responsáveis por verificar que o sistema é útil para o usuário real.
- Tarefas como:
  - Importar um artigo e achar um problema.
  - Avaliar sugestões.
  - Exportar revisão.
- Observar pontos de atrito, confusão e redundância.
- Usar os resultados para ajustar fluxo, copy e ordem de informações.

---

# [[Testes de Qualidade]]

> Definir aqui o que significa qualidade para o projeto e como medir.

**Propriedades importantes**:
- Corretude das regras.
- Estabilidade do fluxo principal.
- Clareza de mensagens.
- Resistência a inputs improváveis.

**Meta**: o time deve conseguir validar alterações comuns sem depender apenas de "procurar se quebrou".

---

# [[Testes de Usabilidade]]

> O foco aqui é o uso real, não a interface bonita.

**O que observar**:
- O usuário entende o que está errado?
- O usuário consegue agir sem mapear muitos passos?
- A ferramenta confunde regra com sugestão?
- O usuário sente que a revisão está avançando?

**Como conduzir**:
- Tarefas curtas e realistas.
- Poucos participantes já revelam grandes problemas.
- Anotar obstáculos, não apenas epidermis.

---

# [[Glossário]]

- **Artigo/Manuscripto**: o texto acadêmico que o usuário traz para revisão.
- **Regras ABNT**: validações baseadas em normas ou convenções acadêmicas.
- **Severidade**: indica o impacto de um problema (ex.: crítico, advertência, observação).
- **Assistente IA**: módulo que sugere ou explica, sem atuar como juiz normativo definitivo.
- **Diff**: comparação entre versão anterior e versão revisada.
- **Rascunho**: estado de trabalho em andamento.
- **Conformidade**: grau de adequação do documento às verificações aplicadas.

---

# [[Links de Referência Interna]]

- [[Sprints]]
- [[Backlog v1]]
- [[Decisões Técnicas]]
- [[Arquitetura por Módulos]]
- [[Stack Proposta]]
- [[Princípios de Design]]
- [[Frontend]]
- [[Backend / Serviços]]
- [[IA e Regras]]
- [[Estados e Persistência]]
- [[Testes e Qualidade]]
- [[Testes de Qualidade]]
- [[Testes de Usabilidade]]
- [[Glossário]]
- [[Lean Canvas do Projeto]]
- [[Contribuição e Colaboração]]
- [[Plan Sprint 0]]
- [[Convenções de Projeto]]
- [[Critério de Pull Request]]
- [[Qualidade e Usabilidade]]
- [[Primeiros Entregáveis Técnicos — Sprint 0]]
- [[Configuração Inicial do Projeto]]

---

> **Como usar este arquivo**: mantenha-o como o "cérebro" do projeto. Quando uma decisão for tomada, quando um módulo for criado ou quando um teste for definido, adicione o link e o resumo aqui, em vez de dispersar informações em vários lugares.


> 📢 Sprint realizada: [[Plan Sprint 0]]

## Status da Sprint 0

- **Estado atual**: conduzida com condução própria — o usuário pediu continuar a Sprint 0 e, depois, deixou claro que eu devo tomar a iniciativa.
- **Decisão tomada**: consolidar a documentação e o plano do projeto antes de entrar em código, mantendo a Sprint 0 focada em fundação e não em implementação dispersa.
- **Próximo desfecho**: fechar a Sprint 0 com os entregáveis já existentes e mais a documentação de condução/manutenção do projeto (convenções, critério de qualidade e usabilidade, estrutura para acompanhar evolução).

---

## Tópicos definidos nesta continuação da Sprint 0

Estes tópicos ainda estavam como “a definir” e foram organizados com conteúdo base para condução:

- [[Convenções de Projeto]] — padrões de código, commits, docs e estrutura.
- [[Critério de Pull Request]] — aceite, checklist e que tipo de mudança precisa de mais discussão.
- [[Qualidade e Usabilidade]] — como o projeto pensa qualidade, testes e avaliação de uso.
- [[Primeiros Entregáveis Técnicos — Sprint 0]] — o que a Sprint 0 vai entregar do lado técnico, com prioridade.
- [[Configuração Inicial do Projeto]] — o que precisamos montar agora para poder entregar os primeiros entregáveis com segurança.

