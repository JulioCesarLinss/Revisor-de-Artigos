/**
 * Teste de estresse — leva o sistema ao limite para descobrir o ponto de
 * quebra e observar como ele se recupera.
 *
 * Diferente do teste de carga (`scripts/teste-carga.ts`, que mede um patamar
 * fixo), aqui a concorrência sobe em degraus até algum limite estourar:
 *
 * 1. RAMPA: níveis crescentes de usuários simultâneos (1 → 5 → 10 → …). Em cada
 *    degrau mede-se latência, throughput e erros; o primeiro degrau que violar
 *    os limites (p95 ou taxa de erro) é o PONTO DE QUEBRA, e o anterior é o
 *    último nível saudável.
 * 2. RECUPERAÇÃO: logo após o pico, mede-se quanto tempo o sistema leva para
 *    voltar a responder ao /api/health e se a carga de retorno (primeiro nível)
 *    volta ao normal.
 * 3. FALTA DE RECURSOS: envia corpos acima do limite de 64 KB, JSON inválido,
 *    campo ausente e método incorreto para confirmar que o sistema RECUSA com
 *    400/405 (degradação elegante) em vez de responder 500 ou cair.
 *
 * O teste "passa" quando a quebra é controlada e o serviço se recupera; a
 * existência de um ponto de quebra é o resultado esperado, não uma falha.
 *
 * Uso:
 *   bun scripts/teste-estresse.ts
 *   bun scripts/teste-estresse.ts --degraus 1,10,50,100 --degrau 10
 *   bun scripts/teste-estresse.ts --url https://exemplo.vercel.app
 *
 * Sai com 0 (degradação controlada e recuperação OK), 1 (não recuperou ou
 * recurso tratado de forma errada) ou 2 (API inacessível no início).
 *
 * Atenção: executar contra produção gera carga real. Prefira um ambiente de
 * teste e rode o gerador em outra máquina — localmente ele disputa CPU com o
 * servidor. Exaustão real de memória/CPU do host não é provocada aqui: os
 * limites são exercitados por concorrência e pelas validações da própria API.
 */

import { executarCarga, percentil, resumir, verificarSistema, type Opcoes } from "./teste-carga";

interface EstresseOpcoes {
  url: string;
  degraus: number[];
  degrauSegundos: number;
  aquecimentoSegundos: number;
  pausaMs: number;
  timeoutMs: number;
  limiteP95: number;
  limiteErroPct: number;
  recuperacaoSegundos: number;
  limiteRecuperacaoMs: number;
}

interface LinhaDegrau {
  usuarios: number;
  requisicoes: number;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  taxaErro: number;
  motivos: string[];
}

interface Checagem {
  nome: string;
  esperado: string;
  obtido: string;
  ok: boolean;
}

const DEGRAUS_PADRAO = [1, 5, 10, 25, 50, 100, 200];

function numero(cru: string | undefined, padrao: number): number {
  if (cru === undefined) return padrao;
  const valor = Number(cru);
  if (!Number.isFinite(valor) || valor < 0) throw new Error(`Valor numérico inválido: "${cru}".`);
  return valor;
}

