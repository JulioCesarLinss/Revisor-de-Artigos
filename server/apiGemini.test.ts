import { describe, expect, test } from "bun:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { criarTratadorGemini, type DependenciasGemini } from "../api/gemini";

interface Resposta {
  status: number;
  cabecalhos: Record<string, string>;
  corpo: { erro?: { codigo: string; motivo: string }; [k: string]: unknown };
}

/** Requisição falsa: corpo como stream, método e cabeçalhos. */
function requisicao(metodo: string, corpo = "", cabecalhos: Record<string, string> = {}): IncomingMessage {
  const req = Readable.from(corpo.length > 0 ? [Buffer.from(corpo)] : []) as unknown as IncomingMessage;
  req.method = metodo;
  req.headers = cabecalhos;
  return req;
}

/** Chama o tratador e captura status, cabeçalhos e JSON da resposta. */
async function chamar(deps: Partial<DependenciasGemini>, req: IncomingMessage): Promise<Resposta> {
  const capturado: Resposta = { status: 0, cabecalhos: {}, corpo: {} };
  const res = {
    writeHead(status: number, cabecalhos: Record<string, string> = {}) {
      capturado.status = status;
      capturado.cabecalhos = cabecalhos;
      return res;
    },
    end(dados?: string) {
      if (dados) capturado.corpo = JSON.parse(dados);
    },
  } as unknown as ServerResponse;
  const tratador = criarTratadorGemini({ ...padrao(), ...deps });
  await tratador(req, res);
  return capturado;
}

let chamadasDiagnostico = 0;

function padrao(): DependenciasGemini {
  return {
    chave: () => "chave-de-teste",
    verificarToken: async (t) => (t === "token-bom" ? { uid: "uid-1" } : null),
    diagnosticar: async () => {
      chamadasDiagnostico += 1;
      return { ok: true, resumo: "ok", diagnosticos: [], truncado: false };
    },
  };
}

const CORPO_OK = JSON.stringify({ paragrafos: [{ index: 1, texto: "Texto." }] });
const LOGADO = { authorization: "Bearer token-bom", "content-type": "application/json" };

describe("api/gemini — proteção da rota", () => {
  test("GET informa se há chave, sem login e sem CORS", async () => {
    const r = await chamar({}, requisicao("GET"));
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ configurado: true });
    expect(r.cabecalhos["access-control-allow-origin"]).toBeUndefined();
  });

  test("POST sem login → 401 e o Gemini não é chamado", async () => {
    const antes = chamadasDiagnostico;
    const r = await chamar({}, requisicao("POST", CORPO_OK));
    expect(r.status).toBe(401);
    expect(r.corpo.erro?.codigo).toBe("nao_autenticado");
    expect(chamadasDiagnostico).toBe(antes);
  });

  test("POST com token inválido → 401", async () => {
    const antes = chamadasDiagnostico;
    const r = await chamar({}, requisicao("POST", CORPO_OK, { authorization: "Bearer token-falso" }));
    expect(r.status).toBe(401);
    expect(r.corpo.erro?.codigo).toBe("sessao_invalida");
    expect(chamadasDiagnostico).toBe(antes);
  });

  test("POST logado → 200 com o diagnóstico", async () => {
    const antes = chamadasDiagnostico;
    const r = await chamar({}, requisicao("POST", CORPO_OK, LOGADO));
    expect(r.status).toBe(200);
    expect(r.corpo.ok).toBe(true);
    expect(chamadasDiagnostico).toBe(antes + 1);
    expect(r.cabecalhos["access-control-allow-origin"]).toBeUndefined();
  });

  test("corpo acima do limite → 413", async () => {
    const enorme = JSON.stringify({ paragrafos: [{ index: 1, texto: "a".repeat(300 * 1024) }] });
    const r = await chamar({}, requisicao("POST", enorme, LOGADO));
    expect(r.status).toBe(413);
    expect(r.corpo.erro?.codigo).toBe("corpo_grande");
  });

  test("corpo inválido → 400 em português", async () => {
    const r = await chamar({}, requisicao("POST", "{nao-json", LOGADO));
    expect(r.status).toBe(400);
    const r2 = await chamar({}, requisicao("POST", JSON.stringify({ paragrafos: [] }), LOGADO));
    expect(r2.status).toBe(400);
  });

  test("sem chave no servidor → 503 sem revelar nomes de variáveis", async () => {
    const r = await chamar({ chave: () => "" }, requisicao("POST", CORPO_OK, LOGADO));
    expect(r.status).toBe(503);
    expect(r.corpo.erro?.motivo).not.toContain("GEMINI_API_KEY");
  });

  test("OPTIONS e outros métodos → 405 (sem pré-voo CORS)", async () => {
    expect((await chamar({}, requisicao("OPTIONS"))).status).toBe(405);
    expect((await chamar({}, requisicao("DELETE"))).status).toBe(405);
  });
});
