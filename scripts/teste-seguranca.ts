/**
 * Teste de segurança — busca brechas, falhas de autenticação e exposição de
 * dados no projeto e na API em execução.
 *
 * Duas fases:
 *
 * 1. ESTÁTICA (não precisa de servidor): procura segredos embutidos no código,
 *    no bundle (`dist/`, quando existir), arquivos `.env` versionados por
 *    engano e variáveis sensíveis com prefixo `VITE_` (que iriam para o
 *    navegador).
 *
 * 2. DINÂMICA (precisa da API no ar, `bun run api`): verifica
 *    - autenticação do /api/gemini (sem token, token forjado, token malformado);
 *    - CORS (o /api/gemini não pode liberar origem cruzada; o /api/revisar é
 *      público e é sinalizado como baixo quando usa `*`);
 *    - cabeçalhos de segurança do front (`--front`) e vazamento de versão;
 *    - limites de corpo e validação (JSON inválido, aninhamento profundo);
 *    - vazamento de informação nas respostas (stack trace, caminhos, chaves);
 *    - travessia de caminho (`/api/../.env` etc.) e métodos não permitidos;
 *    - indício de ausência de limitação de taxa no endpoint público.
 *
 * As verificações são passivas e de baixo volume (nenhum ataque destrutivo,
 * nenhuma exaustão de recursos). Achados são classificados em critico, alto,
 * medio, baixo ou ok; o comando falha quando algum achado alcança o rigor
 * escolhido (`--rigor`, padrão: alto).
 *
 * Uso:
 *   bun scripts/teste-seguranca.ts --somente-estatico
 *   bun scripts/teste-seguranca.ts --front http://localhost:5173
 *   bun scripts/teste-seguranca.ts --url https://exemplo.vercel.app --rigor medio
 *
 * Saída: 0 sem achados no rigor, 1 com achado no rigor, 2 setup inválido/API
 * inacessível no modo completo.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

type Severidade = "ok" | "baixo" | "medio" | "alto" | "critico";

interface Achado {
  severidade: Severidade;
  verificacao: string;
  detalhe: string;
}

interface Opcoes {
  url: string;
  front: string | null;
  rigor: Exclude<Severidade, "ok">;
  somenteEstatico: boolean;
  timeoutMs: number;
}

const PESO: Record<Severidade, number> = { ok: 0, baixo: 1, medio: 2, alto: 3, critico: 4 };
const ROTULO: Record<Severidade, string> = {
  ok: "OK",
  baixo: "BAIXO",
  medio: "MÉDIO",
  alto: "ALTO",
  critico: "CRÍTICO",
};

const achados: Achado[] = [];

function registrar(severidade: Severidade, verificacao: string, detalhe: string): void {
  achados.push({ severidade, verificacao, detalhe });
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

  const rigor = (valores.get("rigor") ?? "alto") as Opcoes["rigor"];
  if (!(rigor in PESO) || rigor === "ok") {
    throw new Error(`Rigor inválido: "${rigor}". Use critico, alto, medio ou baixo.`);
  }

  return {
    url: (valores.get("url") ?? "http://localhost:8787").replace(/\/+$/, ""),
    front: valores.get("front") ? valores.get("front")!.replace(/\/+$/, "") : null,
    rigor,
    somenteEstatico: valores.has("somente-estatico"),
    timeoutMs: Number(valores.get("timeout") ?? 10_000),
  };
}

function imprimirAjuda(): void {
  console.log(`Teste de segurança — NormaReview AI

Uso: bun scripts/teste-seguranca.ts [opções]

Opções:
  --url <base>          Base da API (padrão: http://localhost:8787)
  --front <base>        Base do app para checar cabeçalhos de segurança
  --rigor <nível>       Falha a partir de critico, alto (padrão), medio ou baixo
  --somente-estatico    Só varredura de segredos/arquivos, sem chamar a API
  --timeout <ms>        Tempo limite por requisição (padrão: 10000)
  --ajuda               Mostra esta ajuda

Exemplos:
  bun run test:seguranca --somente-estatico
  bun scripts/teste-seguranca.ts --front http://localhost:5173
  bun scripts/teste-seguranca.ts --url https://exemplo.vercel.app --rigor medio
`);
}

/* ------------------------------ fase estática ------------------------------ */

