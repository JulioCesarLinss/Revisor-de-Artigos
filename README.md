# NormaReview AI — Revisor de Artigos

Ferramenta web de revisão de artigos e trabalhos acadêmicos com foco em normas ABNT. Combina um catálogo de regras determinístico (sempre o mesmo resultado para o mesmo texto) com assistência de IA opcional, que só sugere reescritas e nunca decide conformidade.

## Funcionalidades

- **Importação** de texto colado e de arquivos `.docx`, `.txt` e `.md`.
- **Catálogo de 10 regras** (R001–R010) com severidade (advertência ou observação) e referência normativa (NBR 10520:2023, NBR 6023:2018, NBR 14724:2011 e boas práticas).
- **Relatório por seção**, com o número de parágrafos e de problemas em cada seção do texto.
- **Navegação até o trecho**: o botão "Localizar no manuscrito" leva direto ao parágrafo com o problema.
- **Correções rápidas** com reanálise imediata e opção de desfazer.
- **Fluxo guiado** em três etapas: rascunho, revisão e versão final, com snapshots e comparação lado a lado.
- **Histórico de alterações** com a origem de cada mudança (manual ou sugestão de IA).
- **Assistente de IA opcional**: sugestões de reescrita com a chave de API do próprio usuário (compatível com OpenAI ou Gemini). Sem chave, o fluxo continua completo.
- **Exportação** do texto revisado em `.docx`, com formatação ABNT básica.
- **Contas de usuário** com cadastro e login por e-mail e senha (Firebase Authentication) e dados salvos na nuvem (Firestore).

## Stack

| Camada | Tecnologia |
|---|---|
| Interface | React 19, TypeScript, Vite |
| Runtime e testes | Bun (`bun test`) |
| Autenticação e banco | Firebase Authentication e Cloud Firestore |
| Backend | Funções serverless na Vercel (`api/`) e servidor local (`server/`) |
| IA | Google Gemini (no servidor) ou endpoint compatível com OpenAI (no navegador, com chave do usuário) |
| Testes de interface | Playwright |
| Deploy | Vercel, com build automático a cada push na branch `main` |

## Estrutura do projeto

```
src/
├── document/   importação, representação do manuscrito, arquivos (.docx, .txt, .md)
├── rules/      catálogo de regras e motor de avaliação
├── review/     orquestração da revisão e relatório por seção
├── ai/         assistente de IA (opcional)
├── workspace/  fluxo em etapas, histórico e armazenamento
├── exportar/   geração do .docx
├── firebase/   autenticação, configuração e persistência na nuvem
├── auth/       senha e sessão do servidor
├── perfil/     dados do perfil e configuração da IA
├── pages/      telas: login, revisão, histórico, artigos e perfil
└── ui/         componentes de interface
api/            funções serverless (Vercel): /api/health, /api/revisar e /api/gemini
server/         servidor local para desenvolvimento (mesmas rotas de api/)
scripts/        testes de carga, estresse e segurança, detector de test smells
tests/          testes de ponta a ponta (Playwright)
docs/           planejamento, decisões técnicas e documentação de entrega
```

## Como rodar

