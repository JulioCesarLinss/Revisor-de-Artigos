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
  /** Eixo do apontamento (ex.: "ABNT", "Gramática", "Clareza"). */
  categoria: string;
  /** O que está errado, em português claro. */
  descricao: string;
  /** Como corrigir, em português claro. */
  sugestao: string;
  severidade: "alta" | "media" | "baixa";
}

export type ResultadoDiagnostico =
  | { ok: true; resumo: string; diagnosticos: DiagnosticoGemini[]; truncado: boolean }
  | { ok: false; motivo: string };

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

const MOTIVO_FORMATO = "O Gemini respondeu em um formato inesperado. Tente novamente.";

const INSTRUCAO_SISTEMA = [
  "Você é um revisor acadêmico brasileiro, especialista em normas ABNT (NBR 14724, NBR 6023, NBR 10520, NBR 6024) e em clareza científica.",
  "Analise o manuscrito inteiro e aponte problemas concretos, objetivos e acionáveis: norma violada, gramática, ortografia, clareza, estrutura, coerência e citações.",
  "Você diagnostica e sugere; você nunca decide conformidade normativa sozinho — o motor de regras do aplicativo é a referência primária.",
  'Responda SOMENTE com JSON válido, sem markdown nem comentários, no formato {"resumo": string, "diagnosticos": [{"paragrafo": number, "categoria": string, "descricao": string, "sugestao": string, "severidade": "alta"|"media"|"baixa"}]}.',
  'Cada item descreve UM problema: "paragrafo" é o número da marca [n] do texto (ou 0 para o documento inteiro), "categoria" é curta (ex.: "ABNT", "Gramática", "Clareza", "Estrutura"), "descricao" diz o que está errado e "sugestao" diz como corrigir, ambas em português.',
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
function montarTexto(paragrafos: ParagrafoNumerado[]): { texto: string; truncado: boolean } {
  const recorte = recortarParagrafos(paragrafos);
  return {
    texto: recorte.paragrafos.map((p) => `[${p.index}] ${p.texto}`).join("\n\n"),
    truncado: recorte.truncado,
  };
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

  const dados = bruto as { resumo?: unknown; diagnosticos?: unknown };
  const resumo = typeof dados.resumo === "string" ? dados.resumo.trim() : "";
  const lista = Array.isArray(dados.diagnosticos) ? dados.diagnosticos : [];

  const diagnosticos: DiagnosticoGemini[] = [];
  for (const item of lista) {
    if (diagnosticos.length >= MAXIMO_DIAGNOSTICOS) break;
    if (typeof item !== "object" || item === null) continue;
    const d = item as Record<string, unknown>;
    const descricao = typeof d.descricao === "string" ? d.descricao.trim() : "";
    if (descricao.length === 0) continue; // sem o que mostrar, não entra
    diagnosticos.push({
      paragrafo: normalizarParagrafo(d.paragrafo, limiteParagrafo),
      categoria: typeof d.categoria === "string" && d.categoria.trim().length > 0 ? d.categoria.trim() : "Revisão",
      descricao,
      sugestao: typeof d.sugestao === "string" ? d.sugestao.trim() : "",
      severidade: normalizarSeveridade(d.severidade),
    });
  }

  if (resumo.length === 0 && diagnosticos.length === 0) return { ok: false, motivo: MOTIVO_FORMATO };
  return { ok: true, resumo, diagnosticos, truncado: false };
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

async function chamarGemini(
  modelo: string,
  chave: string,
  texto: string,
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
        systemInstruction: { parts: [{ text: INSTRUCAO_SISTEMA }] },
        contents: [{ role: "user", parts: [{ text: `Manuscrito (parágrafos numerados):\n\n${texto}` }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
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
 * Pede ao Gemini um diagnóstico do manuscrito inteiro. Nunca lança: qualquer
 * problema vira { ok: false } com motivo em português (H9 / DC-03).
 * A chave é passada pelo chamador (o servidor), nunca lida do navegador.
 * Todas as tentativas dividem um prazo total (`prazoTotalMs`, trocável nos
 * testes): a primeira usa o prazo inteiro; as seguintes, só o que sobrou.
 */
export async function executarDiagnostico(
  paragrafos: ParagrafoNumerado[],
  chave: string,
  prazoTotalMs: number = PRAZO_TOTAL_MS,
): Promise<ResultadoDiagnostico> {
  if (chave.trim().length === 0) {
    return { ok: false, motivo: "O diagnóstico com Gemini não está disponível no momento." };
  }

  const { texto, truncado } = montarTexto(paragrafos);
  const limite = paragrafos.reduce((maior, p) => Math.max(maior, p.index), 0);
  const fim = Date.now() + prazoTotalMs;

  let ultima: Falha = { motivo: MOTIVO_FORMATO, tentarProximo: false };
  for (const [tentativa, modelo] of MODELOS.entries()) {
    const restante = fim - Date.now();
    // Sem tempo para outra tentativa: devolve o motivo da anterior antes de a
    // Vercel encerrar a função no meio (o que viraria um erro sem explicação).
    if (tentativa > 0 && restante < MINIMO_NOVA_TENTATIVA_MS) return { ok: false, motivo: ultima.motivo };
    const chamada = await chamarGemini(modelo, chave, texto, Math.max(restante, 0));
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

    const interpretado = interpretarDiagnostico(chamada.conteudo, limite);
    if (interpretado.ok) return { ...interpretado, truncado };

    ultima = chamada.estourou
      ? { motivo: "A resposta do Gemini foi cortada pelo limite de tamanho. Tente com um texto menor.", tentarProximo: false }
      : { motivo: MOTIVO_FORMATO, tentarProximo: true };
    if (!ultima.tentarProximo) return { ok: false, motivo: ultima.motivo };
  }
  return { ok: false, motivo: ultima.motivo };
}
