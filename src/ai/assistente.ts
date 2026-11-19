import type { ConfiguracaoIA, ResultadoSugestao, StatusIA, SugestaoIA } from "./types";

const TIMEOUT_MS = 20_000;
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
 * Endereço e modelo de cada serviço. O Gemini é chamado pela interface
 * compatível com a OpenAI (o mesmo formato de pedido e de resposta) e aceita
 * chamadas direto do navegador. Chave de formato desconhecido usa a OpenAI.
 */
const PADRAO: Record<"gemini" | "openai", { base: string; modelo: string }> = {
  gemini: { base: "https://generativelanguage.googleapis.com/v1beta/openai", modelo: "gemini-flash-lite-latest" },
  openai: { base: "https://api.openai.com/v1", modelo: "gpt-4o-mini" },
};

/** Para onde o pedido vai: o endpoint/modelo do Perfil, se houver; senão, o padrão do serviço da chave. */
export function destinoIA(config: ConfiguracaoIA): { servico: ServicoIA; base: string; modelo: string } {
  const servico = servicoDaChave(config.apiKey);
  const padrao = PADRAO[servico === "gemini" ? "gemini" : "openai"];
  return {
    servico,
    base: (config.baseUrl ?? padrao.base).replace(/\/$/, ""),
    modelo: config.modelo ?? padrao.modelo,
  };
}

/** Motivo legível para uma resposta de erro (o Gemini avisa chave inválida com 400). */
function motivoDoErro(status: number, corpo: string): string {
  if (status === 401 || status === 403 || (status === 400 && /api key/i.test(corpo))) {
    return "Chave da API inválida, expirada ou sem permissão. Confira a chave colada.";
  }
  if (status === 429) {
    return "Limite de pedidos atingido (no plano gratuito do Gemini há limite por minuto e por dia). Aguarde um pouco e tente de novo.";
  }
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

function parseResposta(conteudo: string, paragrafo: number, regraId?: string): SugestaoIA | null {
  const linhaSugestao = conteudo.split("\n").find((l) => l.startsWith("SUGESTAO:"));
  const linhaExplicacao = conteudo.split("\n").find((l) => l.startsWith("EXPLICACAO:"));
  if (!linhaSugestao || !linhaExplicacao) return null;

  const textoSugerido = linhaSugestao.replace(/^SUGESTAO:\s*/, "").trim();
  const explicacao = linhaExplicacao.replace(/^EXPLICACAO:\s*/, "").trim();
  if (textoSugerido.length === 0 || explicacao.length === 0) return null;

  return { textoSugerido, explicacao, paragrafo, regraId };
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
  const { base, modelo } = destinoIA(config);
  const recorte = trecho.slice(0, MAXIMO_TRECHO);

  const pedido = contextoRegra
    ? `Problema apontado pelo motor de regras (${contextoRegra.regraId} — ${contextoRegra.referencia}): ${contextoRegra.mensagem}\n\nTrecho do parágrafo ${paragrafo}:\n${recorte}`
    : `Trecho do parágrafo ${paragrafo}:\n${recorte}`;

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controlador.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
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
    const conteudo = dados.choices?.[0]?.message?.content ?? "";
    const sugestao = parseResposta(conteudo, paragrafo, contextoRegra?.regraId);

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
