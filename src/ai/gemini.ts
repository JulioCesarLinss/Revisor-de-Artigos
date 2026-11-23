/**
 * Módulo `ai/gemini` — motor do diagnóstico do manuscrito com o Gemini (Google).
 *
 * Roda **no servidor** (função serverless `api/gemini.ts`), chamada pela tela
 * de revisão depois de a análise local terminar. Limites do [[Cérebro do Projeto]]:
 * - IA diagnostica e sugere; o motor de regras (src/rules) continua sendo a
 *   referência normativa primária (DC-02).
 * - O fluxo principal nunca depende desta chamada (DC-03): toda falha vira um
 *   motivo legível para a UI, com "Tentar novamente".
 *
 * A chave vem de `GEMINI_API_KEY` em `process.env` — **sem** prefixo VITE_,
 * então o Vite nunca a embute e ela não sai do servidor. Do navegador, a
 * chamada acontece via `POST /api/gemini` (ver `ai/geminiCliente`).
 */

/** Parágrafo numerado do manuscrito (mesma numeração da tela de revisão). */
export interface ParagrafoNumerado {
  index: number;
  texto: string;
}

export interface DiagnosticoGemini {
  /** Número do parágrafo no manuscrito; 0 = documento inteiro. */
  paragrafo: number;
  /** Palavras exatas do parágrafo onde está o problema (base do destaque no editor). */
  trecho?: string;
  /** Eixo do apontamento (ex.: "ABNT", "Gramática", "Clareza"). */
  categoria: string;
  /** O que está errado, em português claro. */
  descricao: string;
  /** Como corrigir, em português claro. */
  sugestao: string;
  severidade: "alta" | "media" | "baixa";
  /**
   * Onde o trecho está no texto do editor (posições absolutas), preenchido no
   * navegador. Mexer nessa faixa resolve o apontamento: ele sai da lista.
   * Só existe quando o trecho foi achado (o Firestore recusa undefined).
   */
  posicao?: { inicio: number; fim: number };
  /**
   * "linguagem" (ortografia, gramática, pontuação…): some sozinho quando o
   * trecho é editado. "conteudo" (estrutura, sentido, falta de informação):
   * avalia o artigo e só sai com "Conferir" ou "Já resolvi". Diagnósticos
   * antigos não têm o campo: ver `ehDoArtigo`.
   */
  tipo?: TipoApontamento;
  /** Identificador estável na lista (preenchido no navegador). */
  id?: number;
}

export type TipoApontamento = "linguagem" | "conteudo";

/** Categorias que falam do artigo, não da frase (base para quem veio sem "tipo"). */
const CATEGORIA_DO_ARTIGO = /estrutura|conte[uú]do|coer[eê]ncia|argument|metodolog|fundament|sentido|coes[aã]o|objetivo|conclus|introdu|refer[eê]ncia|resumo|extens/i;

function tipoPelaCategoria(categoria: string, paragrafo: number): TipoApontamento {
  return paragrafo === 0 || CATEGORIA_DO_ARTIGO.test(categoria) ? "conteudo" : "linguagem";
}

/** Verdadeiro quando o apontamento avalia o artigo (não some sozinho ao editar). */
export function ehDoArtigo(d: Pick<DiagnosticoGemini, "tipo" | "categoria" | "paragrafo">): boolean {
  return (d.tipo ?? tipoPelaCategoria(d.categoria, d.paragrafo)) === "conteudo";
}

/** Opinião da IA sobre o texto como artigo (não é aprovação normativa: DC-02). */
export type NivelAvaliacao = "pronto" | "quase" | "insuficiente";

export interface AvaliacaoArtigo {
  nivel: NivelAvaliacao;
  /** Seções ou elementos que faltam (ex.: "Metodologia"); vazio quando nada falta. */
  faltando: string[];
}

