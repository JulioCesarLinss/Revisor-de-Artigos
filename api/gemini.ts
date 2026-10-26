import type { IncomingMessage, ServerResponse } from "node:http";
import { chaveGemini, executarDiagnostico, validarParagrafos } from "../src/ai/gemini.js";

/**
 * Função serverless do Vercel para GET/POST /api/gemini.
 *
 * Segue o padrão do api/health.ts e do api/revisar.ts: autocontida nos helpers
 * HTTP (o bundler da Vercel compila cada arquivo `api/` isolado), importando o
 * motor de `src/` com extensão `.js`. A chave — `GEMINI_API_KEY`, **sem**
 * prefixo VITE_ — é lida só aqui, dentro do servidor: o navegador envia os
 * parágrafos e recebe o diagnóstico pronto, nunca o segredo.
 *
 * Contrato:
 * - GET  → 200 { configurado: boolean }
 * - POST → 200 ResultadoDiagnostico { ok: true | false, ... }
 *        → 400 { erro } corpo inválido | 405 método | 503 sem chave no servidor
 */

const CABECALHOS_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

/** Manuscrito longo cabe (o motor recorta o texto de envio lá na frente). */
const LIMITE_CORPO = 1024 * 1024;

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

function responderErro(res: ServerResponse, status: number, codigo: string, motivo: string, cabecalhos: Record<string, string> = {}): void {
  responderJson(res, status, { erro: { codigo, motivo } }, cabecalhos);
}

/** Lê o corpo bruto com limite de tamanho; nunca lança. */
async function lerCorpo(req: IncomingMessage, limiteBytes = LIMITE_CORPO): Promise<{ ok: true; texto: string } | { ok: false; motivo: string }> {
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

export default async function gemini(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CABECALHOS_CORS);
    res.end();
    return;
  }

  // GET: a tela pergunta se há chave no servidor (sem revelar nenhum valor).
  if (req.method === "GET") {
    responderJson(res, 200, { configurado: chaveGemini().length > 0 });
    return;
  }

  if (req.method !== "POST") {
    responderErro(res, 405, "metodo_invalido", `Nenhuma rota ${req.method} para "gemini".`, { allow: "GET, POST" });
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

  const paragrafos =
    typeof valor === "object" && valor !== null
      ? validarParagrafos((valor as { paragrafos?: unknown }).paragrafos)
      : null;
  if (paragrafos === null) {
    responderErro(
      res,
      400,
      "corpo_invalido",
      'O campo "paragrafos" é obrigatório e deve ser uma lista de { index, texto }.',
    );
    return;
  }

  const chave = chaveGemini();
  if (chave.length === 0) {
    responderErro(
      res,
      503,
      "gemini_nao_configurado",
      "O Gemini não está configurado no servidor: defina a variável de ambiente GEMINI_API_KEY.",
    );
    return;
  }

  const resultado = await executarDiagnostico(paragrafos, chave);
  responderJson(res, 200, resultado);
}