Pré-requisito: [Bun](https://bun.sh) instalado.

```bash
bun install
bun test              # testes unitários e de integração
bun run typecheck     # verificação de tipos
bun run build         # build de produção em dist/
```

### Ambiente local

1. Copie `.env.example` para `.env.local` e preencha os valores. O arquivo explica onde obter cada um. O `.env.local` nunca vai para o git.
2. Abra **dois terminais** na pasta do projeto:

   ```bash
   bun run api   # terminal 1: API local em http://localhost:8787
   bun run dev   # terminal 2: aplicação em http://localhost:5173 (repassa /api para a API local)
   ```

3. Acesse http://localhost:5173.

| O que você quer usar | O que precisa |
|---|---|
| Regras, editor, correções e exportação | Nada: funciona em modo local, sem `.env.local` |
| Cadastro, login e salvamento na nuvem | Variáveis `VITE_FIREBASE_*` |
| Diagnóstico com Gemini | Variáveis `VITE_FIREBASE_*` (exige login) e `GEMINI_API_KEY`, com `bun run api` rodando |

Regra de segurança: a chave `GEMINI_API_KEY` fica só no servidor (no `bun run api` localmente e nas variáveis de ambiente da Vercel em produção). Ela nunca usa o prefixo `VITE_`, porque variáveis com esse prefixo vão para o navegador. As variáveis `VITE_FIREBASE_*` são públicas por natureza; a proteção dos dados está nas regras do Firestore.

## Deploy

O projeto está conectado à Vercel pelo GitHub. Cada push na `main` gera um novo deploy de produção. As variáveis de ambiente (`VITE_FIREBASE_*` e `GEMINI_API_KEY`) ficam cadastradas no painel da Vercel. Após alterar uma variável, é preciso fazer um novo deploy para ela valer.

## Testes

### Testes unitários e de integração

```bash
bun test
```

### Teste de carga

Com a API rodando (`bun run api`), avalia velocidade, estabilidade e tempo de resposta sob usuários simultâneos:

```bash
bun run test:carga           # normal: 10 usuários por 20 s
bun run test:carga:pico      # pico: 50 usuários por 30 s
bun run test:carga:estresse  # estresse: 150 usuários por 30 s
```

O comando falha (código 1) se o p95 passar de 2 s ou se os erros passarem de 1%. Os limites podem ser ajustados com `--p95` e `--erro`. A carga mistura `/api/health` e `/api/revisar` com manuscritos curtos, médios e longos. `/api/gemini` fica de fora, porque depende do Google e mediria o provedor externo, e não este sistema. Quando o gerador roda na mesma máquina da API, os números são indicativos. Para uma medição real, use `--url` apontando para o ambiente e rode o gerador em outra máquina.

### Teste de estresse

Aumenta a concorrência em degraus para encontrar o ponto de quebra:

```bash
bun run test:estresse
bun scripts/teste-estresse.ts --degraus 1,10,50,100,200 --degrau 10
```

O padrão sobe de 1 a 200 usuários simultâneos. O primeiro degrau que viola o p95 ou a taxa de erro é o **ponto de quebra**. O degrau anterior é o último nível saudável. Depois do pico, o teste mede o tempo de recuperação e verifica se corpos grandes, JSON inválido e métodos errados são recusados com 400 ou 405, sem erro 500.

> Testes de estresse contra produção geram carga real. Prefira um ambiente de teste.

### Teste de segurança

Procura brechas e exposição de dados no código e na API:

```bash
bun run test:seguranca --somente-estatico                  # segredos no código e no bundle, .env versionado
bun run test:seguranca                                     # também a bateria dinâmica contra a API local
bun scripts/teste-seguranca.ts --front http://localhost:5173
```

A fase estática procura chaves embutidas (Google/Gemini, OpenAI, chaves PEM, GitHub e AWS), arquivos `.env` versionados por engano e variáveis sensíveis com prefixo `VITE_`. A fase dinâmica confere a autenticação do `/api/gemini`, o CORS, os cabeçalhos de segurança do front, os limites de corpo, a travessia de caminho até `.env` e a exposição de stack trace. Cada achado recebe uma severidade (crítico, alto, médio ou baixo). O comando falha a partir do nível definido em `--rigor` (padrão: `alto`).

> As verificações são passivas e de baixo volume: não há ataques destrutivos nem exaustão de recursos. Rode contra um ambiente de teste e não contra produção sem autorização.

### Testes de ponta a ponta e smoke test

```bash
bun run test:e2e      # suíte completa (Playwright)
bun run test:smoke    # caminho crítico de uma versão nova: login, revisão, histórico e perfil
```

Na primeira execução, instale o navegador do Playwright com `npx playwright install`. Sem ele, os testes de interface falham com a mensagem `Executable doesn't exist`.

### Análise de test smells

```bash
bun run smells
```

Detecta padrões ruins na suíte de testes (como asserções condicionais, números mágicos e testes muito longos). Veja a metodologia na seção de correção do relatório de testes.

## Documentação

- `CEREBRO_PROJETO.md`: documento central, com sprints, decisões e organização do produto.
- `docs/`: planejamento por sprint (`06-sprint-*-plan.md`), decisões técnicas (`03-decisoes-tecnologias.md`), arquitetura (`02-arquitetura-modulos.md`) e guia de contribuição (`04-contributing.md`).
- `docs/11-entrega-v1.md`: documentação da versão entregue, com o ponto de entrada para manutenção.

## Limitações conhecidas

- A verificação normativa é textual. Não há checagem de margens, fonte, espaçamento entre linhas nem recuos, porque o `.docx` é lido apenas pelo texto.
- Arquivos PDF não são aceitos; é preciso colar o texto ou enviar `.docx`.
- Títulos em caixa-alta ainda podem gerar alertas de falso positivo na regra de caixa-alta.
- A assistência de IA depende de uma chave válida. Sem ela, o restante do fluxo funciona normalmente.

## Equipe

- Júlio César Bizarria Lins
- Lucciano Henrique
- Theo Vieira Marcelino
- Daniel Silva Costa
- Matheus Felipe Lopes de Oliveira
