# Documentação v1 — NormaReview AI (Entrega)

> Wikilink: [[Documentação v1]] · Sprint 5 — Polimento, Qualidade e Entrega

Este documento é o ponto de entrada para manutenção do produto implementado. Complementa o [[Cérebro do Projeto]] e os planos em `docs/06-sprint-*-plan.md`.

---

## 1. O produto hoje

Ferramenta web de revisão de artigos acadêmicos com:

- **Importação por colagem** do texto (parágrafos separados por linha em branco; títulos em CAIXA-ALTA delimitam seções).
- **Catálogo determinístico de 10 regras** (R001–R010) com mensagem, severidade e norma de referência (NBR 10520:2023, NBR 6023:2018, NBR 14724:2011 e boas práticas).
- **Relatório de conformidade por seção** com indicador de status.
- **Navegação ao trecho problema** (modo revisar com realce e rolagem).
- **Correções rápidas determinísticas** com reanálise imediata (nenhum conteúdo é descartado).
- **Assistência IA opcional** (endpoint compatível OpenAI, BYO-key): sugestão pontual + explicação, aceitar/editar/ignorar, rastro no histórico.
- **Fluxo guiado** rascunho → revisão → versão final com snapshots, comparação lado a lado e feedback 👍/👎.

Princípios respeitados em código: regras nunca na UI (DC-02/[[Arquitetura por Módulos]]), IA opcional e tolerante a falhas (DC-03), tudo com rastro (DC-13), dependências mínimas (DC-10).

---

## 2. Arquitetura implementada

```
src/
├── document/     # importação, representação (Manuscrito), correções e sugestões
│   ├── types.ts          # Manuscrito, ParagrafoManuscrito
│   ├── importar.ts       # importarTexto (fonte de verdade: texto bruto)
│   ├── acoes.ts          # aplicarCorrecao (ações determinísticas)
│   └── aplicarSugestao.ts# aplicação de sugestão IA por parágrafo
├── rules/        # catálogo + motor (100% determinístico)
│   ├── types.ts          # Problema (DC-08), Regra, Severidade, AcaoRapida
│   ├── catalogo.ts       # R001–R010 com norma de referência
│   └── motor.ts          # avaliarManuscrito (ordenação estável)
├── review/       # orquestração
│   ├── orquestrar.ts     # iniciarRevisao: documento → problemas → resumo → seções
│   └── secoes.ts         # detecção de seções + relatório de conformidade
├── ai/           # assistência opcional
│   ├── types.ts          # ConfiguracaoIA, SugestaoIA, ResultadoSugestao
│   └── assistente.ts     # fetch compatível OpenAI, timeout, falha legível
├── workspace/    # fluxo guiado, diff e histórico
│   ├── fluxo.ts          # estados, snapshots (VersaoSnapshot)
│   ├── diff.ts           # comparação por parágrafo
│   └── historico.ts      # rastro manual vs IA (DC-13)
├── ui/           # componentes (sem regras de negócio)
├── quality/      # testes de caminhos principais e limites (Sprint 5)
├── App.tsx       # composição do fluxo completo
└── index.css     # tema Academic Modernist (do DESIGN.md do stitch)
```

**Direção de dependências** (conforme [[Arquitetura por Módulos]]): `ui` → `review` → `rules` + `document` + `ai` + `workspace`.

---

## 3. Operação

| Comando | Uso |
|---|---|
| `bun install` | instalar dependências |
| `bun run dev` | servidor de desenvolvimento (0.0.0.0:5173) |
| `bun test` | 53 testes (domínio, caminhos principais, limites) |
| `bun run typecheck` | `tsc --noEmit` estrito |
| `bun run build` | build de produção em `dist/` |

**IA (opcional):** chave informada por sessão na UI, ou `VITE_OPENAI_API_KEY` no ambiente; endpoint e modelo configuráveis em `src/ai/assistente.ts`.

---

## 4. Contratos estáveis (não quebrar em manutenção)

- **Problema (DC-08)**: `id`, `regraId`, `categoria`, `severidade`, `mensagem`, `referencia`, `paragrafo`, `trecho`, `acao?`.
- **Regra**: legível e testável isoladamente; `avaliar(manuscrito) → Problema[]`; nunca acessa UI.
- **Texto bruto é a fonte de verdade**: qualquer transformação preserva separadores e conteúdo não-alvo (testes garantem).
- **Ids determinísticos**: mesma entrada → mesmos ids de problemas (teste cobre).
- **IA sempre retorna `ResultadoSugestao`**: nunca lança; `{ ok: false, motivo }` em qualquer falha.

---

## 5. O que fica para depois (pós-Sprint 5)

- Exportação (.docx/.pdf) e persistência entre sessões (Backlog §4 P2).
- Upload de arquivos (hoje: colagem) — Backlog §1.
- Expansão do catálogo ABNT sem reescrever fluxos (o motor já aceita novas regras por inserção em `CATALOGO`).
- Proxy de backend para a chave de IA (a chamada client-side é adequada ao padrão BYO-key do MVP).
- Métricas de feedback ("isso ajudou?") agregadas para refinamento.
