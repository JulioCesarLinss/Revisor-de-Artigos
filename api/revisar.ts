import type { IncomingMessage, ServerResponse } from "node:http";
import { iniciarRevisao } from "../src/review/orquestrar";

/**
 * Função serverless do Vercel para POST /api/revisar.
 *
 * Segue o mesmo padrão do api/health.ts: autocontida nos helpers HTTP (o
 * bundler da Vercel compila cada arquivo `api/` isolado e imports de `server/`
 * quebram em runtime), mas importa o motor de revisão real — `iniciarRevisao`
 * de src/review/orquestrar — para não duplicar a lógica de regras.
 *
 * Contrato: 200 { resumo, problemas, secoes } | 400 { erro: { codigo, motivo } }
 */

const CABECALHOS_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

function responderJson(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}): void {
  const dados = JSON.stringify(corpo);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(dados)),
    ...CABECALHOS_CORS,
    ...cabecalhos,
  });
  res.end(dados);
}

function responderErro(res: ServerResponse, status: number, codigo: string, motivo: string): void {
  responderJson(res, status, { erro: { codigo, motivo } });
}

/** Lê o corpo bruto com limite de tamanho; nunca lança. */
async function lerCorpo(req: IncomingMessage, limiteBytes = 64 * 1024): Promise<{ ok: true; texto: string } | { ok: false; motivo: string }> {
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
  return { ok: true, texto: Buffer.concat(pedacos).toString("utf8") };
}

export default async function revisar(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CABECALHOS_CORS);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    responderErro(res, 405, "metodo_invalido", `Nenhuma rota ${req.method} para "revisar".`);
    return;
  }

  const bruto = await lerCorpo(req);
  if (!bruto.ok) {
    responderErro(res, 400, "corpo_invalido", bruto.motivo);
    return;
  }

  let valor: unknown;
  try {
    valor = JSON.parse(bruto.texto);
  } catch {
    responderErro(res, 400, "corpo_invalido", "JSON inválido no corpo da requisição.");
    return;
  }

  if (typeof valor !== "object" || valor === null) {
    responderErro(res, 400, "corpo_invalido", 'O campo "texto" é obrigatório e deve ser uma string.');
    return;
  }
  const { texto } = valor as { texto?: unknown };
  if (typeof texto !== "string") {
    responderErro(res, 400, "corpo_invalido", 'O campo "texto" é obrigatório e deve ser uma string.');
    return;
  }

  const analise = iniciarRevisao(texto);
  responderJson(res, 200, {
    resumo: analise.resumo,
    problemas: analise.problemas,
    secoes: analise.secoes,
  });
}
