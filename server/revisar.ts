import { lerCorpoJson, responderErro, responderJson } from "./http";
import { iniciarRevisao } from "../src/review/orquestrar";

/** Contexto mínimo usado aqui (mesma forma de server/servidor.ts). */
interface Ctx {
  req: import("node:http").IncomingMessage;
  res: import("node:http").ServerResponse;
}

/**
 * Etapa 2 — POST /api/revisar: recebe { texto } e devolve os problemas
 * encontrados pelo motor de regras via `iniciarRevisao` (src/review), sem
 * duplicar lógica. Contrato: sucesso 200 com { resumo, problemas, secoes };
 * corpo inválido → 400 no envelope { erro: { codigo, motivo } } em português.
 */
export async function tratarRevisar({ req, res }: Ctx): Promise<void> {
  const corpo = await lerCorpoJson(req);
  if (!corpo.ok) {
    responderErro(res, 400, "corpo_invalido", corpo.motivo);
    return;
  }
  if (typeof corpo.valor !== "object" || corpo.valor === null) {
    responderErro(res, 400, "corpo_invalido", 'O campo "texto" é obrigatório e deve ser uma string.');
    return;
  }
  const { texto } = corpo.valor as { texto?: unknown };
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
