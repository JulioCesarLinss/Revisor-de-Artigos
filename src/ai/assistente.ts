import type { ConfiguracaoIA, ResultadoSugestao, StatusIA, SugestaoIA } from "./types";

const TIMEOUT_MS = 25_000;
const MAXIMO_TRECHO = 2_000;

/** De quem é a chave, pelo formato: o usuário só cola, o app escolhe o serviço. */
export type ServicoIA = "gemini" | "openai" | "outro";

export function servicoDaChave(chave: string): ServicoIA {
  const c = chave.trim();
  if (c.startsWith("AIza")) return "gemini"; // chaves do Google AI Studio
  if (c.startsWith("sk-")) return "openai";
  return "outro";
}

export const NOME_SERVICO: Record<ServicoIA, string> = {
  gemini: "Gemini (Google)",
  openai: "OpenAI",
  outro: "serviço compatível com a OpenAI",
};

/**
 * Gemini pela interface própria do Google (generateContent), a mesma do
 * diagnóstico no servidor (src/ai/gemini.ts), que já funciona com estes
 * modelos; o segundo é a reserva quando o primeiro está indisponível.
 * Ela aceita chamadas direto do navegador com a chave no cabeçalho.
 */
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODELOS = ["gemini-flash-lite-latest", "gemini-flash-latest"];
const OPENAI_BASE = "https://api.openai.com/v1";
const OPENAI_MODELO = "gpt-4o-mini";

/**
 * Para onde o pedido vai. Endpoint/modelo do Perfil valem sobre o padrão; com
 * endpoint próprio, o pedido segue o formato da OpenAI (qualquer serviço
 * compatível). Chave de formato desconhecido usa a OpenAI.
 */
export function destinoIA(config: ConfiguracaoIA): {
  servico: ServicoIA;
  formato: "gemini" | "openai";
  base: string;
  modelos: string[];
} {
  const servico = servicoDaChave(config.apiKey);
  const formato = servico === "gemini" && !config.baseUrl ? "gemini" : "openai";
  const base = (config.baseUrl ?? (formato === "gemini" ? GEMINI_BASE : OPENAI_BASE)).replace(/\/$/, "");
  const modelos = config.modelo ? [config.modelo] : formato === "gemini" ? GEMINI_MODELOS : [OPENAI_MODELO];
  return { servico, formato, base, modelos };
}

/** Motivo legível para uma resposta de erro (o Gemini avisa chave inválida com 400). */
function motivoDoErro(status: number, corpo: string): string {
  if (status === 401 || status === 403 || (status === 400 && /api key/i.test(corpo))) {
    return "Chave da API inválida, expirada ou sem permissão. Confira a chave colada.";
  }
  if (status === 429) {
    return "Limite de pedidos atingido (no plano gratuito do Gemini há limite por minuto e por dia). Aguarde um pouco e tente de novo.";
  }
  if (status === 404) return "O modelo de IA pedido não está disponível para esta chave.";
  return `Serviço de IA respondeu ${status}. Tente novamente mais tarde.`;
}

export function statusIA(config: ConfiguracaoIA | null): StatusIA {
  if (!config || config.apiKey.trim().length === 0) return "nao_configurada";
  return "pronta";
}

const PROMPT_SISTEMA =
  "Você é um assistente de redação acadêmica em português brasileiro. " +
  "Reescreva o trecho informado de forma mais formal, clara e precisa, SEM alterar o " +
  "significado nem inventar conteúdo. Nunca decida conformidade normativa: você sugere, " +
  "o autor decide. Responda EXATAMENTE em duas linhas no formato:\n" +
  "SUGESTAO: <trecho reescrito>\nEXPLICACAO: <uma frase curta justificando a mudança>";

/** Para o Gemini, a resposta vem em JSON (responseMimeType): leitura sem ambiguidade. */
const PROMPT_SISTEMA_JSON =
  "Você é um assistente de redação acadêmica em português brasileiro. " +
  "Reescreva o trecho informado de forma mais formal, clara e precisa, SEM alterar o " +
  "significado nem inventar conteúdo. Nunca decida conformidade normativa: você sugere, " +
  'o autor decide. Responda SOMENTE com JSON no formato {"sugestao": "<trecho reescrito>", ' +
  '"explicacao": "<uma frase curta justificando a mudança>"}.';

