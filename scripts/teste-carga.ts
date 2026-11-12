/**
 * Teste de carga — velocidade, estabilidade e tempo de resposta do sistema.
 *
 * Simula usuários simultâneos batendo nas rotas reais da API local
 * (`bun run api`) ou da produção, medindo latência por percentil, throughput,
 * taxa de erro e degradação ao longo do teste.
 *
 * Cenários de carga mista (pesos):
 * - GET /api/health (15%) — resposta barata, mede a saúde do servidor;
 * - POST /api/revisar com manuscrito curto (45%);
 * - POST /api/revisar com manuscrito médio (30%);
 * - POST /api/revisar com manuscrito longo (10%).
 *
 * `/api/gemini` fica de fora de propósito: depende do Google (API externa e
 * paga), então uma medida ali refletiria o provedor, não o nosso sistema.
 *
 * Uso:
 *   bun scripts/teste-carga.ts --perfil normal
 *   bun scripts/teste-carga.ts --perfil pico --url https://exemplo.vercel.app
 *   bun scripts/teste-carga.ts --usuarios 30 --duracao 60 --p95 1500 --erro 1
 *
 * Sai com código 0 se os limites forem respeitados, 1 se falharem e 2 se a API
 * não estiver acessível (evita relatório sem sentido).
 *
 * Números locais são indicativos: gerador e servidor disputam a mesma CPU.
 * Para aferição real, rode o gerador em outra máquina apontando `--url`.
 */

/** Perfis prontos — condições normais e muitos usuários simultâneos. */
const PERFIS = {
  normal: { usuarios: 10, duracao: 20, descricao: "operação normal" },
  pico: { usuarios: 50, duracao: 30, descricao: "pico de acessos" },
  estresse: { usuarios: 150, duracao: 30, descricao: "estresse (além do esperado)" },
} as const;

type NomePerfil = keyof typeof PERFIS;

interface Opcoes {
  url: string;
  perfil: NomePerfil;
  usuarios: number;
  duracaoSegundos: number;
  aquecimentoSegundos: number;
  pausaMs: number;
  timeoutMs: number;
  limiteP95: number;
  limiteErroPct: number;
}

interface Cenario {
  nome: string;
  peso: number;
  metodo: "GET" | "POST";
  caminho: string;
  corpo?: string;
}

interface Amostra {
  cenario: string;
  ms: number;
  status: number | null;
  erro?: string;
}

interface Resumo {
  requisicoes: number;
  falhas: number;
  taxaErro: number;
  rps: number;
  latencias: number[];
  status: Record<string, number>;
  erros: Map<string, number>;
}

const PARAGRAFOS_BASE = [
  "A revisão de artigos científicos é uma etapa essencial do processo editorial.",
  "O impacto da norma ABNT no texto acadêmico segundo Silva 2019 é grande  e  visível.",
  "Este parágrafo apresenta a metodologia adotada na pesquisa, com critérios claros de seleção .",
  "Os resultados obtidos apontam para uma melhora significativa na clareza do manuscrito.",
  "A discussão dialoga com a literatura da área e reconhece as limitações do estudo.",
  "Por fim, as considerações finais retomam os objetivos e sugerem trabalhos futuros.",
] as const;

/** Manuscrito sintético com tamanho controlado (mantém violações de regras reais). */
function manuscrito(paragrafos: number): string {
  const partes: string[] = [];
  for (let i = 0; i < paragrafos; i++) {
    partes.push(PARAGRAFOS_BASE[i % PARAGRAFOS_BASE.length]!);
  }
  return partes.join("\n\n");
}

function cenarios(): Cenario[] {
  return [
    {
      nome: "health",
      peso: 15,
      metodo: "GET",
      caminho: "/api/health",
    },
    {
      nome: "revisar/curto",
      peso: 45,
      metodo: "POST",
      caminho: "/api/revisar",
      corpo: JSON.stringify({ texto: manuscrito(3) }),
    },
    {
      nome: "revisar/medio",
      peso: 30,
      metodo: "POST",
      caminho: "/api/revisar",
      corpo: JSON.stringify({ texto: manuscrito(15) }),
    },
    {
      nome: "revisar/longo",
      peso: 10,
      metodo: "POST",
      caminho: "/api/revisar",
      corpo: JSON.stringify({ texto: manuscrito(60) }),
    },
  ];
}