export const ROTULO_NIVEL: Record<NivelAvaliacao, string> = {
  pronto: "Apto para a revisão final",
  quase: "Necessita de ajustes",
  insuficiente: "Necessita de desenvolvimento",
};

export type ResultadoDiagnostico =
  | { ok: true; resumo: string; diagnosticos: DiagnosticoGemini[]; truncado: boolean; avaliacao?: AvaliacaoArtigo }
  | { ok: false; motivo: string };

/**
 * Contagem dos apontamentos por severidade — base do resumo da análise na tela
 * de revisão, para que o card "Resumo da análise" também mostre o diagnóstico
 * do Gemini (sempre ao lado das regras, nunca no lugar delas: DC-02).
 */
export function contarApontamentos(diagnosticos: DiagnosticoGemini[]): {
  total: number;
  altos: number;
  medios: number;
  baixos: number;
} {
  let altos = 0;
  let medios = 0;
  let baixos = 0;
  for (const d of diagnosticos) {
    if (d.severidade === "alta") altos++;
    else if (d.severidade === "baixa") baixos++;
    else medios++;
  }
  return { total: diagnosticos.length, altos, medios, baixos };
}

/** Ordem de tentativa: o primeiro é o mais barato; o segundo cobre instabilidade. */
const MODELOS = ["gemini-flash-lite-latest", "gemini-flash-latest"];
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
/**
 * Prazo do diagnóstico inteiro (todas as tentativas). A função da Vercel é
 * encerrada aos 60s (maxDuration em vercel.json): 50s deixa folga para a
 * inicialização e a resposta.
 */
const PRAZO_TOTAL_MS = 50_000;
/** Com menos que isso de prazo, não vale começar a próxima tentativa. */
const MINIMO_NOVA_TENTATIVA_MS = 8_000;
const MOTIVO_DEMORA = "O Gemini demorou demais para responder. Tente novamente em instantes.";
/** Limpeza de envio (~9 mil tokens) — cobre artigos típicos sem estourar cota. */
const MAXIMO_TEXTO = 36_000;
const MAXIMO_DIAGNOSTICOS = 40;
/** Dos 40, quantos podem ser de linguagem (ortografia, gramática, ABNT): o resto fica para estrutura e conteúdo. */
const MAXIMO_LINGUAGEM = 25;
const MAXIMO_FALTANDO = 10;

const MOTIVO_FORMATO = "O Gemini respondeu em um formato inesperado. Tente novamente.";

