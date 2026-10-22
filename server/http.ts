import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Etapa 1 — contrato HTTP compartilhado (usado pelo servidor local em `server/`
 * e pelas funções serverless do Vercel em `api/`).
 * Erro único da API: `{ erro: { codigo, motivo } }` — mesma linguagem de
 * recuperação (H9) do frontend.
 */

export interface ErroApi {
  codigo: string;
  motivo: string;
}

/** Versão do contrato da API (bump manual a cada mudança incompatível). */
export const VERSAO_API = "1.0.0";

/** Cabeçalhos de CORS liberados (dev com front em outra origem/porta). */
const CABECALHOS_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

/** Responde JSON com status e cabeçalhos padrão. */
export function responderJson(
  res: ServerResponse,
  status: number,
  corpo: unknown,
  cabecalhos: Record<string, string> = {},
): void {
  const dados = JSON.stringify(corpo);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(dados)),
    ...CABECALHOS_CORS,
    ...cabecalhos,
  });
  res.end(dados);
}

/** Responde no envelope de erro da API. */
export function responderErro(
  res: ServerResponse,
  status: number,
  codigo: string,
  motivo: string,
): void {
  responderJson(res, status, { erro: { codigo, motivo } } satisfies { erro: ErroApi });
}

/** Preflight OPTIONS (CORS). Responde true se tratou a requisição. */
export function responderPreflight(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== "OPTIONS") return false;
  res.writeHead(204, CABECALHOS_CORS);
  res.end();
  return true;
}

/** Lê o corpo JSON da requisição com limite de tamanho (H9: nunca lança). */
export async function lerCorpoJson<T = unknown>(
  req: IncomingMessage,
  limiteBytes = 64 * 1024,
): Promise<{ ok: true; valor: T } | { ok: false; motivo: string }> {
  const pedacos: Buffer[] = [];
  let total = 0;
  for await (const pedaco of req) {
    const buf = pedaco as Buffer;
    total += buf.length;
    if (total > limiteBytes) {
      return { ok: false, motivo: "Corpo da requisição excede o limite permitido." };
    }
    pedacos.push(buf);
  }
  try {
    const texto = Buffer.concat(pedacos).toString("utf8");
    return { ok: true, valor: JSON.parse(texto) as T };
  } catch {
    return { ok: false, motivo: "JSON inválido no corpo da requisição." };
  }
}
