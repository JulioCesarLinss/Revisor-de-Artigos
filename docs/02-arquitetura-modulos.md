# Arquitetura por Módulos — NormaReview AI

> Wikilink: [[Arquitetura por Módulos]] · Sprint 0 — Fundação e Alinhamento

## 1. Objetivo

Esta seção define como dividir o sistema em módulos com responsabilidade clara, para que o código seja mais fácil de ler, testar e manter. O interesse não é DRY por DRY, mas evitar acoplamento oculto.

## 2. Princípios de módulo

- Cada módulo deve responder a uma pergunta clara.
- Módulos não devem compartilhar estado global não necessário.
- A “regra” deve estar próxima do domínio, não espalhada pela interface.
- A IA deve ser tratada como um serviço com porta definida, não como dependência onipresente.

## 3. Módulos propostos

### 3.1 `document`

**Responsabilidade**: entrada, representação e saída do texto/Manuscripto que está sendo revisado.

**O que fica aqui**:
- Importação de conteúdo (colagem, upload, etc.).
- Serialização/desserialização do rascunho.
- Transformações básicas de texto para consumo interno.

**O que não fica aqui**:
- Regras de revisão.
- Lógica de IA.
- Decisões de UI/visualização.

**Dependências previstas**:
- Usa `review` e `rules` para saber o que analisar.
- Usa `workspace` para persistir/conduzir versões.

---

### 3.2 `rules`

**Responsabilidade**: catálogo de verificações determinísticas e sua avaliação.

**O que fica aqui**:
- Definição de regras (id, título, severidade, mensagem, referência).
- Execução de verificações sobre o texto/Manuscripto.
- Classificação de problemas por tipo/severidade.

**O que não fica aqui**:
- detalhe da IU de cada regra.
- Geradores de texto por IA.

**Regra de ouro**:
- Uma regra deve ser testável isoladamente.
- Deve ser possível ler uma regra e entender o que ela verifica sem consultar a interface.

---

### 3.3 `review`

**Responsabilidade**: orquestração da revisão e apresentação dos resultados.

**O que fica aqui**:
- Receber o texto/Manuscripto e orquestrar as verificações.
- Estruturar os resultados para a interface.
- Unir regras e assistência IA quando aplicável.

**O que não fica aqui**:
- Parsing fino de normas abnt que seja puramente regra.
- Persistência de versões complexa.

---

### 3.4 `ai`

**Responsabilidade**: orquestração do assistente IA.

**O que fica aqui**:
- Formatagem de pedidos para assistência IA.
- Recepção e apresentação de sugestões.
- Tratamento de indisponibilidade e resultados variáveis.

**O que não fica aqui**:
- Decisão final de conformidade normativa.
- Persistência de estado de revisão.

**Direito importante**:
- A IA deve ser opcional: se falhar ou for lenta, o usuário continua podendo revisar pelo menos as regras base.

---

### 3.5 `workspace`

**Responsabilidade**: rascunho, versões, histórico e comparações.

**O que fica aqui**:
- Gestão do rascunho atual.
- Registro de alterações relevantes.
- Comparação entre versões/candidatos.

**O que não fica aqui**:
- Regras de verificação.
- Lógica de renderização de componente.

---

### 3.6 `ui`

**Responsabilidade**: componentes e apresentação orientados à tarefa.

**O que fica aqui**:
- Componentes de importação, leitura, lista de problemas, inspeção, diff, ações.
- Estado local mínimo de interação.
- Feedback visual semântico.

**O que não fica aqui**:
- Regras de negócio da revisão.
- Parsing do texto/Manuscripto.

---

### 3.7 `quality`

**Responsabilidade**: testes, validação e instrumentos de qualidade.

**O que fica aqui**:
- Testes de regras.
- Testes de fluxo principal.
- Critérios de aceite e observação de usabilidade.

---

## 4. Contratos mínimos sugeridos

Para evitar módulos acoplados demais, cada fronteira deve definir um contrato pequeno e explícito.

### 4.1 Entre `rules` e `review`

- Entrada: texto ou estrutura de documento revisável.
- Saída: lista de problemas com formato previsível.
- Meta: `rules` pode ser testado sem UI.

### 4.2 Entre `review` e `ui`

- Entrada: contexto da revisão e estado do documento.
- Saída: estrutura pronta para apresentação.
- Meta: UI não precisa saber como cada regra funciona.

### 4.3 Entre `review` e `ai`

- Entrada: solicitação de assistência pontual.
- Saída: sugestão com rastreabilidade.
- Meta: IA é opcional e tratada como serviço, não como parte do núcleo obrigatório.

### 4.4 Entre `document` e `workspace`

- Entrada: conteúdo importado e versões relacionadas.
- Saída: rascunho atualizado e histórico relevante.
- Meta: o sistema sabe o que mudou sem que a lógica de revisão precise cuidar disso.

---

## 5. Comunicação recomendada

- Pode haver camadas simples entre módulos, mas evita transmitir “todo o estado do documento” para todo lugar.
- Se um módulo precisa de algo, que peça somente o necessário.
- Evita que a UI decida sobre comportamento normativo.
- Evita que a IA congele o fluxo; trata-se como opcional.

---

## 6. Dependências aceitáveis

Uma direção simples e sustentável:

- `ui` → `review` → `rules` + `ai` + `document` + `workspace`
- Regras e documentos podem ser testados separadamente.
- IA é chamada por `review` (ou por uma camada de serviço), não espalhada em todo lugar.

---

## 7. O que não queremos

- Módulo gigante com tudo misturado.
- Regras guardadas dentro de componentes de interface.
- A IA acoplada ao texto de forma que impeça testes ou substituição.
- Estado global compartilhado por conveniência.

---

## 8. Regra de manutenção

Sempre que uma mudança faz sentido em mais de um módulo, prefira uma interface pequena e explícita entre eles, em vez de fundir responsabilidades.