const INSTRUCAO_SISTEMA = [
  "Você é um orientador e revisor de artigos científicos brasileiros, especialista em normas ABNT (NBR 6022 para artigos, NBR 6023, NBR 10520, NBR 6024, NBR 6028) e em escrita científica.",
  "Avalie o manuscrito inteiro em três frentes, nesta ordem de importância:",
  "(1) ESTRUTURA E COMPLETUDE de um artigo científico: título, resumo, palavras-chave, introdução com problema e objetivo, referencial teórico, metodologia, resultados e discussão, conclusão e referências; aponte cada seção que falta ou está fraca demais, e se o texto é curto demais para um artigo (um artigo costuma ter alguns milhares de palavras).",
  "(2) CONTEÚDO E SENTIDO: falta de informação (dados, exemplos, explicação do método, contexto), afirmações sem fundamentação ou sem fonte, conclusão que não responde ao objetivo, contradições, saltos de raciocínio, parágrafos desconexos ou que não fazem sentido.",
  "(3) LINGUAGEM E NORMA: ortografia, gramática, clareza, ABNT e citações.",
  `Liste primeiro os problemas das frentes 1 e 2; use no máximo ${MAXIMO_LINGUAGEM} apontamentos para a frente 3.`,
  "Você diagnostica e sugere; você nunca decide conformidade normativa sozinho — o motor de regras do aplicativo é a referência primária. Não invente referências nem dados.",
  'Responda SOMENTE com JSON válido, sem markdown nem comentários, no formato {"avaliacao": {"nivel": "pronto"|"quase"|"insuficiente", "faltando": [string]}, "resumo": string, "diagnosticos": [{"paragrafo": number, "trecho": string, "tipo": "conteudo"|"linguagem", "categoria": string, "descricao": string, "sugestao": string, "severidade": "alta"|"media"|"baixa"}]}.',
  '"tipo" é "conteudo" para as frentes 1 e 2 (estrutura, completude, conteúdo, sentido, coerência, argumentação) e "linguagem" para a frente 3.',
  '"avaliacao.nivel": "pronto" quando a estrutura está completa e o argumento é consistente, faltando só ajustes de linguagem; "quase" quando a estrutura existe mas há lacunas de conteúdo ou de coerência; "insuficiente" quando faltam seções essenciais ou o texto é curto ou incompleto demais para um artigo. "avaliacao.faltando" lista, com nomes curtos, as seções ou elementos ausentes (ex.: "Metodologia", "Referências"); [] se nada falta. "resumo" diz em 2 ou 3 frases o estado do artigo e o que priorizar.',
  'Seção ausente ou problema do texto todo: "paragrafo" 0, "trecho" "", "categoria" "Estrutura" ou "Conteúdo".',
  'Cada item descreve UM problema: "paragrafo" é o número da marca [n] que abre o parágrafo onde o problema está (confira a marca; ou 0 para o documento inteiro), "trecho" copia letra por letra só as palavras desse parágrafo onde está o problema, mantendo o erro como ele aparece no texto, sem corrigi-lo (ex.: o texto tem "problmas", o trecho é "problmas"; no máximo 12 palavras, sem aspas em volta; use "" somente quando o problema for do parágrafo ou do documento inteiro), "categoria" é curta (ex.: "Estrutura", "Conteúdo", "Coerência", "ABNT", "Gramática", "Clareza"), "descricao" diz o que está errado e "sugestao" diz como corrigir, ambas em português.',
  `No máximo ${MAXIMO_DIAGNOSTICOS} diagnosticos, dos mais relevantes. Se não houver problemas, responda {"resumo": "...", "diagnosticos": []}.`,
].join(" ");

/**
 * Chave do Gemini **no servidor**: `GEMINI_API_KEY` em `process.env`, sem
 * prefixo VITE_ — por isso ela nunca é embutida no bundle do navegador.
 */
export function chaveGemini(): string {
  const chave = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined;
  return typeof chave === "string" ? chave.trim() : "";
}

/**
 * Valida a lista de parágrafos do corpo de `POST /api/gemini`.
 * Devolve null quando o corpo não tem a forma esperada — o chamador responde
 * 400 com o motivo em português. Exportada para os testes.
 */
export function validarParagrafos(valor: unknown): ParagrafoNumerado[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null;
  const paragrafos: ParagrafoNumerado[] = [];
  for (const item of valor) {
    if (typeof item !== "object" || item === null) return null;
    const { index, texto } = item as { index?: unknown; texto?: unknown };
    if (typeof index !== "number" || !Number.isFinite(index) || index < 0) return null;
    if (typeof texto !== "string") return null;
    paragrafos.push({ index: Math.floor(index), texto });
  }
  return paragrafos;
}

/**
 * Mantém só os parágrafos que cabem no limite de envio (cada um conta como
 * "[n] texto" + separador). Usada no navegador, para o corpo de
 * `POST /api/gemini` ficar pequeno, e no servidor, ao montar o texto.
 */
export function recortarParagrafos(paragrafos: ParagrafoNumerado[]): {
  paragrafos: ParagrafoNumerado[];
  truncado: boolean;
} {
  const cabem: ParagrafoNumerado[] = [];
  let total = 0;
  for (const p of paragrafos) {
    const prefixo = `[${p.index}] `;
    const texto = p.texto.trim();
    if (total + prefixo.length + texto.length + 2 > MAXIMO_TEXTO) {
      // Só o primeiro parágrafo já estoura o limite: corta no meio dele.
      if (cabem.length === 0) {
        return {
          paragrafos: [{ index: p.index, texto: texto.slice(0, Math.max(0, MAXIMO_TEXTO - prefixo.length)) }],
          truncado: true,
        };
      }
      return { paragrafos: cabem, truncado: true };
    }
    cabem.push({ index: p.index, texto });
    total += prefixo.length + texto.length + 2;
  }
  return { paragrafos: cabem, truncado: false };
}