const DIRETORIOS = ["src", "api", "server", "scripts", "tests", "dist"];
const ARQUIVOS_RAIZ = ["index.html", "vite.config.ts", "vercel.json", "package.json", ".env.example"];
const EXTENSOES = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".html", ".css"]);

const PADROES_SEGREDO: { nome: string; regex: RegExp; severidade: Severidade }[] = [
  { nome: "chave do Google/Gemini (AIza…)", regex: /\bAIza[0-9A-Za-z_-]{35}\b/g, severidade: "critico" },
  { nome: "chave OpenAI (sk-…)", regex: /\bsk-[A-Za-z0-9]{20,}\b/g, severidade: "critico" },
  { nome: "chave privada PEM", regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, severidade: "critico" },
  { nome: "token do GitHub (ghp_/gho_…)", regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, severidade: "critico" },
  { nome: "credencial AWS (AKIA…)", regex: /\bAKIA[0-9A-Z]{16}\b/g, severidade: "critico" },
];

async function arquivosParaVarrer(): Promise<string[]> {
  const arquivos: string[] = [];
  for (const diretorio of DIRETORIOS) {
    try {
      const entradas = await readdir(diretorio, { recursive: true, withFileTypes: true });
      for (const entrada of entradas) {
        if (!entrada.isFile()) continue;
        if (!EXTENSOES.has(extname(entrada.name))) continue;
        const caminho = join(entrada.parentPath ?? diretorio, entrada.name);
        arquivos.push(caminho);
      }
    } catch {
      // diretório ausente (ex.: dist/ antes do build): nada a varrer
    }
  }
  for (const nome of ARQUIVOS_RAIZ) arquivos.push(nome);
  return arquivos;
}

function linhaDe(texto: string, indice: number): number {
  return texto.slice(0, indice).split("\n").length;
}

