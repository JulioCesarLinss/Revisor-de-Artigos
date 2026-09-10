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

- [ ] **P0** — Permitir colagem/importação de texto acadêmico/Manuscripto.
- [ ] **P0** — Armazenar o texto importado como rascunho enquanto a sessão dura.
- [ ] **P1** — Suportar casos básicos de entrada problemática (texto longo, caracteres atípicos, misturas de encoding).
- [ ] **P2** — Permitir reimportação ou substituição do documento em andamento.

**Risco observado**: depender de um único formato de entrada pode limitar adoção real. Por enquanto, o foco é suficiente para o MVP.

---

## 2. Motor de revisão

- [ ] **P0** — Listar problemas encontrados com mensagem, localização e severidade.
- [ ] **P0** — Separar problemas críticos de advertências e observações.
- [ ] **P1** — Agrupar problemas por seção ou tipo quando fizer sentido.
- [ ] **P1** — Permitir focar/filtrar problemas por severidade ou categoria.
- [ ] **P2** — Mostrar resumo de conformidade geral.

**Risco observado**: se o relatório for grande demais, o usuário perde a visão do todo. Vamos priorizar legibilidade antes de quantidade.

---

## 3. Regras normativas

- [ ] **P0** — Definir catálogo inicial de regras claras e testáveis.
- [ ] **P0** — Cada regra deve ter: id, título, severidade, mensagem e origem de referência.
- [ ] **P1** — Evitar “caixa-preta” de regras: o usuário deve entender o porquê.
- [ ] **P2** — Permitir expansão do catálogo sem reescrever fluxos principais.

**Risco observado**: regras muito específicas cedo podem gerar falsos problemas ou dívida de especialização. O catálogo inicial deve ser pequeno e útil.

---

## 4. Edição e fluxo de revisão

- [ ] **P0** — Permitir correção manual do texto/Manuscripto.
- [ ] **P0** — Manter rascunho atualizado após edições.
- [ ] **P1** — Comparar o texto original com o texto revisado em pontos relevantes.
- [ ] **P1** — Registrar as ações tomadas durante a sessão pelo menos internamente.
- [ ] **P2** — Exportar ou finalizar revisão de forma simples.

**Risco observado**: perder o rastro do que foi alterado reduz confiança. Mesmo um registro simples já ajuda.

---

## 5. Assistência por IA

- [ ] **P1** — Sugerir mudanças pontuais com explicação associada.
- [ ] **P1** — Permitir aceitar, editar ou ignorar sugestão.
- [ ] **P2** — Sinalizar claramente quando a sugestão é apenas uma recomendação.
- [ ] **P2** — Evitar que indisponibilidade ou qualidade variável da IA quebre o fluxo principal.

**Risco observado**: a IA pode parecer útil e ainda assim gerar confiança indevida. O sistema deve deixar claro que a decisão editorial continua com o usuário.

---

## 6. Interface e usabilidade

- [ ] **P0** — Layout legível e focado na tarefa de revisão.
- [ ] **P0** — Feedback claro ao importar, analisar e corrigir.
- [ ] **P1** — Estados vazios e de erro com orientação útil.
- [ ] **P1** — Clareza visual entre problema normativo e sugestão IA.
- [ ] **P2** — Redução de fricção para tarefas repetitivas.

**Risco observado**: uma interface polida, mas confusa, vale menos que uma interface simples e compreensível.

---

## 7. Qualidade, testes e manutenção

- [ ] **P0** — Definir casos de teste para as regras do catálogo inicial.
- [ ] **P0** — Validar os caminhos principais antes de entregar para uso real.
- [ ] **P1** — Incluir critérios de aceitação em tarefas importantes.
- [ ] **P1** — Manter o [[Cérebro do Projeto]] atualizado a cada decisão relevante.
- [ ] **P2** — Adicionar testes de usabilidade nos fluxos críticos.

**Risco observado**: sem testes, regras e fluxos tendem a degenerar rápido. Começar com casos simples e reais é mais importante do que ter muitos testes complexos.

---

## Critérios de prontidão para a Sprint 1

Para poder executar a Sprint 1 com clareza, espera-se que existam definidos:

- Um documento de problema e público-alvo: [[Lean Canvas do Projeto]].
- Um glossário compartilhável: [[Glossário]].
- Decisões básicas registradas: [[Decisões Técnicas]].
- Um esqueleto de módulos aceito pela equipe: [[Arquitetura por Módulos]].

---

## Próximo passo

A Sprint 1 deve escolher um subconjunto pequeno do backlogLista e entregar um fluxo funcional de revisão manual, mesmo que simples. O resto fica para depois.
