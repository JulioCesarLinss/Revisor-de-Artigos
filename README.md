# Revisor-de-Artigos

Projeto de revisão acadêmica com foco em normas ABNT e assistência por inteligência artificial.

## O que é

Ferramenta web para revisão de artigos e trabalhos acadêmicos: catálogo determinístico de regras com referência ABNT (NBR 10520/6023/14724), relatório de conformidade por seção, destaque do trecho problema no editor, correções com rastro e "Desfazer", assistência IA opcional e exportação do texto revisado em .docx (formatação ABNT básica).

## Como rodar

```bash
bun install
bun test           # testes
bun run typecheck
bun run build      # produção em dist/
```

### Desenvolvimento local (igual à produção)

1. Copie `.env.example` como `.env.local` e preencha os valores (o arquivo explica onde pegar cada um).
   O `.env.local` nunca vai para o git.
2. Abra **dois terminais** na pasta do projeto:

   ```bash
   bun run api   # terminal 1: API local em http://localhost:8787 (lê o .env.local)
   bun run dev   # terminal 2: app em http://localhost:5173 (repassa /api para a API local)
   ```

3. Acesse http://localhost:5173.

O que cada parte precisa:

| Recurso | Precisa de |
|---|---|
| Regras, editor, Desfazer, exportação | nada (funciona sem `.env.local`, em modo local) |
| Entrar com a conta real e salvar na nuvem | `VITE_FIREBASE_*` |
| Diagnóstico com Gemini | `VITE_FIREBASE_*` (exige login) + `GEMINI_API_KEY` + `bun run api` rodando |

A chave do Gemini (`GEMINI_API_KEY`) fica só no servidor — localmente no `bun run api`, em produção na Vercel — e nunca usa o prefixo `VITE_`.

Assistente de reescrita (opcional): cada usuário informa a própria chave compatível com OpenAI no Perfil ou na tela de revisão; ela fica salva só no navegador.

### Teste de carga

Com a API rodando (`bun run api`), avalie velocidade, estabilidade e tempo de resposta sob usuários simultâneos:

```bash
bun run test:carga           # normal: 10 usuários por 20s
bun run test:carga:pico      # pico: 50 usuários por 30s
bun run test:carga:estresse  # estresse: 150 usuários por 30s
```

O relatório mostra throughput, latência (min/média/p50/p90/p95/p99/max), distribuição de status, motivos de falha e a variação de p95 entre o início e o fim. O comando falha (código 1) se p95 passar de 2 s ou os erros de 1% — limites ajustáveis com `--p95` e `--erro`. Outras opções: `--usuarios`, `--duracao`, `--url`, `--pausa`, `--timeout`, `--ajuda`.

A carga é mista: `/api/health` e `/api/revisar` (manuscritos curto, médio e longo). `/api/gemini` fica fora porque depende do Google — mediria o provedor externo, não este sistema. Rodando o gerador na mesma máquina da API, os números são indicativos; para aferição real, aponte `--url` para o ambiente e rode o gerador em outra máquina.

### Teste de estresse

Leva o sistema ao limite para achar o ponto de quebra e observar a recuperação:

```bash
bun run test:estresse
bun scripts/teste-estresse.ts --degraus 1,10,50,100,200 --degrau 10
```

A concorrência sobe em degraus (padrão: 1 → 5 → 10 → 25 → 50 → 100 → 200 usuários por 8 s). O primeiro degrau que viola p95/erros é o **ponto de quebra**; o anterior é o último nível saudável. Depois o teste mede quanto tempo o `/api/health` leva para voltar, se a carga de retorno normaliza e se corpos acima de 64 KB, JSON inválido e método errado são recusados com 400/405 (sem 500 nem queda). Sai com código 0 quando a degradação é controlada e há recuperação, 1 quando o serviço não volta ou trata mal o limite, e 2 se a API estiver inacessível. Ajustes: `--degraus`, `--degrau`, `--p95`, `--erro`, `--recuperacao`, `--tempo-recuperacao`, `--url` e `--ajuda`.

> Estresse contra produção gera carga real: prefira um ambiente de teste e rode o gerador em outra máquina. Exaustão real de memória/CPU do host não é provocada — o limite é exercitado por concorrência e pelas validações da API.

## Objetivo inicial

- Tornar a revisão mais rápida e mais compreensível.
- Separar o que é exigência normativa do que é recomendação por IA.
- Oferecer um fluxo claro de importar, analisar, editar e acompanhar revisão.

## Documentação do projeto

- [[Cérebro do Projeto]] — documento central com sprints, decisões e organização do produto.
- `docs/` — documentos complementares da Sprint 0:
  - `docs/00-lean-canvas.md`
  - `docs/01-backlog.md`
  - `docs/02-arquitetura-modulos.md`
  - `docs/03-decisoes-tecnologias.md`
  - `docs/04-contributing.md`
  - `docs/05-lingua-glossario.md`
  - `docs/06-sprint-0-plan.md`
  - `docs/06-sprint-1-plan.md`
  - `docs/06-sprint-2-plan.md`
  - `docs/06-sprint-3-plan.md`
  - `docs/06-sprint-4-plan.md`
  - `docs/06-sprint-5-plan.md`
  - `docs/11-entrega-v1.md` — documentação v1 de manutenção

## Próximos passos

- Sprints 0 a 5 estão encerradas no nível documental (planos em `docs/06-sprint-*-plan.md`).
- **Sprint 1 executada em código**: app em `src/` (Vite + React + TypeScript) com importar → analisar → corrigir → reanalisar.
- **Sprint 2 executada em código**: catálogo normativo R001–R010 com referência ABNT (NBR 10520/6023/14724), relatório de conformidade por seção e navegação até o trecho problema.
- **Sprint 3 executada em código**: assistência IA opcional (endpoint compatível OpenAI, chave do usuário) com sugestão pontual, explicação, aceitar/editar/ignorar e histórico com rastro manual vs IA.
- **Sprint 4 executada em código**: fluxo rascunho → revisão → versão final com snapshots, comparação lado a lado por parágrafo e feedback “isso ajudou?”.
- **Sprint 5 executada em código**: testes dos caminhos principais e limites (53 no total), acessibilidade e [[Documentação v1]] em `docs/11-entrega-v1.md`.
- **Ciclo 1→5 completo.** Manutenção: comece por `docs/11-entrega-v1.md`; priorização de expansão segue DC-12 em `docs/03-decisoes-tecnologias.md`.

## Como contribuir

Veja `docs/04-contributing.md` para orientações sobre issue, Pull Request e critérios de aceite.

## Equipe

- Júlio César Bizarria Lins
- Matheus Felipe Lopes de Oliveira
- Theo Vieira Marcelino
- Daniel Silva Costa
- Luciano Henrique Pereira Cordeiro
