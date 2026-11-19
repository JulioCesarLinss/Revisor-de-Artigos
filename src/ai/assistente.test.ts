import { afterEach, describe, expect, test } from "bun:test";
import { destinoIA, servicoDaChave, sugerirReescrita } from "./assistente";
import { aplicarSugestao } from "../document/aplicarSugestao";
import { novoHistorico, registrar } from "../workspace/historico";
import type { SugestaoIA } from "./types";

const SUGESTAO: SugestaoIA = {
  textoSugerido: "A inteligência artificial transforma a produção científica.",
  explicacao: "Forma mais direta e acadêmica.",
  paragrafo: 1,
  regraId: "R005",
};

describe("ai/assistente (Sprint 3)", () => {
  test("aplicarSugestao troca apenas o parágrafo alvo", () => {
    const bruto = "Primeiro parágrafo antigo.\n\nSegundo parágrafo.\n\nTerceiro.";
    const resultado = aplicarSugestao(bruto, SUGESTAO, SUGESTAO.textoSugerido);
    expect(resultado).toBe(
      "A inteligência artificial transforma a produção científica.\n\nSegundo parágrafo.\n\nTerceiro.",
    );
  });

  test("aplicarSugestao preserva separadores e demais parágrafos", () => {
    const bruto = "A\n\n\n\nB\n\nC";
    const resultado = aplicarSugestao(bruto, { ...SUGESTAO, paragrafo: 2 }, "B revisado");
    expect(resultado).toBe("A\n\n\n\nB revisado\n\nC");
  });

  test("histórico distingue origem manual de IA (DC-13)", () => {
    let h = novoHistorico();
    h = registrar(h, { origem: "manual", descricao: "correção rápida aplicada", paragrafo: 1 });
    h = registrar(h, { origem: "ia", descricao: "sugestão aceita (R005)", paragrafo: 1 });
    expect(h[0].origem).toBe("manual");
    expect(h[1].origem).toBe("ia");
    expect(h[1].descricao).toContain("R005");
  });
});

describe("ai/assistente — serviço reconhecido pela chave", () => {
  test("chave do Google vai para o Gemini; sk- para a OpenAI; outra usa o padrão da OpenAI", () => {
    expect(servicoDaChave("AIzaSyExemplo")).toBe("gemini");
    expect(servicoDaChave("  sk-proj-exemplo ")).toBe("openai");
    expect(servicoDaChave("chave-qualquer")).toBe("outro");

    expect(destinoIA({ apiKey: "AIzaSyExemplo" })).toEqual({
      servico: "gemini",
      base: "https://generativelanguage.googleapis.com/v1beta/openai",
      modelo: "gemini-flash-lite-latest",
    });
    expect(destinoIA({ apiKey: "sk-exemplo" }).base).toBe("https://api.openai.com/v1");
    expect(destinoIA({ apiKey: "chave-qualquer" }).modelo).toBe("gpt-4o-mini");
  });

  test("endpoint e modelo do Perfil valem sobre o padrão do serviço", () => {
    const destino = destinoIA({ apiKey: "AIzaSyExemplo", baseUrl: "https://meu-proxy.exemplo/v1/", modelo: "outro-modelo" });
    expect(destino.base).toBe("https://meu-proxy.exemplo/v1");
    expect(destino.modelo).toBe("outro-modelo");
  });
});

describe("ai/assistente — pedido e erros", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  /** Troca o fetch por uma resposta fixa e guarda para onde o pedido foi. */
  function responder(status: number, corpo: unknown): { url: string; modelo: string } {
    const visto = { url: "", modelo: "" };
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      visto.url = String(url);
      visto.modelo = JSON.parse(String(init.body)).model;
      return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
    }) as unknown as typeof fetch;
    return visto;
  }

  test("com chave do Gemini, o pedido vai ao Gemini e a resposta vira sugestão", async () => {
    const visto = responder(200, {
      choices: [{ message: { content: "SUGESTAO: Texto melhor.\nEXPLICACAO: Mais claro." } }],
    });
    const r = await sugerirReescrita({ apiKey: "AIzaSyExemplo" }, "Texto ruim.", 2);
    expect(visto.url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(visto.modelo).toBe("gemini-flash-lite-latest");
    expect(r.ok && r.sugestao.textoSugerido).toBe("Texto melhor.");
  });

  test("chave inválida do Gemini (400 'API key') vira mensagem de chave inválida", async () => {
    responder(400, [{ error: { code: 400, message: "API key not valid. Please pass a valid API key." } }]);
    const r = await sugerirReescrita({ apiKey: "AIzaInvalida" }, "Texto.", 1);
    expect(!r.ok && r.motivo).toContain("Chave da API inválida");
  });

  test("limite do plano gratuito (429) explica que é preciso aguardar", async () => {
    responder(429, { error: { message: "Resource exhausted" } });
    const r = await sugerirReescrita({ apiKey: "AIzaSyExemplo" }, "Texto.", 1);
    expect(!r.ok && r.motivo).toContain("Limite de pedidos atingido");
  });
});