function lerDegraus(cru: string | undefined): number[] {
  if (cru === undefined) return [...DEGRAUS_PADRAO];
  const degraus = cru
    .split(",")
    .map((parte) => Number(parte.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (degraus.length === 0) throw new Error(`Lista de degraus inválida: "${cru}".`);
  return [...new Set(degraus)].sort((a, b) => a - b);
}

function lerArgumentos(argv: string[]): EstresseOpcoes {
  const valores = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const [chave, inline] = arg.slice(2).split("=", 2) as [string, string | undefined];
    if (inline !== undefined) {
      valores.set(chave, inline);
    } else if (argv[i + 1] !== undefined && !argv[i + 1]!.startsWith("--")) {
      valores.set(chave, argv[i + 1]!);
      i++;
    } else {
      valores.set(chave, "sim");
    }
  }

  if (valores.has("ajuda") || valores.has("help")) {
    imprimirAjuda();
    process.exit(0);
  }

  return {
    url: (valores.get("url") ?? "http://localhost:8787").replace(/\/+$/, ""),
    degraus: lerDegraus(valores.get("degraus")),
    degrauSegundos: numero(valores.get("degrau"), 8),
    aquecimentoSegundos: numero(valores.get("aquecimento"), 2),
    pausaMs: numero(valores.get("pausa"), 0),
    timeoutMs: numero(valores.get("timeout"), 10_000),
    limiteP95: numero(valores.get("p95"), 2_000),
    limiteErroPct: numero(valores.get("erro"), 1),
    recuperacaoSegundos: numero(valores.get("recuperacao"), 10),
    limiteRecuperacaoMs: numero(valores.get("tempo-recuperacao"), 15_000),
  };
}

function imprimirAjuda(): void {
  console.log(`Teste de estresse — NormaReview AI

Uso: bun scripts/teste-estresse.ts [opções]

Opções:
  --degraus <lista>            Níveis de usuários simultâneos, separados por vírgula
                               (padrão: ${DEGRAUS_PADRAO.join(",")})
  --degrau <s>                 Duração de cada degrau em segundos (padrão: 8)
  --url <base>                 Base do sistema (padrão: http://localhost:8787)
  --aquecimento <s>            Aquecimento antes do primeiro degrau (padrão: 2)
  --p95 <ms>                   Limite de p95 por degrau (padrão: 2000)
  --erro <pct>                 Limite de taxa de erro por degrau (padrão: 1)
  --recuperacao <s>            Duração da carga de retorno após o pico (padrão: 10)
  --tempo-recuperacao <ms>     Tempo máximo para o serviço voltar a responder (padrão: 15000)
  --pausa <ms>                 Pausa entre requisições de cada usuário (padrão: 0)
  --timeout <ms>               Limite por requisição (padrão: 10000)
  --ajuda                      Mostra esta ajuda

Exemplos:
  bun run test:estresse
  bun scripts/teste-estresse.ts --degraus 1,10,25,50 --degrau 6
  bun scripts/teste-estresse.ts --url https://exemplo.vercel.app --degraus 50,100,200
`);
}

function ms(valor: number): string {
  return `${valor.toFixed(1)} ms`;
}

function pct(valor: number): string {
  return `${valor.toFixed(2)}%`;
}

function opcoesDeCarga(base: EstresseOpcoes, usuarios: number, duracao: number, aquecimento: number): Opcoes {
  return {
    url: base.url,
    perfil: "estresse",
    usuarios,
    duracaoSegundos: duracao,
    aquecimentoSegundos: aquecimento,
    pausaMs: base.pausaMs,
    timeoutMs: base.timeoutMs,
    limiteP95: base.limiteP95,
    limiteErroPct: base.limiteErroPct,
  };
}

/** Executa um degrau e devolve a linha do relatório, já com os motivos de quebra. */
async function rodarDegrau(
  base: EstresseOpcoes,
  usuarios: number,
  aquecimento: number,
  duracao: number = base.degrauSegundos,
): Promise<LinhaDegrau> {
  const { amostras, duracaoSegundos } = await executarCarga(opcoesDeCarga(base, usuarios, duracao, aquecimento));
  const resumo = resumir(amostras, duracaoSegundos);
  const p95 = percentil(resumo.latencias, 95);

  const motivos: string[] = [];
  if (resumo.requisicoes === 0) motivos.push("nenhuma resposta");
  if (p95 > base.limiteP95) motivos.push(`p95 ${ms(p95)} > ${ms(base.limiteP95)}`);
  if (resumo.taxaErro > base.limiteErroPct) motivos.push(`erros ${pct(resumo.taxaErro)} > ${base.limiteErroPct}%`);

  return {
    usuarios,
    requisicoes: resumo.requisicoes,
    rps: resumo.rps,
    p50: percentil(resumo.latencias, 50),
    p95,
    p99: percentil(resumo.latencias, 99),
    taxaErro: resumo.taxaErro,
    motivos,
  };
}

/** Espera o /api/health voltar (3 respostas OK seguidas) e devolve o tempo. */
async function medirRecuperacao(url: string, limiteMs: number): Promise<{ ms: number | null; tentativas: number }> {
  const inicio = performance.now();
  let okSeguidos = 0;
  let tentativas = 0;
  while (performance.now() - inicio < limiteMs) {
    tentativas++;
    try {
      const resposta = await fetch(`${url}/api/health`, {
        signal: AbortSignal.timeout(Math.min(2_000, limiteMs)),
      });
      okSeguidos = resposta.ok ? okSeguidos + 1 : 0;
    } catch {
      okSeguidos = 0;
    }
    if (okSeguidos >= 3) return { ms: performance.now() - inicio, tentativas };
    await Bun.sleep(250);
  }
  return { ms: null, tentativas };
}

/** Lê status e código de erro de uma resposta, sem lançar. */
async function pedir(
  url: string,
  caminho: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; codigo: string | null }> {
  try {
    const resposta = await fetch(url + caminho, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    const corpo = (await resposta.json().catch(() => null)) as { erro?: { codigo?: unknown } } | null;
    const codigo = typeof corpo?.erro?.codigo === "string" ? corpo.erro.codigo : null;
    return { status: resposta.status, codigo };
  } catch {
    return { status: 0, codigo: null };
  }
}

/**
 * Falta de recursos — a API precisa recusar entradas inválidas/grandes com
 * erro controlado, mesmo recebendo várias ao mesmo tempo.
 */
async function checarRecusas(base: EstresseOpcoes): Promise<Checagem[]> {
  const json = { "content-type": "application/json" };
  const checagens: Checagem[] = [];

  // Corpo acima do limite de 64 KB, enviado 8 vezes em paralelo: nenhuma
  // requisição pode virar 500 nem derrubar o serviço.
  const grande = JSON.stringify({ texto: "a".repeat(70 * 1024) });
  const respostasGrande = await Promise.all(
    Array.from({ length: 8 }, () =>
      pedir(base.url, "/api/revisar", { method: "POST", headers: json, body: grande }, base.timeoutMs),
    ),
  );
  const todas400 = respostasGrande.every((r) => r.status === 400 && r.codigo === "corpo_invalido");
  checagens.push({
    nome: "corpo acima de 64 KB (8 envios simultâneos)",
    esperado: "400 corpo_invalido",
    obtido: [...new Set(respostasGrande.map((r) => `${r.status} ${r.codigo ?? "sem código"}`))].join(", "),
    ok: todas400,
  });

  // O servidor local responde 404 (rota GET inexistente no roteador) e a função
  // da Vercel responde 405; os dois são recusas controladas do mesmo contrato.
  const casos: { nome: string; init: RequestInit; esperado: string; aceitos: [number, string][] }[] = [
    {
      nome: "JSON inválido",
      init: { method: "POST", headers: json, body: "{" },
      esperado: "400 corpo_invalido",
      aceitos: [[400, "corpo_invalido"]],
    },
    {
      nome: "campo texto ausente",
      init: { method: "POST", headers: json, body: "{}" },
      esperado: "400 corpo_invalido",
      aceitos: [[400, "corpo_invalido"]],
    },
    {
      nome: "método não permitido (GET /api/revisar)",
      init: { method: "GET" },
      esperado: "404 nao_encontrado ou 405 metodo_invalido",
      aceitos: [
        [404, "nao_encontrado"],
        [405, "metodo_invalido"],
      ],
    },
  ];

  for (const caso of casos) {
    const resposta = await pedir(base.url, "/api/revisar", caso.init, base.timeoutMs);
    checagens.push({
      nome: caso.nome,
      esperado: caso.esperado,
      obtido: `${resposta.status} ${resposta.codigo ?? "sem código"}`,
      ok: caso.aceitos.some(([status, codigo]) => resposta.status === status && resposta.codigo === codigo),
    });
  }

  return checagens;
}

interface Relatorio {
  texto: string;
  aprovado: boolean;
  motivos: string[];
}

export async function executarEstresse(base: EstresseOpcoes): Promise<Relatorio> {
  const linhas: string[] = [];
  const falhas: string[] = [];
  const largura = (texto: string, tam: number) => texto.padEnd(tam);

  linhas.push("=".repeat(92));
  linhas.push("TESTE DE ESTRESSE — NormaReview AI");
  linhas.push(`Sistema: ${base.url}`);
  linhas.push(
    `Rampa: ${base.degraus.join(" → ")} usuários · ${base.degrauSegundos}s por degrau · ` +
      `limites p95 ${base.limiteP95} ms / erros ${base.limiteErroPct}%`,
  );
  linhas.push("=".repeat(92));

  // 1. Rampa até o ponto de quebra.
  linhas.push("\nRAMPA DE CARGA");
  linhas.push(
    `  ${largura("USUÁRIOS", 10)}${largura("REQ", 9)}${largura("REQ/S", 10)}${largura("P50", 11)}` +
      `${largura("P95", 11)}${largura("P99", 11)}${largura("ERROS", 10)}SITUAÇÃO`,
  );

  const degraus: LinhaDegrau[] = [];
  let nivelQuebra: number | null = null;
  let ultimoSaudavel: number | null = null;

  for (const [indice, usuarios] of base.degraus.entries()) {
    const linha = await rodarDegrau(base, usuarios, indice === 0 ? base.aquecimentoSegundos : 0);
    degraus.push(linha);
    const situacao = linha.motivos.length === 0 ? "OK" : `QUEBRA — ${linha.motivos.join("; ")}`;
    linhas.push(
      `  ${largura(String(linha.usuarios), 10)}${largura(String(linha.requisicoes), 9)}` +
        `${largura(linha.rps.toFixed(1), 10)}${largura(ms(linha.p50), 11)}${largura(ms(linha.p95), 11)}` +
        `${largura(ms(linha.p99), 11)}${largura(pct(linha.taxaErro), 10)}${situacao}`,
    );

    if (linha.motivos.length > 0) {
      nivelQuebra = usuarios;
      break;
    }
    ultimoSaudavel = usuarios;
  }

  linhas.push("\nPONTO DE QUEBRA");
  if (nivelQuebra === null) {
    linhas.push(`  Nenhum degrau violou os limites (até ${base.degraus[base.degraus.length - 1]} usuários).`);
    linhas.push("  O sistema não quebrou na faixa testada — amplie --degraus para procurar o limite.");
  } else {
    linhas.push(`  Quebrou com ${nivelQuebra} usuário(s) simultâneo(s).`);
    linhas.push(
      ultimoSaudavel === null
        ? "  Já quebrou no primeiro degrau — verifique o ambiente antes de atribuir ao código."
        : `  Último nível saudável: ${ultimoSaudavel} usuário(s).`,
    );
  }

  // 2. Recuperação: health primeiro, depois carga de retorno no primeiro nível.
  linhas.push("\nRECUPERAÇÃO");
  const recuperacao = await medirRecuperacao(base.url, base.limiteRecuperacaoMs);
  if (recuperacao.ms === null) {
    linhas.push(`  O /api/health não voltou a responder em ${ms(base.limiteRecuperacaoMs)} (${recuperacao.tentativas} tentativas).`);
    falhas.push("serviço não voltou a responder após o pico");
  } else {
    linhas.push(`  /api/health voltou em ${ms(recuperacao.ms)} (${recuperacao.tentativas} tentativa(s), 3 respostas OK seguidas).`);
  }

  const nivelRetorno = base.degraus[0]!;
  const retorno = await rodarDegrau(base, nivelRetorno, 0, base.recuperacaoSegundos);
  linhas.push(
    `  Carga de retorno com ${nivelRetorno} usuário(s) por ${base.recuperacaoSegundos}s: ` +
      `p95 ${ms(retorno.p95)} · erros ${pct(retorno.taxaErro)} · ${retorno.requisicoes} req`,
  );
  if (retorno.motivos.length > 0) {
    linhas.push(`  Não voltou ao patamar normal — ${retorno.motivos.join("; ")}.`);
    falhas.push("carga de retorno acima dos limites após o pico");
  } else if (recuperacao.ms !== null) {
    linhas.push("  Voltou ao patamar normal — recuperação concluída.");
  }

  // 3. Falta de recursos: recusas controladas.
  linhas.push("\nFALTA DE RECURSOS / ENTRADAS LIMITE");
  const checagens = await checarRecusas(base);
  for (const checagem of checagens) {
    linhas.push(
      `  ${checagem.ok ? "OK " : "FALHOU"} ${checagem.nome} — esperado ${checagem.esperado}; obtido ${checagem.obtido}`,
    );
    if (!checagem.ok) falhas.push(`recusa incorreta: ${checagem.nome} (${checagem.obtido})`);
  }

  // Confirma que as recusas não deixaram o serviço instável.
  const saudeFinal = await verificarSistema(base.url, base.timeoutMs);
  linhas.push(
    saudeFinal === null
      ? "  Serviço segue saudável depois das recusas (GET /api/health OK)."
      : `  Serviço instável após as recusas: ${saudeFinal}.`,
  );
  if (saudeFinal !== null) falhas.push("serviço instável após entradas limite");

  const aprovado = falhas.length === 0;
  linhas.push("\nRESULTADO");
  if (aprovado) {
    linhas.push("  APROVADO — a quebra (se houve) ficou limitada e o serviço se recuperou.");
  } else {
    linhas.push(`  REPROVADO — ${falhas.join("; ")}.`);
  }

  return { texto: linhas.join("\n"), aprovado, motivos: falhas };
}

async function principal(): Promise<void> {
  let opcoes: EstresseOpcoes;
  try {
    opcoes = lerArgumentos(process.argv.slice(2));
  } catch (erro) {
    console.error(`Erro: ${erro instanceof Error ? erro.message : String(erro)}`);
    console.error("Use --ajuda para ver as opções.");
    process.exit(2);
  }

  const problema = await verificarSistema(opcoes.url, opcoes.timeoutMs);
  if (problema) {
    console.error(`Sistema indisponível: ${problema}.`);
    console.error("Suba a API antes do teste: bun run api (e bun run dev, se quiser testar pelo front).");
    process.exit(2);
  }

  const duracaoRampa = opcoes.degraus.length * opcoes.degrauSegundos;
  console.log(
    `Iniciando teste de estresse: ${opcoes.degraus.join(" → ")} usuários, ${opcoes.degrauSegundos}s por degrau ` +
      `(~${duracaoRampa + opcoes.recuperacaoSegundos}s)…`,
  );

  const { texto, aprovado } = await executarEstresse(opcoes);
  console.log(`\n${texto}`);
  process.exit(aprovado ? 0 : 1);
}

if (import.meta.main) {
  await principal();
}