/** Numera os parágrafos como "[n] texto" e recorta no limite de envio. */
function montarTexto(paragrafos: ParagrafoNumerado[]): { texto: string; truncado: boolean; palavras: number } {
  const recorte = recortarParagrafos(paragrafos);
  // A extensão vai junto: sozinho, o modelo estima mal o tamanho do texto.
  const palavras = paragrafos.reduce((total, p) => total + (p.texto.match(/\S+/g)?.length ?? 0), 0);
  return {
    texto: recorte.paragrafos.map((p) => `[${p.index}] ${p.texto}`).join("\n\n"),
    truncado: recorte.truncado,
    palavras,
  };
}

/** Avaliação geral do artigo; ausente ou malformada fica de fora (nunca derruba o diagnóstico). */
function interpretarAvaliacao(valor: unknown): AvaliacaoArtigo | null {
  if (typeof valor !== "object" || valor === null) return null;
  const a = valor as { nivel?: unknown; faltando?: unknown };
  const nivel = typeof a.nivel === "string" ? a.nivel.trim().toLowerCase() : "";
  if (nivel !== "pronto" && nivel !== "quase" && nivel !== "insuficiente") return null;
  const faltando = Array.isArray(a.faltando)
    ? a.faltando
        .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
        .map((f) => f.trim())
        .slice(0, MAXIMO_FALTANDO)
    : [];
  return { nivel, faltando };
}

function normalizarSeveridade(valor: unknown): DiagnosticoGemini["severidade"] {
  if (typeof valor !== "string") return "media";
  const limpo = valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (limpo === "alta" || limpo === "high" || limpo === "critica" || limpo === "critico") return "alta";
  if (limpo === "baixa" || limpo === "low" || limpo === "info" || limpo === "informativa") return "baixa";
  return "media";
}

function normalizarTipo(valor: unknown, categoria: unknown, paragrafo: number): TipoApontamento {
  const limpo = typeof valor === "string" ? valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";
  if (limpo === "conteudo" || limpo === "linguagem") return limpo;
  return tipoPelaCategoria(typeof categoria === "string" ? categoria : "", paragrafo);
}

function normalizarParagrafo(valor: unknown, limite: number): number {
  const bruto =
    typeof valor === "number"
      ? valor
      : typeof valor === "string" && /^\d+$/.test(valor.trim())
        ? Number(valor)
        : NaN;
  if (!Number.isFinite(bruto)) return 0;
  const inteiro = Math.floor(bruto);
  if (inteiro <= 0 || inteiro > limite) return 0; // fora do texto → documento inteiro
  return inteiro;
}

/**
 * Interpreta a resposta em JSON do Gemini. Descarta entradas sem descrição,
 * normaliza severidade/número do parágrafo e limita a quantidade — a UI só
 * recebe diagnósticos que ela consegue exibir e localizar.
 * Exportada para os testes (a chamada de rede não é testada aqui).
 */
