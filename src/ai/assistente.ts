import type { ConfiguracaoIA, ResultadoSugestao, StatusIA, SugestaoIA } from "./types";

const TIMEOUT_MS = 20_000;
const MAXIMO_TRECHO = 2_000;

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
  const base = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const modelo = config.modelo ?? "gpt-4o-mini";
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
      const motivo =
        resposta.status === 401
          ? "Chave da API inválida ou expirada."
          : `Serviço de IA respondeu ${resposta.status}. Tente novamente mais tarde.`;
      return { ok: false, motivo };
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
