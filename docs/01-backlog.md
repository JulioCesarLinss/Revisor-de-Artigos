# Backlog v1 — NormaReview AI

> Wikilink: [[Backlog v1]] · Sprint 0 — Fundação e Alinhamento

## Visão geral

Este backlogLista tarefas pendentes para a próxima versão do produto. Foi dividido por domínio para facilitar a leitura e a atribuição, mas cada tarefa deve ser estimada e priorizada em Sprints.

## Priorização inicial

- **P0**: fluxo principal que torna o produto útil na prática.
- **P1**: melhorias que aumentam usabilidade, confiança ou qualidade.
- **P2**: utilidades úteis, mas não bloqueantes para o MVP.

---

## 1. Documento e importação

- [x] **P0** — Permitir colagem/importação de texto acadêmico/Manuscripto. *(entregue na Sprint 1)*
- [x] **P0** — Armazenar o texto importado como rascunho enquanto a sessão dura. *(entregue na Sprint 1)*
- [ ] **P1** — Suportar casos básicos de entrada problemática (texto longo, caracteres atípicos, misturas de encoding).
- [ ] **P2** — Permitir reimportação ou substituição do documento em andamento.

**Risco observado**: depender de um único formato de entrada pode limitar adoção real. Por enquanto, o foco é suficiente para o MVP.

---

## 2. Motor de revisão

- [x] **P0** — Listar problemas encontrados com mensagem, localização e severidade. *(entregue na Sprint 1)*
- [x] **P0** — Separar problemas críticos de advertências e observações. *(entregue na Sprint 1)*
- [ ] **P1** — Agrupar problemas por seção ou tipo quando fizer sentido.
- [ ] **P1** — Permitir focar/filtrar problemas por severidade ou categoria.
- [ ] **P2** — Mostrar resumo de conformidade geral.

**Risco observado**: se o relatório for grande demais, o usuário perde a visão do todo. Vamos priorizar legibilidade antes de quantidade.

---

## 3. Regras normativas

- [ ] **P0** — Definir catálogo inicial de regras claras e testáveis.
- [ ] **P0** — Cada regra deve ter: id, título, severidade, mensagem e origem de referência.
- [ ] **P1** — Evitar “caixa-preta” de regras: o usuário deve entender o porquê.
- [x] **P2** — Permitir expansão do catálogo sem reescrever fluxos principais. *(6 → 10 regras sem mudar motor/UI)*

**Risco observado**: regras muito específicas cedo podem gerar falsos problemas ou dívida de especialização. O catálogo inicial deve ser pequeno e útil.

### 3.1 Sprint 2 — Catálogo inicial e relatório

- [x] **P0** — Entregar catálogo inicial de regras com id, título, severidade, mensagem e referência. *(10 regras R001–R010, com NBR 10520/6023/14724)*
- [x] **P0** — Aplicar as regras ao documento e emitir lista de problemas estruturada. *(motor existente, expandido)*
- [x] **P0** — Relatório de conformidade por seção. *(painel "Conformidade por seção")*
- [x] **P0** — Navegação até o trecho problema. *(modo revisar com realce e rolagem)*
- [x] **P1** — Diferenciar visual/semânticamente problemas normativos de futuras sugestões IA. *(chip "Regra normativa")*
- [x] **P1** — Garantir que correções manuais reflitam na análise. *(reanálise imediata + teste)*

**Nota de escopo**: este ciclo atende diretamente o objetivo da [[Sprint 2 — Motor de Regras Normativas]], sem adicionar nada além do que já está definido no [[Cérebro do Projeto]].

---

## 4. Edição e fluxo de revisão

- [x] **P0** — Permitir correção manual do texto/Manuscripto. *(entregue na Sprint 1)*
- [x] **P0** — Manter rascunho atualizado após edições. *(entregue na Sprint 1)*
- [ ] **P1** — Comparar o texto original com o texto revisado em pontos relevantes.
- [ ] **P1** — Registrar as ações tomadas durante a sessão pelo menos internamente.
- [ ] **P2** — Exportar ou finalizar revisão de forma simples.

**Risco observado**: perder o rastro do que foi alterado reduz confiança. Mesmo um registro simples já ajuda.

### 4.1 Sprint 4 — Fluxo de revisão guiada

- [x] **P0** — Conduzir revisão do rascunho até a versão final. *(barra de etapas com snapshots)*
- [x] **P0** — Comparação lado a lado original × sugerido. *(ComparacaoView por parágrafo)*
- [x] **P1** — Histórico de revisões e estados versionado internamente. *(VersaoSnapshot + retomada)*
- [x] **P2** — Feedback do usuário ("isso ajudou?") para refinamento do fluxo. *(👍/👎 no histórico)*