export function interpretarDiagnostico(conteudo: string, limiteParagrafo: number): ResultadoDiagnostico {
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    return { ok: false, motivo: MOTIVO_FORMATO };
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    return { ok: false, motivo: MOTIVO_FORMATO };
  }

  const dados = bruto as { resumo?: unknown; diagnosticos?: unknown; avaliacao?: unknown };
  const resumo = typeof dados.resumo === "string" ? dados.resumo.trim() : "";
  const lista = Array.isArray(dados.diagnosticos) ? dados.diagnosticos : [];

  const diagnosticos: DiagnosticoGemini[] = [];
  for (const item of lista) {
    if (diagnosticos.length >= MAXIMO_DIAGNOSTICOS) break;
    if (typeof item !== "object" || item === null) continue;
    const d = item as Record<string, unknown>;
    const descricao = typeof d.descricao === "string" ? d.descricao.trim() : "";
    if (descricao.length === 0) continue; // sem o que mostrar, não entra
    const trecho = typeof d.trecho === "string" ? d.trecho.trim() : "";
    diagnosticos.push({
      paragrafo: normalizarParagrafo(d.paragrafo, limiteParagrafo),
      // Só entra quando existe: o Firestore recusa campo undefined.
      ...(trecho.length > 0 ? { trecho } : {}),
      categoria: typeof d.categoria === "string" && d.categoria.trim().length > 0 ? d.categoria.trim() : "Revisão",
      descricao,
      sugestao: typeof d.sugestao === "string" ? d.sugestao.trim() : "",
      severidade: normalizarSeveridade(d.severidade),
      tipo: normalizarTipo(d.tipo, d.categoria, normalizarParagrafo(d.paragrafo, limiteParagrafo)),
    });
  }

  const avaliacao = interpretarAvaliacao(dados.avaliacao);
  if (resumo.length === 0 && diagnosticos.length === 0 && avaliacao === null) return { ok: false, motivo: MOTIVO_FORMATO };
  return { ok: true, resumo, diagnosticos, truncado: false, ...(avaliacao ? { avaliacao } : {}) };
}

interface Falha {
  motivo: string;
  /** Verdadeiro quando vale a pena tentar o próximo modelo. */
  tentarProximo: boolean;
}

function falhaHttp(status: number): Falha {
  if (status === 401 || status === 403) {
    return { motivo: "Chave da API do Gemini inválida ou sem permissão. Confira a variável GEMINI_API_KEY no servidor.", tentarProximo: false };
  }
  if (status === 429) {
    return { motivo: "O Gemini recebeu muitas requisições neste momento. Aguarde um instante e tente de novo.", tentarProximo: false };
  }
  if (status === 404) return { motivo: "O modelo do Gemini não está disponível.", tentarProximo: true };
  if (status >= 500) {
    return { motivo: "O Gemini está temporariamente sob alta demanda. Tente novamente em instantes.", tentarProximo: true };
  }
  return { motivo: `O Gemini respondeu com erro ${status}. Tente novamente mais tarde.`, tentarProximo: false };
}

/** Pedido ao modelo: instrução de sistema, texto do usuário e limite da resposta. */
interface Consulta {
  instrucao: string;
  conteudo: string;
  maxTokens: number;
}