/** Tira cercas de código (```json … ```) que alguns modelos põem em volta da resposta. */
function semCercas(texto: string): string {
  return texto.replace(/^\s*```[a-z]*\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

/**
 * Lê a sugestão da resposta, em JSON ({sugestao, explicacao}) ou no formato de
 * duas linhas. Tolera variações comuns: acentos (SUGESTÃO), negrito
 * (**SUGESTAO:**), maiúsculas/minúsculas e sugestão em mais de uma linha.
 * Exportada para os testes.
 */
export function interpretarSugestao(conteudo: string, paragrafo: number, regraId?: string): SugestaoIA | null {
  const limpo = semCercas(conteudo);
  try {
    const dados = JSON.parse(limpo) as { sugestao?: unknown; explicacao?: unknown };
    const textoSugerido = typeof dados.sugestao === "string" ? dados.sugestao.trim() : "";
    const explicacao = typeof dados.explicacao === "string" ? dados.explicacao.trim() : "";
    if (textoSugerido && explicacao) return { textoSugerido, explicacao, paragrafo, regraId };
  } catch {
    /* não é JSON: tenta o formato de duas linhas */
  }

  const texto = limpo.replace(/\*\*/g, "");
  const achado = /SUGEST[AÃ]O\s*:\s*([\s\S]*?)\s*EXPLICA[CÇ][AÃ]O\s*:\s*([\s\S]*)$/i.exec(texto);
  if (!achado) return null;
  const textoSugerido = achado[1].trim();
  const explicacao = achado[2].trim();
  if (!textoSugerido || !explicacao) return null;
  return { textoSugerido, explicacao, paragrafo, regraId };
}

type Resposta = { ok: true; conteudo: string } | { ok: false; motivo: string };

/** Gemini (interface própria): tenta o próximo modelo quando o atual não existe, falha no servidor ou volta vazio. */
async function pedirGemini(chave: string, base: string, modelos: string[], pedido: string, sinal: AbortSignal): Promise<Resposta> {
  let ultima: Resposta = { ok: false, motivo: "A IA não respondeu. Tente novamente." };
  for (const [i, modelo] of modelos.entries()) {
    const temProximo = i < modelos.length - 1;
    const resposta = await fetch(`${base}/models/${modelo}:generateContent`, {
      method: "POST",
      signal: sinal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT_SISTEMA_JSON }] },
        contents: [{ role: "user", parts: [{ text: pedido }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });
    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      ultima = { ok: false, motivo: motivoDoErro(resposta.status, corpo) };
      if (temProximo && (resposta.status === 404 || resposta.status >= 500)) continue;
      return ultima;
    }
    const dados = (await resposta.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const conteudo = dados.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (conteudo.trim()) return { ok: true, conteudo };
    if (!temProximo) return { ok: false, motivo: "A IA respondeu sem texto. Tente novamente." };
  }
  return ultima;
}

/** OpenAI ou serviço compatível (formato chat/completions). */
async function pedirCompativel(chave: string, base: string, modelo: string, pedido: string, sinal: AbortSignal): Promise<Resposta> {
  const resposta = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal: sinal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: modelo,
      temperature: 0.2,
      messages: [
        { role: "system", content: PROMPT_SISTEMA },
        { role: "user", content: pedido },
      ],
    }),
  });
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    return { ok: false, motivo: motivoDoErro(resposta.status, corpo) };
  }
  const dados = (await resposta.json()) as { choices?: { message?: { content?: string } }[] };
  return { ok: true, conteudo: dados.choices?.[0]?.message?.content ?? "" };
}

/**
 * Pede uma sugestão pontual de reescrita. Em caso de qualquer falha (rede,
 * autenticação, formato inesperado), devolve { ok: false } com motivo legível —
 * o fluxo principal nunca depende desta chamada (DC-03).
 */
export async function sugerirReescrita(
  config: ConfiguracaoIA,
  trecho: string,
  paragrafo: number,
  contextoRegra?: { regraId: string; mensagem: string; referencia: string },
): Promise<ResultadoSugestao> {
  const destino = destinoIA(config);
  const chave = config.apiKey.trim();
  const recorte = trecho.slice(0, MAXIMO_TRECHO);

  const pedido = contextoRegra
    ? `Problema apontado pelo motor de regras (${contextoRegra.regraId} — ${contextoRegra.referencia}): ${contextoRegra.mensagem}\n\nTrecho do parágrafo ${paragrafo}:\n${recorte}`
    : `Trecho do parágrafo ${paragrafo}:\n${recorte}`;

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const resposta =
      destino.formato === "gemini"
        ? await pedirGemini(chave, destino.base, destino.modelos, pedido, controlador.signal)
        : await pedirCompativel(chave, destino.base, destino.modelos[0], pedido, controlador.signal);
    if (!resposta.ok) return resposta;

    const sugestao = interpretarSugestao(resposta.conteudo, paragrafo, contextoRegra?.regraId);
    return sugestao
      ? { ok: true, sugestao }
      : { ok: false, motivo: "A IA respondeu em um formato inesperado. Tente novamente." };
  } catch (erro) {
    const motivo =
      erro instanceof Error && erro.name === "AbortError"
        ? "A IA demorou demais para responder (timeout)."
        : "Não foi possível contactar o serviço de IA. Verifique a conexão.";
    return { ok: false, motivo };
  } finally {
    clearTimeout(timer);
  }
}