function lerArgumentos(argv: string[]): Opcoes {
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

  const perfil = (valores.get("perfil") ?? "normal") as NomePerfil;
  if (!(perfil in PERFIS)) {
    throw new Error(`Perfil desconhecido: "${perfil}". Use normal, pico ou estresse.`);
  }
  const preset = PERFIS[perfil];

  return {
    url: (valores.get("url") ?? "http://localhost:8787").replace(/\/+$/, ""),
    perfil,
    usuarios: numero(valores.get("usuarios"), preset.usuarios),
    duracaoSegundos: numero(valores.get("duracao"), preset.duracao),
    aquecimentoSegundos: numero(valores.get("aquecimento"), 2),
    pausaMs: numero(valores.get("pausa"), 0),
    timeoutMs: numero(valores.get("timeout"), 10_000),
    limiteP95: numero(valores.get("p95"), 2_000),
    limiteErroPct: numero(valores.get("erro"), 1),
  };
}

function numero(cru: string | undefined, padrao: number): number {
  if (cru === undefined) return padrao;
  const valor = Number(cru);
  if (!Number.isFinite(valor) || valor < 0) throw new Error(`Valor numérico inválido: "${cru}".`);
  return valor;
}

function imprimirAjuda(): void {
  console.log(`Teste de carga — NormaReview AI

Uso: bun scripts/teste-carga.ts [opções]

Opções:
  --perfil <normal|pico|estresse>  Usuários e duração prontos (padrão: normal)
  --usuarios <n>                   Usuários simultâneos (sobrepõe o perfil)
  --duracao <s>                    Duração da medição em segundos (sobrepõe o perfil)
  --url <base>                     Base do sistema (padrão: http://localhost:8787)
  --aquecimento <s>                Segundos de aquecimento, não contabilizados (padrão: 2)
  --pausa <ms>                     Pausa entre requisições de cada usuário (padrão: 0)
  --timeout <ms>                   Limite por requisição (padrão: 10000)
  --p95 <ms>                       Limite de p95 para passar (padrão: 2000)
  --erro <pct>                     Limite de taxa de erro para passar (padrão: 1)
  --ajuda                          Mostra esta ajuda

Perfis:
  normal    ${PERFIS.normal.usuarios} usuários por ${PERFIS.normal.duracao}s — operação normal
  pico      ${PERFIS.pico.usuarios} usuários por ${PERFIS.pico.duracao}s — pico de acessos
  estresse  ${PERFIS.estresse.usuarios} usuários por ${PERFIS.estresse.duracao}s — além do esperado

Exemplos:
  bun run test:carga
  bun run test:carga:pico
  bun scripts/teste-carga.ts --usuarios 30 --duracao 60 --url https://exemplo.vercel.app
`);
}

function percentil(ordenadas: number[], p: number): number {
  if (ordenadas.length === 0) return 0;
  const indice = Math.min(ordenadas.length - 1, Math.max(0, Math.ceil((p / 100) * ordenadas.length) - 1));
  return ordenadas[indice]!;
}

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

function ms(valor: number): string {
  return `${valor.toFixed(1)} ms`;
}

function resumir(amostras: Amostra[], duracaoSegundos: number): Resumo {
  const latencias = amostras.map((a) => a.ms).sort((a, b) => a - b);
  const falhas = amostras.filter((a) => a.erro !== undefined).length;
  const status: Record<string, number> = {};
  const erros = new Map<string, number>();
  for (const a of amostras) {
    const chave = a.status === null ? "sem resposta" : String(a.status);
    status[chave] = (status[chave] ?? 0) + 1;
    if (a.erro) erros.set(a.erro, (erros.get(a.erro) ?? 0) + 1);
  }
  return {
    requisicoes: amostras.length,
    falhas,
    taxaErro: amostras.length === 0 ? 0 : (falhas / amostras.length) * 100,
    rps: duracaoSegundos > 0 ? amostras.length / duracaoSegundos : 0,
    latencias,
    status,
    erros,
  };
}

