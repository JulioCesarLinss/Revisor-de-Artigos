/**
 * Módulo `ai/geminiCliente` — lado do navegador do diagnóstico com o Gemini.
 *
 * A chave fica no servidor (`GEMINI_API_KEY` lida por `api/gemini.ts`): daqui
 * só fazemos `POST /api/gemini` e lemos o resultado — o segredo nunca passa
 * pelo bundle. Vale também no desenvolvimento: o `bun run dev` repassa /api
 * para o servidor local (`bun run api`), que usa o mesmo tratador da Vercel.
 */
import { firebaseAuth } from "../firebase/config";
import { recortarParagrafos, type ParagrafoNumerado, type ResultadoDiagnostico } from "./gemini";

const ENDPOINT = "/api/gemini";
/** O servidor desiste em 50s e a Vercel corta em 60s: esperamos um pouco mais. */
const TIMEOUT_MS = 70_000;
const MOTIVO_DEMORA = "O Gemini demorou demais para responder. Tente novamente em instantes.";

/**
 * Verdadeiro quando o servidor tem a chave do Gemini (GET /api/gemini). Sem
 * servidor (ex.: `bun run api` desligado no desenvolvimento), devolve false.
 */
export async function geminiConfigurado(): Promise<boolean> {
  try {
    const resposta = await fetch(ENDPOINT, { method: "GET" });
    if (!resposta.ok) return false;
    const corpo = (await resposta.json().catch(() => null)) as { configurado?: unknown } | null;
    return corpo !== null && typeof corpo === "object" && corpo.configurado === true;
  } catch {
    return false;
  }
}

/** ID token do usuário logado (o servidor exige login); null sem sessão. */
async function tokenDoUsuario(): Promise<string | null> {
  const usuario = firebaseAuth()?.currentUser ?? null;
  if (!usuario) return null;
  try {
    return await usuario.getIdToken();
  } catch {
    return null;
  }
}

/** POST /api/gemini — qualquer falha vira { ok: false } com motivo em português. */
async function chamarApi(paragrafos: ParagrafoNumerado[]): Promise<ResultadoDiagnostico> {
  const token = await tokenDoUsuario();
  if (token === null) {
    return { ok: false, motivo: "Entre na sua conta para usar o diagnóstico com Gemini." };
  }
  // Recorta aqui também: o servidor só aceita corpos pequenos.
  const recorte = recortarParagrafos(paragrafos);

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(ENDPOINT, {
      method: "POST",
      signal: controle.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ paragrafos: recorte.paragrafos }),
    });
    const corpo = (await resposta.json().catch(() => null)) as unknown;
    if (corpo !== null && typeof corpo === "object") {
      const erro = (corpo as { erro?: { motivo?: unknown } }).erro;
      if (erro !== null && typeof erro === "object" && typeof erro.motivo === "string") {
        return { ok: false, motivo: erro.motivo };
      }
      if ("ok" in corpo) {
        const resultado = corpo as ResultadoDiagnostico;
        return resultado.ok && recorte.truncado ? { ...resultado, truncado: true } : resultado;
      }
    }
    // 504: a Vercel encerrou a função por tempo (resposta sem o nosso JSON).
    if (resposta.status === 504) return { ok: false, motivo: MOTIVO_DEMORA };
    return {
      ok: false,
      motivo: `O servidor respondeu de forma inesperada (HTTP ${resposta.status}). Tente novamente.`,
    };
  } catch (erro) {
    return {
      ok: false,
      motivo:
        erro instanceof Error && erro.name === "AbortError"
          ? MOTIVO_DEMORA
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
export function diagnosticarComGemini(paragrafos: ParagrafoNumerado[]): Promise<ResultadoDiagnostico> {
  return chamarApi(paragrafos);
}
