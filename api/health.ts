import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Função serverless do Vercel para GET /api/health (montada em /api/health).
 *
 * Autocontida de propósito: o bundler do Vercel compila cada arquivo `api/`
 * isolado, então imports cruzados para `server/` sobrevivem como ESM sem
 * extensão e quebram em runtime (ERR_MODULE_NOT_FOUND). O núcleo compartilhado
 * continua em `server/http.ts` (usado pelo servidor local e pelos testes); aqui
 * a resposta mínima é redeclarada para o deploy ser independente.
 */

const VERSAO_API = "1.0.0";

const CABECALHOS_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

export default function health(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CABECALHOS_CORS);
    res.end();
    return;
  }
  if (req.method !== "GET") {
    const dados = JSON.stringify({
      erro: { codigo: "metodo_invalido", motivo: `Nenhuma rota ${req.method} para "health".` },
    });
    res.writeHead(405, {
      allow: "GET",
      "content-type": "application/json; charset=utf-8",
      "content-length": String(Buffer.byteLength(dados)),
      ...CABECALHOS_CORS,
    });
    res.end(dados);
    return;
  }
  const dados = JSON.stringify({ status: "ok", versao: VERSAO_API });
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(dados)),
    ...CABECALHOS_CORS,
  });
  res.end(dados);
}