function linhasResumo(titulo: string, resumo: Resumo): string[] {
  const l = resumo.latencias;
  const linhas = [
    "",
    titulo,
    `  requisições: ${resumo.requisicoes}   throughput: ${resumo.rps.toFixed(1)} req/s   erros: ${resumo.taxaErro.toFixed(2)}%`,
    `  latência: min ${ms(l[0] ?? 0)} · média ${ms(media(l))} · p50 ${ms(percentil(l, 50))} · ` +
      `p90 ${ms(percentil(l, 90))} · p95 ${ms(percentil(l, 95))} · p99 ${ms(percentil(l, 99))} · max ${ms(l[l.length - 1] ?? 0)}`,
    `  respostas: ${
      Object.entries(resumo.status)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([codigo, total]) => `${codigo}: ${total}`)
        .join(" · ") || "nenhuma"
    }`,
  ];
  if (resumo.erros.size > 0) {
    linhas.push("  motivos de falha:");
    for (const [motivo, total] of [...resumo.erros.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      linhas.push(`    - ${motivo}: ${total}`);
    }
  }
  return linhas;
}

/**
 * Executa a carga e devolve as amostras medidas (sem aquecimento). Exportada
 * para permitir verificações automatizadas sem passar pela linha de comando.
 */
export async function executarCarga(opcoes: Opcoes): Promise<{ amostras: Amostra[]; duracaoSegundos: number }> {
  const lista = cenarios();
  const totalPeso = lista.reduce((soma, c) => soma + c.peso, 0);
  const pesoAcumulado: number[] = [];
  let acumulado = 0;
  for (const c of lista) {
    acumulado += c.peso;
    pesoAcumulado.push(acumulado / totalPeso);
  }

  /** Escolha determinística (rotação áurea) para o teste ser reproduzível. */
  function escolher(indice: number): Cenario {
    const alvo = (indice * 0.618033988749895) % 1;
    for (let i = 0; i < lista.length; i++) {
      if (alvo < pesoAcumulado[i]!) return lista[i]!;
    }
    return lista[lista.length - 1]!;
  }

  const amostras: Amostra[] = [];
  const inicio = performance.now();
  const fimAquecimento = inicio + opcoes.aquecimentoSegundos * 1000;
  const fim = fimAquecimento + opcoes.duracaoSegundos * 1000;

  async function umUsuario(id: number): Promise<void> {
    let indice = id;
    while (performance.now() < fim) {
      const cenario = escolher(indice++);
      const t0 = performance.now();
      let status: number | null = null;
      let erro: string | undefined;

      try {
        const resposta = await fetch(opcoes.url + cenario.caminho, {
          method: cenario.metodo,
          headers: cenario.metodo === "POST" ? { "content-type": "application/json" } : undefined,
          body: cenario.corpo,
          signal: AbortSignal.timeout(opcoes.timeoutMs),
        });
        status = resposta.status;
        const texto = await resposta.text();

        if (!resposta.ok) {
          erro = `HTTP ${resposta.status}`;
        } else if (cenario.nome.startsWith("revisar")) {
          // Estabilidade também é resposta correta: o contrato precisa valer sob carga.
          const corpo = JSON.parse(texto) as { resumo?: { total?: unknown }; problemas?: unknown; secoes?: unknown };
          if (typeof corpo.resumo?.total !== "number" || !Array.isArray(corpo.problemas) || !Array.isArray(corpo.secoes)) {
            erro = "resposta fora do contrato";
          }
        } else {
          const corpo = JSON.parse(texto) as { status?: unknown };
          if (corpo.status !== "ok") erro = "resposta fora do contrato";
        }
      } catch (falha) {
        if (status !== null) {
          erro = "resposta fora do contrato"; // resposta recebida, mas ilegível
        } else {
          erro =
            falha instanceof Error && falha.name === "TimeoutError"
              ? `timeout (${opcoes.timeoutMs} ms)`
              : "falha de rede";
        }
      }

      const ms = performance.now() - t0;
      if (performance.now() >= fimAquecimento) {
        amostras.push({ cenario: cenario.nome, ms, status, erro });
      }
      if (opcoes.pausaMs > 0) await Bun.sleep(opcoes.pausaMs);
    }
  }

  await Promise.all(Array.from({ length: opcoes.usuarios }, (_, i) => umUsuario(i + 1)));
  return { amostras, duracaoSegundos: opcoes.duracaoSegundos };
}

/** Relatório completo: geral, por cenário, distribuição de status e estabilidade. */
export function formatarRelatorio(opcoes: Opcoes, amostras: Amostra[], duracaoSegundos: number): {
  texto: string;
  aprovado: boolean;
  motivos: string[];
} {
  const geral = resumir(amostras, duracaoSegundos);
  const motivos: string[] = [];
  const p95 = percentil(geral.latencias, 95);
  if (p95 > opcoes.limiteP95) {
    motivos.push(`p95 ${ms(p95)} acima do limite de ${ms(opcoes.limiteP95)}`);
  }
  if (geral.taxaErro > opcoes.limiteErroPct) {
    motivos.push(`taxa de erro ${geral.taxaErro.toFixed(2)}% acima do limite de ${opcoes.limiteErroPct}%`);
  }

  const linhas: string[] = [];
  linhas.push("=".repeat(78));
  linhas.push("TESTE DE CARGA — NormaReview AI");
  linhas.push(`Sistema: ${opcoes.url}`);
  linhas.push(
    `Carga: ${opcoes.usuarios} usuário(s) simultâneo(s) por ${duracaoSegundos}s ` +
      `(${PERFIS[opcoes.perfil].descricao}; aquecimento de ${opcoes.aquecimentoSegundos}s)`,
  );
  linhas.push("=".repeat(78));

  linhas.push(...linhasResumo("GERAL", geral));
  for (const cenario of cenarios()) {
    const doCenario = amostras.filter((a) => a.cenario === cenario.nome);
    if (doCenario.length > 0) {
      linhas.push(...linhasResumo(`CENÁRIO ${cenario.nome} (${doCenario.length} req)`, resumir(doCenario, duracaoSegundos)));
    }
  }

  // Estabilidade: comparar a latência da primeira com a da segunda metade do
  // teste (na ordem de conclusão), cada metade ordenada à parte.
  const metade = Math.floor(amostras.length / 2);
  const p95Primeira = percentil(amostras.slice(0, metade).map((a) => a.ms).sort((a, b) => a - b), 95);
  const p95Segunda = percentil(amostras.slice(metade).map((a) => a.ms).sort((a, b) => a - b), 95);
  linhas.push("\nESTABILIDADE");
  linhas.push(`  p95 no início: ${ms(p95Primeira)} · p95 no fim: ${ms(p95Segunda)}`);
  if (p95Primeira > 0) {
    const variacao = ((p95Segunda - p95Primeira) / p95Primeira) * 100;
    const leitura =
      variacao > 25
        ? "degradação relevante sob carga sustentada"
        : variacao < -25
          ? "melhora ao longo do teste (aquecimento de caches)"
          : "estável ao longo do teste";
    linhas.push(`  variação: ${variacao >= 0 ? "+" : ""}${variacao.toFixed(1)}% — ${leitura}`);
  }

  linhas.push("\nCRITÉRIOS DE ACEITE");
  linhas.push(`  p95 <= ${opcoes.limiteP95} ms: ${p95 <= opcoes.limiteP95 ? "OK" : "FALHOU"} (${ms(p95)})`);
  linhas.push(
    `  erros <= ${opcoes.limiteErroPct}%: ${geral.taxaErro <= opcoes.limiteErroPct ? "OK" : "FALHOU"} (${geral.taxaErro.toFixed(2)}%)`,
  );

  const aprovado = motivos.length === 0;
  linhas.push(aprovado ? "\nRESULTADO: APROVADO" : `\nRESULTADO: REPROVADO — ${motivos.join("; ")}`);
  return { texto: linhas.join("\n"), aprovado, motivos };
}

/** Pré-checagem: sem API acessível, o relatório não teria significado. */
export async function verificarSistema(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const resposta = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!resposta.ok) return `GET /api/health respondeu HTTP ${resposta.status}`;
    const corpo = (await resposta.json()) as { status?: unknown };
    return corpo.status === "ok" ? null : "GET /api/health respondeu fora do contrato";
  } catch {
    return `não foi possível alcançar ${url}/api/health`;
  }
}

