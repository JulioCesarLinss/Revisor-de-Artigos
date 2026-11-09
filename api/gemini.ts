import type { IncomingMessage, ServerResponse } from "node:http";
import { chaveGemini, executarDiagnostico, validarParagrafos } from "../src/ai/gemini.js";
import {
  extrairBearer,
  projetoFirebaseServidor,
  verificarTokenFirebase,
  type UsuarioVerificado,
} from "../src/firebase/tokenServidor.js";

/**
 * Função serverless do Vercel para GET/POST /api/gemini.
 *
 * Segue o padrão do api/health.ts e do api/revisar.ts: autocontida nos helpers
 * HTTP (o bundler da Vercel compila cada arquivo `api/` isolado), importando o
 * motor de `src/` com extensão `.js`. A chave — `GEMINI_API_KEY`, **sem**
 * prefixo VITE_ — é lida só aqui, dentro do servidor: o navegador envia os
 * parágrafos e recebe o diagnóstico pronto, nunca o segredo.
 *
 * Proteção da chave do projeto:
 * - POST exige login: `Authorization: Bearer <ID token do Firebase>`,
 *   conferido no servidor (firebase/tokenServidor).
 * - Sem cabeçalhos CORS: só a própria página (mesma origem) chama do navegador.
 * - Corpo limitado: a tela já recorta o texto antes de enviar.
 *
 * Contrato:
 * - GET  → 200 { configurado: boolean }
 * - POST → 200 ResultadoDiagnostico { ok: true | false, ... }
 *        → 400 corpo inválido | 401 sem login | 405 método | 413 corpo grande
 *        → 503 Gemini indisponível no servidor
 */

/** A tela envia no máximo ~36 mil caracteres (recortarParagrafos); sobra folga. */
const LIMITE_CORPO = 256 * 1024;

function responderJson(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}): void {
  const dados = JSON.stringify(corpo);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(dados)),
    ...cabecalhos,
  });
  res.end(dados);
}

function responderErro(res: ServerResponse, status: number, codigo: string, motivo: string, cabecalhos: Record<string, string> = {}): void {
  responderJson(res, status, { erro: { codigo, motivo } }, cabecalhos);
}

/** Lê o corpo bruto com limite de tamanho; nunca lança. */
async function lerCorpo(
  req: IncomingMessage,
  limiteBytes = LIMITE_CORPO,
): Promise<{ ok: true; texto: string } | { ok: false; grande: boolean; motivo: string }> {
  const pedacos: Buffer[] = [];
  let total = 0;
  try {
    for await (const pedaco of req) {
      const buf = pedaco as Buffer;
      total += buf.length;
      if (total > limiteBytes) {
        return { ok: false, grande: true, motivo: "O texto enviado excede o limite do diagnóstico com Gemini." };
      }
      pedacos.push(buf);
    }
  } catch {
    return { ok: false, grande: false, motivo: "Não foi possível ler o corpo da requisição." };
  }
  return { ok: true, texto: Buffer.concat(pedacos).toString("utf8") };
}

/** Dependências trocáveis nos testes; a exportação padrão usa as reais. */
export interface DependenciasGemini {
  chave: () => string;
  verificarToken: (token: string) => Promise<UsuarioVerificado | null>;
  diagnosticar: typeof executarDiagnostico;
}

async function verificarTokenPadrao(token: string): Promise<UsuarioVerificado | null> {
  const projeto = projetoFirebaseServidor();
  if (projeto.length === 0) {
    console.error("api/gemini: defina FIREBASE_PROJECT_ID (ou VITE_FIREBASE_PROJECT_ID) no servidor.");
    return null;
  }
  return verificarTokenFirebase(token, projeto);
}

export function criarTratadorGemini(deps: DependenciasGemini) {
  return async function gemini(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // GET: a tela pergunta se há chave no servidor (sem revelar nenhum valor).
    if (req.method === "GET") {
      responderJson(res, 200, { configurado: deps.chave().length > 0 });
      return;
    }

    if (req.method !== "POST") {
      responderErro(res, 405, "metodo_invalido", `Nenhuma rota ${req.method} para "gemini".`, { allow: "GET, POST" });
      return;
    }

    const chave = deps.chave();
    if (chave.length === 0) {
      responderErro(res, 503, "gemini_nao_configurado", "O diagnóstico com Gemini não está disponível no momento.");
      return;
    }

    // Login antes de ler o corpo: sem sessão válida, nada é processado.
    const token = extrairBearer(req.headers.authorization);
    if (token === null) {
      responderErro(res, 401, "nao_autenticado", "Entre na sua conta para usar o diagnóstico com Gemini.");
      return;
    }
    const usuario = await deps.verificarToken(token);
    if (usuario === null) {
      responderErro(res, 401, "sessao_invalida", "Sua sessão expirou ou é inválida. Entre novamente na sua conta.");
      return;
    }

    const bruto = await lerCorpo(req);
    if (!bruto.ok) {
      responderErro(res, bruto.grande ? 413 : 400, bruto.grande ? "corpo_grande" : "corpo_invalido", bruto.motivo);
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

    const resultado = await deps.diagnosticar(paragrafos, chave);
    responderJson(res, 200, resultado);
  };
}

export default criarTratadorGemini({
  chave: chaveGemini,
  verificarToken: verificarTokenPadrao,
  diagnosticar: executarDiagnostico,
});
