import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { VERSAO_API, responderErro, responderJson, responderPreflight } from "./http";
import { tratarRevisar } from "./revisar";

/**
 * Etapa 1 — roteador mínimo por tarefa (não por tela), conforme o CEREBRO.
 * O núcleo fica em `server/` (reutilizável em testes e no servidor local);
 * no Vercel, cada função em `api/` reusa os helpers de `server/http.ts`.
 */

export interface Contexto {
  req: IncomingMessage;
  res: ServerResponse;
  /** Caminho da rota sem o prefixo /api (ex.: "health"). */
  caminho: string;
}

export type Tratador = (ctx: Contexto) => Promise<void> | void;

export interface Rota {
  metodo: "GET" | "POST" | "PUT" | "DELETE";
  /** Caminho relativo sob /api, sem barra inicial (ex.: "health"). */
  caminho: string;
  tratar: Tratador;
}

/** Tratador de /api/health — reusado pela função serverless do Vercel. */
export function tratarHealth({ res }: Contexto): void {
  responderJson(res, 200, { status: "ok", versao: VERSAO_API });
}

/** Registro de rotas — os próximos módulos (auth, ia, workspace) entram aqui. */
export const rotas: Rota[] = [
  { metodo: "GET", caminho: "health", tratar: tratarHealth },
  { metodo: "POST", caminho: "revisar", tratar: tratarRevisar },
];

/** Serve uma requisição pelo roteador (não cria servidor — só despacha). */
export async function servir(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (responderPreflight(req, res)) return;

    const url = new URL(req.url ?? "/", "http://localhost");
    const bruto = url.pathname.replace(/^\/+/, "");
    if (!bruto.startsWith("api/")) {
      responderErro(res, 404, "nao_encontrado", "Rota não encontrada na API.");
      return;
    }
    const caminho = bruto.slice("api/".length).replace(/\/+$/, "");

    const rota = rotas.find((r) => r.metodo === req.method && r.caminho === caminho);
    if (!rota) {
      responderErro(res, 404, "nao_encontrado", `Nenhuma rota ${req.method} para "${caminho}".`);
      return;
    }

    await rota.tratar({ req, res, caminho });
  } catch {
    // H9: nunca vaza stacktrace; o erro vira motivo legível.
    if (!res.headersSent) {
      responderErro(res, 500, "interno", "Erro interno inesperado na API.");
    } else {
      res.end();
    }
  }
}

/** Monta o servidor HTTP local em cima do roteador. */
export function criarServidor() {
  return createServer(servir);
}
