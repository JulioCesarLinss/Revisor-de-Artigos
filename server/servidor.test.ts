import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { criarServidor } from "./servidor";
import { VERSAO_API } from "./http";

/**
 * Etapa 1 — testes de contrato da API contra o servidor real (HTTP de verdade),
 * seguindo [[Testes de Qualidade]]: sem mock do roteador.
 */

let servidor: Server;
let base: string;

beforeAll(async () => {
  servidor = criarServidor();
  await new Promise<void>((resolver) => servidor.listen(0, "127.0.0.1", resolver));
  const endereco = servidor.address();
  if (endereco === null || typeof endereco === "string") throw new Error("endereço efêmero indisponível");
  base = `http://127.0.0.1:${endereco.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolver, rejeitar) =>
    servidor.close((erro) => (erro ? rejeitar(erro) : resolver())),
  );
});

describe("api — Etapa 1 (fundação)", () => {
  test("GET /api/health responde ok com a versão do contrato", async () => {
    const r = await fetch(`${base}/api/health`);
    expect(r.status).toBe(200);
    const corpo = (await r.json()) as { status: string; versao: string };
    expect(corpo.status).toBe("ok");
    expect(corpo.versao).toBe(VERSAO_API);
  });

  test("rota inexistente responde 404 no envelope de erro", async () => {
    const r = await fetch(`${base}/api/nao-existe`);
    expect(r.status).toBe(404);
    const corpo = (await r.json()) as { erro: { codigo: string; motivo: string } };
    expect(corpo.erro.codigo).toBe("nao_encontrado");
    expect(corpo.erro.motivo.length).toBeGreaterThan(0);
  });

  test("caminho fora de /api responde 404 na API", async () => {
    const r = await fetch(`${base}/outra-coisa`);
    expect(r.status).toBe(404);
    const corpo = (await r.json()) as { erro: { codigo: string } };
    expect(corpo.erro.codigo).toBe("nao_encontrado");
  });

  test("método não registrado responde 404 com motivo legível", async () => {
    const r = await fetch(`${base}/api/health`, { method: "POST" });
    expect(r.status).toBe(404);
    const corpo = (await r.json()) as { erro: { motivo: string } };
    expect(corpo.erro.motivo).toContain("POST");
  });

  test("preflight OPTIONS responde 204 com cabeçalhos de CORS", async () => {
    const r = await fetch(`${base}/api/health`, { method: "OPTIONS" });
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(r.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  test("JSON de resposta é válido e UTF-8 preservado", async () => {
    const r = await fetch(`${base}/api/health`);
    expect(r.headers.get("content-type")).toContain("application/json");
    const texto = await r.text();
    expect(() => JSON.parse(texto)).not.toThrow();
  });
});
