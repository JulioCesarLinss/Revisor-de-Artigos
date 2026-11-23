import { afterEach, describe, expect, test } from "bun:test";
import { destinoIA, interpretarSugestao, servicoDaChave, sugerirReescrita } from "./assistente";
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
      formato: "gemini",
      base: "https://generativelanguage.googleapis.com/v1beta",
      modelos: ["gemini-flash-lite-latest", "gemini-flash-latest"],
    });
    expect(destinoIA({ apiKey: "sk-exemplo" }).base).toBe("https://api.openai.com/v1");
    expect(destinoIA({ apiKey: "chave-qualquer" }).modelos).toEqual(["gpt-4o-mini"]);
  });

  test("endpoint próprio no Perfil usa o formato da OpenAI, mesmo com chave do Google", () => {
    const destino = destinoIA({ apiKey: "AIzaSyExemplo", baseUrl: "https://meu-proxy.exemplo/v1/", modelo: "outro-modelo" });
    expect(destino.formato).toBe("openai");
    expect(destino.base).toBe("https://meu-proxy.exemplo/v1");
    expect(destino.modelos).toEqual(["outro-modelo"]);
  });
});

describe("ai/assistente — leitura da resposta", () => {
  const esperado = { textoSugerido: "Texto melhor.", explicacao: "Mais claro.", paragrafo: 3, regraId: "R001" };

  test("JSON, com ou sem cercas de código", () => {
    expect(interpretarSugestao('{"sugestao":"Texto melhor.","explicacao":"Mais claro."}', 3, "R001")).toEqual(esperado);
    expect(
      interpretarSugestao('```json\n{"sugestao":"Texto melhor.","explicacao":"Mais claro."}\n```', 3, "R001"),
    ).toEqual(esperado);
  });

  test("duas linhas, tolerando acento, negrito e minúsculas", () => {
    expect(interpretarSugestao("SUGESTAO: Texto melhor.\nEXPLICACAO: Mais claro.", 3, "R001")).toEqual(esperado);
    expect(interpretarSugestao("**SUGESTÃO:** Texto melhor.\n**EXPLICAÇÃO:** Mais claro.", 3, "R001")).toEqual(esperado);
    expect(interpretarSugestao("sugestão: Texto melhor.\nexplicação: Mais claro.", 3, "R001")).toEqual(esperado);
  });

  test("sem sugestão ou sem explicação não vira sugestão", () => {
    expect(interpretarSugestao("Não sei responder.", 1)).toBeNull();
    expect(interpretarSugestao('{"sugestao":"só isso"}', 1)).toBeNull();
  });
});

describe("ai/assistente — pedido e erros", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  interface Pedido {
    url: string;
    cabecalhos: Record<string, string>;
    corpo: { generationConfig?: { responseMimeType?: string } };
  }

  /** Troca o fetch por respostas fixas, em ordem, e guarda cada pedido feito. */
  function responder(...respostas: [number, unknown][]): Pedido[] {
    const vistos: Pedido[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      vistos.push({ url: String(url), cabecalhos: init.headers as Record<string, string>, corpo: JSON.parse(String(init.body)) });
      const [status, corpo] = respostas[Math.min(vistos.length - 1, respostas.length - 1)];
      return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
    }) as unknown as typeof fetch;
    return vistos;
  }

  const respostaGemini = (texto: string) => ({ candidates: [{ content: { parts: [{ text: texto }] } }] });

  test("com chave do Gemini, usa a interface própria do Google e lê a sugestão em JSON", async () => {
    const vistos = responder([200, respostaGemini('{"sugestao":"Texto melhor.","explicacao":"Mais claro."}')]);
    const r = await sugerirReescrita({ apiKey: " AIzaSyExemplo " }, "Texto ruim.", 2);
    expect(vistos[0].url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent",
    );
    expect(vistos[0].cabecalhos["x-goog-api-key"]).toBe("AIzaSyExemplo");
    expect(vistos[0].corpo.generationConfig?.responseMimeType).toBe("application/json");
    expect(r.ok && r.sugestao.textoSugerido).toBe("Texto melhor.");
  });

  test("modelo indisponível (404) tenta o modelo reserva", async () => {
    const vistos = responder(
      [404, { error: { message: "not found" } }],
      [200, respostaGemini('{"sugestao":"Ok.","explicacao":"Ok."}')],
    );
    const r = await sugerirReescrita({ apiKey: "AIzaSyExemplo" }, "Texto.", 1);
    expect(vistos.map((v) => v.url.split("/models/")[1])).toEqual([
      "gemini-flash-lite-latest:generateContent",
      "gemini-flash-latest:generateContent",
    ]);
    expect(r.ok).toBe(true);
  });

  test("com chave da OpenAI, usa chat/completions", async () => {
    const vistos = responder([200, { choices: [{ message: { content: "SUGESTAO: Texto melhor.\nEXPLICACAO: Mais claro." } }] }]);
    const r = await sugerirReescrita({ apiKey: "sk-exemplo" }, "Texto ruim.", 2);
    expect(vistos[0].url).toBe("https://api.openai.com/v1/chat/completions");
    expect(vistos[0].cabecalhos.Authorization).toBe("Bearer sk-exemplo");
    expect(r.ok && r.sugestao.explicacao).toBe("Mais claro.");
  });

  test("chave inválida do Gemini (400 'API key') vira mensagem de chave inválida, sem tentar outro modelo", async () => {
    const vistos = responder([400, { error: { code: 400, message: "API key not valid. Please pass a valid API key." } }]);
    const r = await sugerirReescrita({ apiKey: "AIzaInvalida" }, "Texto.", 1);
    expect(!r.ok && r.motivo).toContain("Chave da API inválida");
    expect(vistos).toHaveLength(1);
  });

  test("limite do plano gratuito (429) explica que é preciso aguardar", async () => {
    responder([429, { error: { message: "Resource exhausted" } }]);
    const r = await sugerirReescrita({ apiKey: "AIzaSyExemplo" }, "Texto.", 1);
    expect(!r.ok && r.motivo).toContain("Limite de pedidos atingido");
  });
});