async function principal(): Promise<void> {
  let opcoes: Opcoes;
  try {
    opcoes = lerArgumentos(process.argv.slice(2));
  } catch (erro) {
    console.error(`Erro: ${erro instanceof Error ? erro.message : String(erro)}`);
    console.error("Use --ajuda para ver as opções.");
    process.exit(2);
  }

  if (opcoes.usuarios < 1) {
    console.error("Erro: --usuarios precisa ser pelo menos 1.");
    process.exit(2);
  }

  const problema = await verificarSistema(opcoes.url, opcoes.timeoutMs);
  if (problema) {
    console.error(`Sistema indisponível: ${problema}.`);
    console.error("Suba a API antes do teste: bun run api (e bun run dev, se quiser testar pelo front).");
    process.exit(2);
  }

  console.log(`Iniciando teste de carga: ${opcoes.usuarios} usuários simultâneos por ${opcoes.duracaoSegundos}s…`);
  if (opcoes.aquecimentoSegundos > 0) console.log(`Aquecimento: ${opcoes.aquecimentoSegundos}s (não contabilizados).`);

  const { amostras, duracaoSegundos } = await executarCarga(opcoes);
  const { texto, aprovado } = formatarRelatorio(opcoes, amostras, duracaoSegundos);
  console.log(`\n${texto}`);
  process.exit(aprovado ? 0 : 1);
}

if (import.meta.main) {
  await principal();
}