async function chamarGemini(
  modelo: string,
  chave: string,
  consulta: Consulta,
  prazoMs: number,
): Promise<{ ok: true; conteudo: string; semConteudo: boolean; estourou: boolean } | { ok: false; falha: Falha }> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), prazoMs);
  try {
    const resposta = await fetch(`${ENDPOINT}/${modelo}:generateContent`, {
      method: "POST",
      signal: controle.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: consulta.instrucao }] },
        contents: [{ role: "user", parts: [{ text: consulta.conteudo }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: consulta.maxTokens,
        },
      }),
    });

    if (!resposta.ok) return { ok: false, falha: falhaHttp(resposta.status) };

    const dados = (await resposta.json()) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
        finishReason?: string;
      }[];
    };
    const candidato = dados.candidates?.[0];
    const conteudo = candidato?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return {
      ok: true,
      conteudo,
      semConteudo: conteudo.trim().length === 0,
      estourou: candidato?.finishReason === "MAX_TOKENS",
    };
  } catch (erro) {
    if (erro instanceof Error && erro.name === "AbortError") {
      return { ok: false, falha: { motivo: MOTIVO_DEMORA, tentarProximo: false } };
    }
    return { ok: false, falha: { motivo: "Não foi possível contactar o Gemini. Verifique sua conexão.", tentarProximo: false } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tenta os modelos em ordem, dentro de um prazo total (`prazoTotalMs`): a
 * primeira tentativa usa o prazo inteiro; as seguintes, só o que sobrou.
 * Nunca lança: qualquer problema vira { ok: false } com motivo em português.
 */
async function consultar<R extends { ok: true }>(
  chave: string,
  consulta: Consulta,
  interpretar: (conteudo: string) => R | { ok: false; motivo: string },
  prazoTotalMs: number,
): Promise<R | { ok: false; motivo: string }> {
  const fim = Date.now() + prazoTotalMs;
  let ultima: Falha = { motivo: MOTIVO_FORMATO, tentarProximo: false };
  for (const [tentativa, modelo] of MODELOS.entries()) {
    const restante = fim - Date.now();
    // Sem tempo para outra tentativa: devolve o motivo da anterior antes de a
    // Vercel encerrar a função no meio (o que viraria um erro sem explicação).
    if (tentativa > 0 && restante < MINIMO_NOVA_TENTATIVA_MS) return { ok: false, motivo: ultima.motivo };
    const chamada = await chamarGemini(modelo, chave, consulta, Math.max(restante, 0));
    if (!chamada.ok) {
      if (chamada.falha.tentarProximo) {
        ultima = chamada.falha;
        continue;
      }
      return { ok: false, motivo: chamada.falha.motivo };
    }
    if (chamada.semConteudo) {
      ultima = { motivo: MOTIVO_FORMATO, tentarProximo: true };
      continue;
    }

    const interpretado = interpretar(chamada.conteudo);
    if (interpretado.ok) return interpretado;

    ultima = chamada.estourou
      ? { motivo: "A resposta do Gemini foi cortada pelo limite de tamanho. Tente com um texto menor.", tentarProximo: false }
      : { motivo: MOTIVO_FORMATO, tentarProximo: true };
    if (!ultima.tentarProximo) return { ok: false, motivo: ultima.motivo };
  }
  return { ok: false, motivo: ultima.motivo };
}

const MOTIVO_INDISPONIVEL = "O diagnóstico com Gemini não está disponível no momento.";

/**
 * Pede ao Gemini um diagnóstico do manuscrito inteiro. Nunca lança: qualquer
 * problema vira { ok: false } com motivo em português (H9 / DC-03).
 * A chave é passada pelo chamador (o servidor), nunca lida do navegador.
 */
export async function executarDiagnostico(
  paragrafos: ParagrafoNumerado[],
  chave: string,
  prazoTotalMs: number = PRAZO_TOTAL_MS,
): Promise<ResultadoDiagnostico> {
  if (chave.trim().length === 0) return { ok: false, motivo: MOTIVO_INDISPONIVEL };

  const { texto, truncado, palavras } = montarTexto(paragrafos);
  const limite = paragrafos.reduce((maior, p) => Math.max(maior, p.index), 0);
  const resultado = await consultar(
    chave,
    {
      instrucao: INSTRUCAO_SISTEMA,
      conteudo: `Extensão: ${palavras} palavras.\n\nManuscrito (parágrafos numerados):\n\n${texto}`,
      maxTokens: 8192, // folga para a avaliação e o "trecho" de cada diagnóstico
    },
    (conteudo) => interpretarDiagnostico(conteudo, limite),
    prazoTotalMs,
  );
  return resultado.ok ? { ...resultado, truncado } : resultado;
}

// ---------------------------------------------------------------------------
// Conferir: o usuário mexeu no texto e quer saber se UM apontamento sobre o
// artigo foi resolvido. Vai o texto atual e o apontamento; volta sim/não e
// uma explicação curta. Não procura outros problemas.
// ---------------------------------------------------------------------------

/** O apontamento a conferir, como foi feito no diagnóstico. */
export interface ApontamentoConferido {
  paragrafo: number;
  categoria: string;
  descricao: string;
  sugestao: string;
}

export type ResultadoConferencia =
  | { ok: true; resolvido: boolean; explicacao: string }
  | { ok: false; motivo: string };

/** Limite de cada campo do apontamento enviado (o diagnóstico gera textos curtos). */
const MAXIMO_CAMPO = 1_000;

const INSTRUCAO_CONFERIR = [
  "Você é um orientador de artigos científicos brasileiros. Antes, você apontou um problema no artigo; o autor revisou o texto.",
  "Confira SOMENTE se esse problema foi resolvido no texto atual. Não aponte outros problemas.",
  "Seja exigente, mas justo: considere resolvido quando o texto atual atende ao que o apontamento pedia, mesmo que de forma diferente da sugestão.",
  'Responda SOMENTE com JSON válido, sem markdown, no formato {"resolvido": boolean, "explicacao": string}.',
  '"explicacao" tem uma ou duas frases em português: se resolvido, o que ficou bom; se não, o que ainda falta fazer.',
].join(" ");

/** Valida o apontamento do corpo de `POST /api/gemini` (modo conferir); null se inválido. */
export function validarApontamentoConferido(valor: unknown): ApontamentoConferido | null {
  if (typeof valor !== "object" || valor === null) return null;
  const a = valor as Record<string, unknown>;
  const texto = (v: unknown, obrigatorio: boolean) =>
    typeof v === "string" && v.length <= MAXIMO_CAMPO && (!obrigatorio || v.trim().length > 0) ? v.trim() : null;
  const descricao = texto(a.descricao, true);
  const categoria = texto(a.categoria, false);
  const sugestao = texto(a.sugestao, false);
  if (descricao === null || categoria === null || sugestao === null) return null;
  if (typeof a.paragrafo !== "number" || !Number.isFinite(a.paragrafo) || a.paragrafo < 0) return null;
  return { paragrafo: Math.floor(a.paragrafo), categoria, descricao, sugestao };
}

/** Interpreta a resposta da conferência. Exportada para os testes. */
export function interpretarConferencia(conteudo: string): ResultadoConferencia {
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    return { ok: false, motivo: MOTIVO_FORMATO };
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return { ok: false, motivo: MOTIVO_FORMATO };
  const d = bruto as { resolvido?: unknown; explicacao?: unknown };
  if (typeof d.resolvido !== "boolean") return { ok: false, motivo: MOTIVO_FORMATO };
  return { ok: true, resolvido: d.resolvido, explicacao: typeof d.explicacao === "string" ? d.explicacao.trim() : "" };
}

/** Confere um apontamento no texto atual. Nunca lança. */
export async function executarConferencia(
  paragrafos: ParagrafoNumerado[],
  apontamento: ApontamentoConferido,
  chave: string,
  prazoTotalMs: number = PRAZO_TOTAL_MS,
): Promise<ResultadoConferencia> {
  if (chave.trim().length === 0) return { ok: false, motivo: MOTIVO_INDISPONIVEL };

  const { texto, truncado, palavras } = montarTexto(paragrafos);
  const onde = apontamento.paragrafo > 0 ? `parágrafo [${apontamento.paragrafo}] na versão anterior` : "artigo inteiro";
  const resultado = await consultar(
    chave,
    {
      instrucao: INSTRUCAO_CONFERIR,
      conteudo: [
        `Apontamento (${onde}) — ${apontamento.categoria || "Revisão"}: ${apontamento.descricao}`,
        apontamento.sugestao ? `Sugestão dada: ${apontamento.sugestao}` : "",
        `Extensão atual: ${palavras} palavras${truncado ? " (texto enviado só até o limite)" : ""}.`,
        `Texto atual (parágrafos numerados):\n\n${texto}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      maxTokens: 512,
    },
    interpretarConferencia,
    prazoTotalMs,
  );
  return resultado;
}