**Nota de escopo**: este ciclo atende diretamente o objetivo da [[Sprint 4 — Fluxo de Revisão Guiada]], sem adicionar nada além do que já está definido no [[Cérebro do Projeto]].

---

## 5. Assistência por IA

- [x] **P1** — Sugerir mudanças pontuais com explicação associada. *(entregue na Sprint 3)*
- [x] **P1** — Permitir aceitar, editar ou ignorar sugestão. *(entregue na Sprint 3)*
- [x] **P2** — Sinalizar claramente quando a sugestão é apenas uma recomendação. *(entregue na Sprint 3)*
- [x] **P2** — Evitar que indisponibilidade ou qualidade variável da IA quebre o fluxo principal. *(entregue na Sprint 3)*

**Risco observado**: a IA pode parecer útil e ainda assim gerar confiança indevida. O sistema deve deixar claro que a decisão editorial continua com o usuário.

### 5.1 Sprint 3 — Sugestões assistidas e rastro

- [x] **P1** — Entregar sugestão de reescrita pontual por assistência IA. *(botão “Sugerir com IA” por problema)*
- [x] **P1** — Explicar o contexto da regra infringida quando a sugestão estiver associada a ela. *(explicação + regra no painel)*
- [x] **P1** — Oferecer aceitar / editar / ignorar de forma controlada. *(diff Atual × Sugerido)*
- [x] **P1** — Registrar o que foi alterado por sugestão IA, de forma distinguível da correção manual. *(histórico com origem)*
- [x] **P2** — Tratar indisponibilidade e qualidade variável sem quebrar o fluxo principal. *(timeout, erro legível, fluxo sem IA intacto)*

**Nota de escopo**: este ciclo atende diretamente o objetivo da [[Sprint 3 — Assistência por IA]], sem adicionar nada além do que já está definido no [[Cérebro do Projeto]].

---

## 6. Interface e usabilidade

- [x] **P0** — Layout legível e focado na tarefa de revisão. *(entregue na Sprint 1)*
- [x] **P0** — Feedback claro ao importar, analisar e corrigir. *(entregue na Sprint 1)*
- [ ] **P1** — Estados vazios e de erro com orientação útil.
- [ ] **P1** — Clareza visual entre problema normativo e sugestão IA.
- [ ] **P2** — Redução de fricção para tarefas repetitivas.

**Risco observado**: uma interface polida, mas confusa, vale menos que uma interface simples e compreensível.

---

## 7. Qualidade, testes e manutenção

- [x] **P0** — Definir casos de teste para as regras do catálogo inicial. *(22 testes entregues na Sprint 1)*
- [ ] **P0** — Validar os caminhos principais antes de entregar para uso real.
- [ ] **P1** — Incluir critérios de aceitação em tarefas importantes.
- [ ] **P1** — Manter o [[Cérebro do Projeto]] atualizado a cada decisão relevante.
- [ ] **P2** — Adicionar testes de usabilidade nos fluxos críticos.

**Risco observado**: sem testes, regras e fluxos tendem a degenerar rápido. Começar com casos simples e reais é mais importante do que ter muitos testes complexos.

### 7.1 Sprint 5 — Polimento, qualidade e entrega

- [ ] **P0** — Testes de qualidade automatizados nos caminhos principais.
- [ ] **P1** — Testes de usabilidade com tarefas reais.
- [ ] **P1** — Tratamento de erros e estados vazios com orientação útil.
- [ ] **P1** — Ajustes de UX, copy e acessibilidade.
- [ ] **P2** — Documentação v1 para manutenção.

**Nota de escopo**: este ciclo atende diretamente o objetivo da [[Sprint 5 — Polimento, Qualidade e Entrega]], sem adicionar nada além do que já está definido no [[Cérebro do Projeto]].

---

## Critérios de prontidão para a Sprint 1

Para poder executar a Sprint 1 com clareza, espera-se que existam definidos:

- Um documento de problema e público-alvo: [[Lean Canvas do Projeto]].
- Um glossário compartilhável: [[Glossário]].
- Decisões básicas registradas: [[Decisões Técnicas]].
- Um esqueleto de módulos aceito pela equipe: [[Arquitetura por Módulos]].

## Critérios de prontidão para a Sprint 2

Para poder executar a Sprint 2 com clareza, espera-se que existam definidos:

- Um catálogo de regras com mensagem, severidade e referência.
- Um motor de análise que aplique as regras ao documento.
- Um relatório de conformidade por seção.
- Navegação até o trecho problema.

---

## Próximo passo

A Sprint 4 está executada em código (fluxo guiado com comparação e feedback). A última sprint é a **Sprint 5 — Polimento, Qualidade e Entrega**: usabilidade, testes automatizados dos caminhos principais, tratamento de erros e documentação v1 (seção 7.1).
