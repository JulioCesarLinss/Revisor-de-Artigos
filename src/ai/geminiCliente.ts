/**
 * Módulo `ai/geminiCliente` — lado do navegador do diagnóstico com o Gemini.
 *
 * A chave fica no servidor (`GEMINI_API_KEY` lida por `api/gemini.ts`): daqui
 * só fazemos `POST /api/gemini` e lemos o resultado — o segredo nunca passa
 * pelo bundle. Em desenvolvimento (`vite dev`) não existe função serverless
 * local, então a chamada sai direto do navegador com `VITE_GEMINI_API_KEY` do
 * `.env.local`; esse ramo é eliminado no build de produção
 * (`import.meta.env.DEV === false`), junto com a chave.
 */
import { executarDiagnostico, type ParagrafoNumerado, type ResultadoDiagnostico } from "./gemini";

const ENDPOINT = "/api/gemini";
/** O servidor corta em 60s (maxDuration da função): esperamos um pouco mais. */
const TIMEOUT_MS = 70_000;

/** Chave usada só em desenvolvimento (não sobrevive ao bundle de produção). */
function chaveDesenvolvimento(): string {
  const chave = import.meta.env.VITE_GEMINI_API_KEY;
  return typeof chave === "string" ? chave.trim() : "";
}

/**
 * Verdadeiro quando dá para consultar o Gemini: chave local no desenvolvimento
 * ou função serverless pronta em produção (GET /api/gemini).
 */
export async function geminiConfigurado(): Promise<boolean> {
  if (import.meta.env.DEV) return chaveDesenvolvimento().length > 0;
  try {
    const resposta = await fetch(ENDPOINT, { method: "GET" });
    if (!resposta.ok) return false;
    const corpo = (await resposta.json().catch(() => null)) as { configurado?: unknown } | null;
    return corpo !== null && typeof corpo === "object" && corpo.configurado === true;
  } catch {
    return false;
  }
}

/** POST /api/gemini — qualquer falha vira { ok: false } com motivo em português. */
async function chamarApi(paragrafos: ParagrafoNumerado[]): Promise<ResultadoDiagnostico> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(ENDPOINT, {
      method: "POST",
      signal: controle.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paragrafos }),
    });
    const corpo = (await resposta.json().catch(() => null)) as unknown;
    if (corpo !== null && typeof corpo === "object") {
      const erro = (corpo as { erro?: { motivo?: unknown } }).erro;
      if (erro !== null && typeof erro === "object" && typeof erro.motivo === "string") {
        return { ok: false, motivo: erro.motivo };
      }
      if ("ok" in corpo) return corpo as ResultadoDiagnostico;
    }
    return {
      ok: false,
      motivo: `O servidor respondeu de forma inesperada (HTTP ${resposta.status}). Tente novamente.`,
    };
  } catch (erro) {
    return {
      ok: false,
      motivo:
        erro instanceof Error && erro.name === "AbortError"
          ? "O Gemini demorou mais de um minuto para responder. Tente novamente."
          : "Não foi possível contactar o servidor para consultar o Gemini. Verifique sua conexão.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pede ao Gemini um diagnóstico do manuscrito inteiro. Nunca lança: qualquer
 * problema vira { ok: false } com motivo em português (H9 / DC-03).
 */
export async function diagnosticarComGemini(paragrafos: ParagrafoNumerado[]): Promise<ResultadoDiagnostico> {
  // Desenvolvimento: sem função serverless local, a chamada sai direto do
  // navegador com a chave do .env.local. Em produção este ramo não existe.
  if (import.meta.env.DEV) {
    const chave = chaveDesenvolvimento();
    if (chave.length === 0) {
      return {
        ok: false,
        motivo: "O Gemini não está configurado: defina VITE_GEMINI_API_KEY no .env.local (só em desenvolvimento).",
      };
    }
    return executarDiagnostico(paragrafos, chave);
  }
  return chamarApi(paragrafos);
}