async function varrerSegredos(): Promise<void> {
  const arquivos = await arquivosParaVarrer();
  let encontrados = 0;

  for (const caminho of arquivos) {
    let conteudo: string;
    try {
      conteudo = await readFile(caminho, "utf8");
    } catch {
      continue;
    }
    if (conteudo.includes("\u0000")) continue; // binário

    for (const padrao of PADROES_SEGREDO) {
      padrao.regex.lastIndex = 0;
      for (const casamento of conteudo.matchAll(padrao.regex)) {
        encontrados++;
        registrar(
          padrao.severidade,
          `Segredo embutido em ${caminho}`,
          `${padrao.nome} na linha ${linhaDe(conteudo, casamento.index ?? 0)}`,
        );
      }
    }

    // Variável sensível com prefixo VITE_ vai para o bundle do navegador.
    // `[ \t]` (e não `\s`) para não capturar a linha seguinte quando o valor
    // está vazio, como no .env.example.
    for (const casamento of conteudo.matchAll(/^[ \t]*(VITE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD))[ \t]*=[ \t]*([^\s#]+)/gm)) {
      const valor = casamento[2]!;
      if (valor.length === 0) continue;
      encontrados++;
      registrar(
        "alto",
        `Variável sensível exposta ao cliente em ${caminho}`,
        `${casamento[1]} na linha ${linhaDe(conteudo, casamento.index ?? 0)} — use nome sem prefixo VITE_`,
      );
    }
  }

  if (encontrados === 0) {
    registrar("ok", "Segredos embutidos no código/bundle", `${arquivos.length} arquivo(s) varrido(s), nenhum segredo reconhecível`);
  }
}

async function checarArquivosEnv(): Promise<void> {
  // .env versionado é vazamento de credenciais: o .gitignore precisa cobri-lo.
  let gitignore = "";
  try {
    gitignore = await readFile(".gitignore", "utf8");
  } catch {
    registrar("alto", "Arquivo .gitignore", "não encontrado — .env pode ser versionado por engano");
    return;
  }
  const cobre = /^\.env(?:\.\*|$|\/)/m.test(gitignore) || /^\.env\*$/m.test(gitignore);
  registrar(
    cobre ? "ok" : "alto",
    "Arquivo .gitignore",
    cobre ? "cobre .env e variações" : "não cobre .env — risco de commitar credenciais",
  );

  const git = Bun.spawnSync(["git", "ls-files"], { stdout: "pipe", stderr: "pipe" });
  if (git.exitCode !== 0) {
    registrar("baixo", "Arquivos .env versionados", "não foi possível consultar o git neste ambiente");
    return;
  }
  const versionados = git.stdout
    .toString()
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => /(^|\/)\.env(\..+)?$/.test(linha) && !linha.endsWith(".env.example"));
  registrar(
    versionados.length === 0 ? "ok" : "critico",
    "Arquivos .env versionados",
    versionados.length === 0 ? "nenhum .env no git" : `versionado(s): ${versionados.join(", ")}`,
  );
}

/* ------------------------------ fase dinâmica ------------------------------ */

interface Resposta {
  status: number;
  corpo: string;
  cabecalhos: Headers;
}

async function requisitar(
  base: string,
  caminho: string,
  init: RequestInit = {},
  timeoutMs: number,
): Promise<Resposta | null> {
  try {
    const resposta = await fetch(base + caminho, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: resposta.status, corpo: await resposta.text(), cabecalhos: resposta.headers };
  } catch {
    return null;
  }
}

function json(corpo: string): Record<string, unknown> | null {
  try {
    const valor: unknown = JSON.parse(corpo);
    return typeof valor === "object" && valor !== null ? (valor as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function codigoErro(corpo: string): string | null {
  const dados = json(corpo) as { erro?: { codigo?: unknown } } | null;
  return typeof dados?.erro?.codigo === "string" ? dados.erro.codigo : null;
}

function ehJwtForjado(): string {
  const b64 = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString("base64url");
  const agora = Math.floor(Date.now() / 1000);
  return [
    b64({ alg: "none", typ: "JWT" }),
    b64({
      aud: "projeto-invasor",
      iss: "https://securetoken.google.com/projeto-invasor",
      sub: "invasor",
      iat: agora,
      auth_time: agora,
      exp: agora + 3600,
    }),
    "",
  ].join(".");
}

const XSS = "<script>alert('xss')</script>";
const JSON_HEADERS = { "content-type": "application/json" };

async function checarCabecalhos(opcoes: Opcoes): Promise<void> {
  const saude = await requisitar(opcoes.url, "/api/health", {}, opcoes.timeoutMs);
  if (!saude) {
    registrar("critico", "Disponibilidade da API", `sem resposta em ${opcoes.url}/api/health`);
    return;
  }
  registrar("ok", "Disponibilidade da API", `GET /api/health → ${saude.status}`);

  const tipo = saude.cabecalhos.get("content-type") ?? "";
  registrar(
    tipo.includes("application/json") ? "ok" : "medio",
    "Content-Type da API",
    tipo.length > 0 ? tipo : "ausente — navegador pode interpretar como HTML",
  );

  const servidor = [...saude.cabecalhos.entries()]
    .filter(([chave]) => /^(server|x-powered-by|x-aspnet-version)$/i.test(chave))
    .map(([chave, valor]) => `${chave}: ${valor}`)
    .join(" · ");
  const revelaVersao = /\d+\.\d+/.test(servidor);
  registrar(
    revelaVersao ? "baixo" : "ok",
    "Vazamento de versão do servidor",
    servidor.length === 0 ? "sem cabeçalho de servidor" : servidor,
  );

  if (opcoes.front === null) {
    registrar("baixo", "Cabeçalhos de segurança do front", "não verificado — use --front para avaliar o app");
    return;
  }

  const pagina = await requisitar(opcoes.front, "/", {}, opcoes.timeoutMs);
  if (!pagina) {
    registrar("medio", "Cabeçalhos de segurança do front", `sem resposta em ${opcoes.front}/`);
    return;
  }
  const esperados: { chave: string; rotulo: string }[] = [
    { chave: "content-security-policy", rotulo: "CSP (mitiga XSS/injeção)" },
    { chave: "x-content-type-options", rotulo: "X-Content-Type-Options: nosniff" },
    { chave: "x-frame-options", rotulo: "X-Frame-Options (clickjacking)" },
    { chave: "referrer-policy", rotulo: "Referrer-Policy" },
    { chave: "permissions-policy", rotulo: "Permissions-Policy" },
  ];
  const ausentes = esperados.filter((item) => !pagina.cabecalhos.get(item.chave)).map((item) => item.rotulo);
  if (ausentes.length === 0) {
    registrar("ok", "Cabeçalhos de segurança do front", "CSP, nosniff, anti-clickjacking e políticas presentes");
  } else {
    const temCspFrame = (pagina.cabecalhos.get("content-security-policy") ?? "").includes("frame-ancestors");
    const semAnticlick = ausentes.some((rotulo) => rotulo.includes("X-Frame")) && !temCspFrame;
    registrar(
      semAnticlick ? "alto" : "medio",
      "Cabeçalhos de segurança do front",
      `ausentes: ${ausentes.join(", ")}`,
    );
  }
  if (opcoes.front.startsWith("https://") && !pagina.cabecalhos.get("strict-transport-security")) {
    registrar("medio", "HSTS no front", "site HTTPS sem Strict-Transport-Security");
  }
}

async function checarCors(opcoes: Opcoes): Promise<void> {
  const origem = "https://invasor.example";
  const revisar = await requisitar(
    opcoes.url,
    "/api/revisar",
    { method: "OPTIONS", headers: { origin: origem, "access-control-request-method": "POST" } },
    opcoes.timeoutMs,
  );
  const acao = revisar?.cabecalhos.get("access-control-allow-origin") ?? null;
  registrar(
    acao === null ? "ok" : "baixo",
    "CORS em /api/revisar",
    acao === "*"
      ? "libera qualquer origem (*) — endpoint é público, mas permite consumo por sites de terceiros"
      : acao === null
        ? "sem liberação de origem cruzada"
        : `origem liberada: ${acao}`,
  );

  const gemini = await requisitar(
    opcoes.url,
    "/api/gemini",
    { method: "GET", headers: { origin: origem } },
    opcoes.timeoutMs,
  );
  const acaoGemini = gemini?.cabecalhos.get("access-control-allow-origin") ?? null;
  registrar(
    acaoGemini === null ? "ok" : "alto",
    "CORS em /api/gemini",
    acaoGemini === null ? "sem CORS — rota autenticada só na mesma origem" : `libera ${acaoGemini} para rota autenticada`,
  );
}

async function checarAutenticacao(opcoes: Opcoes): Promise<void> {
  const semToken = await requisitar(opcoes.url, "/api/gemini", { method: "POST", headers: JSON_HEADERS, body: "{}" }, opcoes.timeoutMs);
  if (!semToken) {
    registrar("alto", "Autenticação do /api/gemini", "sem resposta ao POST sem token");
    return;
  }
  if (semToken.status === 503) {
    registrar(
      "baixo",
      "Autenticação do /api/gemini",
      "não testável: Gemini sem GEMINI_API_KEY no servidor (responde 503 antes do login)",
    );
    return;
  }
  registrar(
    semToken.status === 401 && codigoErro(semToken.corpo) === "nao_autenticado" ? "ok" : "critico",
    "Autenticação do /api/gemini",
    `sem token → ${semToken.status} ${codigoErro(semToken.corpo) ?? "sem código"}`,
  );

  const forjado = ehJwtForjado();
  const invasao = await requisitar(
    opcoes.url,
    "/api/gemini",
    { method: "POST", headers: { ...JSON_HEADERS, authorization: `Bearer ${forjado}` }, body: JSON.stringify({ paragrafos: [{ index: 1, texto: XSS }] }) },
    opcoes.timeoutMs,
  );
  const statusForjado = invasao?.status ?? 0;
  const codigoForjado = invasao ? codigoErro(invasao.corpo) : null;
  const aceitouForjado = statusForjado === 200;
  registrar(
    aceitouForjado ? "critico" : statusForjado === 401 ? "ok" : "alto",
    "Token JWT forjado (alg none)",
    `→ ${statusForjado} ${codigoForjado ?? "sem código"}${aceitouForjado ? " (aceito indevidamente!)" : ""}`,
  );

  const malformado = await requisitar(
    opcoes.url,
    "/api/gemini",
    { method: "POST", headers: { ...JSON_HEADERS, authorization: "Bearer abc" }, body: "{}" },
    opcoes.timeoutMs,
  );
  const statusMalformado = malformado?.status ?? 0;
  registrar(
    statusMalformado === 401 ? "ok" : statusMalformado === 200 ? "critico" : "alto",
    "Token malformado",
    `→ ${statusMalformado} ${malformado ? codigoErro(malformado.corpo) ?? "sem código" : "sem resposta"}`,
  );

  const get = await requisitar(opcoes.url, "/api/gemini", { method: "GET" }, opcoes.timeoutMs);
  const dadosGet = get ? json(get.corpo) : null;
  const chaves = dadosGet ? Object.keys(dadosGet) : [];
  const vaza = get !== null && /AIza[0-9A-Za-z_-]{35}|GEMINI_API_KEY/.test(get.corpo);
  registrar(
    vaza ? "critico" : chaves.length === 1 && chaves[0] === "configurado" ? "ok" : "medio",
    "Exposição de configuração do /api/gemini",
    vaza ? "a resposta contém chave/segredo!" : `campos expostos: ${chaves.join(", ") || "nenhum"}`,
  );
}

async function checarValidacao(opcoes: Opcoes): Promise<void> {
  const grande = JSON.stringify({ texto: "a".repeat(70 * 1024) });
  const respostaGrande = await requisitar(
    opcoes.url,
    "/api/revisar",
    { method: "POST", headers: JSON_HEADERS, body: grande },
    opcoes.timeoutMs,
  );
  registrar(
    respostaGrande && (respostaGrande.status === 400 || respostaGrande.status === 413) ? "ok" : "alto",
    "Limite de corpo do /api/revisar",
    `${respostaGrande?.status ?? 0} ${respostaGrande ? codigoErro(respostaGrande.corpo) ?? "" : "sem resposta"}`.trim(),
  );

  const invalido = await requisitar(
    opcoes.url,
    "/api/revisar",
    { method: "POST", headers: JSON_HEADERS, body: "{invalido" },
    opcoes.timeoutMs,
  );
  registrar(
    invalido?.status === 400 ? "ok" : "alto",
    "JSON inválido no /api/revisar",
    `${invalido?.status ?? 0} ${invalido ? codigoErro(invalido.corpo) ?? "" : "sem resposta"}`.trim(),
  );

  // Aninhamento profundo: não pode derrubar a API nem virar 500.
  let profundo = "1";
  for (let i = 0; i < 2_000; i++) profundo = `[${profundo}]`;
  const aninhado = await requisitar(
    opcoes.url,
    "/api/revisar",
    { method: "POST", headers: JSON_HEADERS, body: `{"texto":${profundo}}` },
    opcoes.timeoutMs,
  );
  registrar(
    aninhado && aninhado.status < 500 ? "ok" : "alto",
    "JSON profundamente aninhado",
    aninhado ? `HTTP ${aninhado.status}` : "sem resposta (servidor pode ter caído)",
  );

  const textoXss = JSON.stringify({ texto: `${XSS}\n\nTexto normal.` });
  const reflexo = await requisitar(
    opcoes.url,
    "/api/revisar",
    { method: "POST", headers: JSON_HEADERS, body: textoXss },
    opcoes.timeoutMs,
  );
  const tipo = reflexo?.cabecalhos.get("content-type") ?? "";
  registrar(
    reflexo && reflexo.status === 200 && tipo.includes("application/json") ? "ok" : "medio",
    "Entrada com HTML/script",
    `HTTP ${reflexo?.status ?? 0} · content-type: ${tipo || "ausente"} (resposta não deve ser HTML)`,
  );

  const trace = await requisitar(opcoes.url, "/api/health", { method: "TRACE" }, opcoes.timeoutMs);
  registrar(
    trace && trace.status !== 200 ? "ok" : "medio",
    "Método TRACE",
    trace ? `HTTP ${trace.status}` : "sem resposta",
  );
}

async function checarTravessiaEInjecao(opcoes: Opcoes): Promise<void> {
  const caminhos = ["/api/../.env", "/api/health/../../.env", "/%2e%2e/%2e%2e/.env", "/api/..%2f..%2f.env"];
  const vazou: string[] = [];
  for (const caminho of caminhos) {
    const resposta = await requisitar(opcoes.url, caminho, {}, opcoes.timeoutMs);
    if (!resposta) continue;
    if (/GEMINI_API_KEY\s*=|VITE_FIREBASE_API_KEY\s*=|BEGIN (?:RSA )?PRIVATE KEY/.test(resposta.corpo)) {
      vazou.push(`${caminho} (HTTP ${resposta.status})`);
    }
  }
  registrar(
    vazou.length === 0 ? "ok" : "critico",
    "Travessia de caminho até arquivos .env",
    vazou.length === 0 ? `${caminhos.length} variantes testadas, nenhum segredo servido` : `vazou: ${vazou.join(", ")}`,
  );

  const desconhecida = await requisitar(opcoes.url, "/api/rota-inexistente", {}, opcoes.timeoutMs);
  const corpoDesconhecida = desconhecida?.corpo ?? "";
  registrar(
    desconhecida && desconhecida.status === 404 && !/(stack|node_modules|\/home\/|\.ts:\d+)/.test(corpoDesconhecida)
      ? "ok"
      : "alto",
    "Rota inexistente",
    desconhecida ? `HTTP ${desconhecida.status}${/(stack|node_modules|\/home\/|\.ts:\d+)/.test(corpoDesconhecida) ? " com rastro interno" : " sem rastro interno"}` : "sem resposta",
  );
}

/** Percorre as respostas coletadas procurando stack trace/caminho de servidor. */
async function checarVazamentoNasRespostas(opcoes: Opcoes): Promise<void> {
  const gatilhos: { nome: string; init: RequestInit }[] = [
    { nome: "JSON inválido", init: { method: "POST", headers: JSON_HEADERS, body: "{" } },
    { nome: "campo ausente", init: { method: "POST", headers: JSON_HEADERS, body: "{}" } },
    { nome: "método errado", init: { method: "DELETE" } },
    { nome: "rota inexistente", init: { method: "GET" } },
  ];
  const rastro = /(?:^|\n)\s*at\s+[\w$.<>]+\s+\(|node_modules|\/home\/[\w-]+\/|\.ts:\d+:\d+/;
  const vazando: string[] = [];
  for (const gatilho of gatilhos) {
    const caminho = gatilho.nome === "rota inexistente" ? "/api/nao-existe" : "/api/revisar";
    const resposta = await requisitar(opcoes.url, caminho, gatilho.init, opcoes.timeoutMs);
    if (resposta && rastro.test(resposta.corpo)) vazando.push(gatilho.nome);
  }
  registrar(
    vazando.length === 0 ? "ok" : "critico",
    "Vazamento de stack trace/caminho nas respostas",
    vazando.length === 0 ? "nenhum rastro interno em erros" : `rastro interno em: ${vazando.join(", ")}`,
  );
}

async function checarLimiteDeTaxa(opcoes: Opcoes): Promise<void> {
  const amostras = 40;
  let bloqueadas = 0;
  let erros = 0;
  const corpo = JSON.stringify({ texto: "Texto de teste. A norma ABNT é importante.\n\nSegundo parágrafo." });
  for (let i = 0; i < amostras; i++) {
    const resposta = await requisitar(
      opcoes.url,
      "/api/revisar",
      { method: "POST", headers: JSON_HEADERS, body: corpo },
      opcoes.timeoutMs,
    );
    if (!resposta) {
      erros++;
      continue;
    }
    if (resposta.status === 429) bloqueadas++;
  }
  registrar(
    bloqueadas > 0 ? "ok" : "medio",
    "Limitação de taxa no /api/revisar",
    bloqueadas > 0
      ? `${bloqueadas}/${amostras} requisições bloqueadas (429)`
      : `${amostras} requisições seguidas sem 429 — sem throttling aparente no endpoint público`,
  );
  if (erros > 0) {
    registrar("alto", "Estabilidade sob requisições repetidas", `${erros}/${amostras} sem resposta`);
  }
}

/* --------------------------------- relatório -------------------------------- */

function imprimirRelatorio(opcoes: Opcoes): boolean {
  const ordenados = [...achados].sort((a, b) => PESO[b.severidade] - PESO[a.severidade]);
  const contagem = ordenados.reduce<Record<string, number>>((acc, achado) => {
    acc[achado.severidade] = (acc[achado.severidade] ?? 0) + 1;
    return acc;
  }, {});

  const linhas: string[] = [];
  linhas.push("=".repeat(84));
  linhas.push("TESTE DE SEGURANÇA — NormaReview AI");
  linhas.push(`API: ${opcoes.url}${opcoes.front ? ` · Front: ${opcoes.front}` : " · Front: não verificado"}`);
  linhas.push(`Modo: ${opcoes.somenteEstatico ? "somente estático" : "estático + dinâmico"} · Rigor: ${opcoes.rigor}`);
  linhas.push("=".repeat(84));
  linhas.push("");
  linhas.push("VERIFICAÇÕES");
  for (const achado of ordenados) {
    linhas.push(`  [${ROTULO[achado.severidade].padEnd(7)}] ${achado.verificacao}`);
    linhas.push(`            ${achado.detalhe}`);
  }

  const graves = ordenados.filter(
    (achado) => achado.severidade !== "ok" && PESO[achado.severidade] >= PESO[opcoes.rigor],
  );

  linhas.push("");
  linhas.push("RESUMO");
  linhas.push(
    `  ${achados.length} verificação(ões) · ` +
      `critico ${contagem.critico ?? 0} · alto ${contagem.alto ?? 0} · medio ${contagem.medio ?? 0} · ` +
      `baixo ${contagem.baixo ?? 0} · ok ${contagem.ok ?? 0}`,
  );

  linhas.push("");
  linhas.push("RESULTADO");
  if (graves.length === 0) {
    linhas.push(`  APROVADO — nenhum achado em nível ${opcoes.rigor} ou acima.`);
  } else {
    linhas.push(`  REPROVADO — ${graves.length} achado(s) em nível ${opcoes.rigor} ou acima:`);
    for (const achado of graves) {
      linhas.push(`    - [${ROTULO[achado.severidade]}] ${achado.verificacao}: ${achado.detalhe}`);
    }
  }

  console.log(linhas.join("\n"));
  return graves.length === 0;
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

  console.log("Varrendo o código em busca de segredos e arquivos sensíveis…");
  await varrerSegredos();
  await checarArquivosEnv();

  if (!opcoes.somenteEstatico) {
    const saude = await requisitar(opcoes.url, "/api/health", {}, opcoes.timeoutMs);
    if (!saude || saude.status !== 200) {
      console.error(`API inacessível em ${opcoes.url}/api/health.`);
      console.error("Suba a API (bun run api) ou use --somente-estatico.");
      imprimirRelatorio(opcoes);
      process.exit(2);
    }

    console.log("Executando verificações dinâmicas na API…");
    await checarCabecalhos(opcoes);
    await checarCors(opcoes);
    await checarAutenticacao(opcoes);
    await checarValidacao(opcoes);
    await checarTravessiaEInjecao(opcoes);
    await checarVazamentoNasRespostas(opcoes);
    await checarLimiteDeTaxa(opcoes);
  }

  const aprovado = imprimirRelatorio(opcoes);
  process.exit(aprovado ? 0 : 1);
}

if (import.meta.main) {
  await principal();
}
