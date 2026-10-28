import { afterEach, describe, expect, test } from "bun:test";
import {
  chaveGemini,
  executarDiagnostico,
  interpretarDiagnostico,
  recortarParagrafos,
  validarParagrafos,
} from "./gemini";

/** Monta a resposta em JSON como o Gemini devolveria. */
function resposta(diagnosticos: unknown[], resumo = "Texto com pontos de atenção."): string {
  return JSON.stringify({ resumo, diagnosticos });
}

describe("ai/gemini — interpretarDiagnostico", () => {
  test("JSON válido vira diagnósticos prontos para a UI", () => {
    const conteudo = resposta([
      {
        paragrafo: 2,
        categoria: "ABNT",
        descricao: "Citação direta sem indicação de página.",
        sugestao: "Incluir a página, ex.: (SILVA, 2024, p. 12).",
        severidade: "alta",
      },
      { paragrafo: 1, descricao: "Parágrafo redundante.", sugestao: "Remover a repetição.", severidade: "baixa" },
    ]);

    const r = interpretarDiagnostico(conteudo, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resumo).toBe("Texto com pontos de atenção.");
    expect(r.diagnosticos.length).toBe(2);
    expect(r.diagnosticos[0]).toEqual({
      paragrafo: 2,
      categoria: "ABNT",
      descricao: "Citação direta sem indicação de página.",
      sugestao: "Incluir a página, ex.: (SILVA, 2024, p. 12).",
      severidade: "alta",
    });
    expect(r.diagnosticos[1].severidade).toBe("baixa");
  });

  test("normaliza severidade e número do parágrafo, com fallbacks defensivos", () => {
    const conteudo = resposta([
      // Severidade sem acento/maiúscula → normalizada.
      { paragrafo: 3, descricao: "Frase muito longa.", severidade: "ALTA" },
      { paragrafo: 1, descricao: "Orçografia.", severidade: "Informativa" },
      { paragrafo: "4", descricao: "Falta vírgula.", categoria: "", sugestao: 42, severidade: "critica" },
      // Parágrafo fora do intervalo do manuscrito → documento inteiro (0).
      { paragrafo: 999, descricao: "Estrutura confusa.", severidade: "media" },
      // Sem severidade reconhecida → média.
      { paragrafo: 0, descricao: "Título sem numeral." },
    ]);

    const r = interpretarDiagnostico(conteudo, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.diagnosticos.map((d) => d.severidade)).toEqual(["alta", "baixa", "alta", "media", "media"]);
    expect(r.diagnosticos.map((d) => d.paragrafo)).toEqual([3, 1, 4, 0, 0]);
    // Categoria vazia e sugestão não-string caem no padrão seguro.
    expect(r.diagnosticos[2].categoria).toBe("Revisão");
    expect(r.diagnosticos[2].sugestao).toBe("");
  });

  test("descarta entradas sem descricao — nada de card vazio na tela", () => {
    const conteudo = resposta([
      { paragrafo: 1, sugestao: "Sem o que mostrar." },
      { paragrafo: 2 },
      { descricao: "   " },
      "não é um objeto",
      { paragrafo: 2, descricao: "Entrada válida.", severidade: "alta" },
    ]);

    const r = interpretarDiagnostico(conteudo, 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.diagnosticos.length).toBe(1);
    expect(r.diagnosticos[0].descricao).toBe("Entrada válida.");
  });

  test("sem problemas o Gemini devolve lista vazia e isso é sucesso", () => {
    const r = interpretarDiagnostico(resposta([], "Nenhum problema encontrado."), 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.diagnosticos).toEqual([]);
    expect(r.resumo).toBe("Nenhum problema encontrado.");
  });

  test("JSON inválido, lista ou objeto sem conteúdo vira erro legível", () => {
    for (const conteudo of ["{não é json", '"apenas uma string"', "[]", "{}"]) {
      const r = interpretarDiagnostico(conteudo, 5);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.motivo.length).toBeGreaterThan(0);
      // H9: motivo em português, sem vazar stacktrace ou JSON cru.
      expect(r.motivo).toContain("formato");
    }
  });
});

describe("ai/gemini — chave do servidor (GEMINI_API_KEY)", () => {
  test("lê GEMINI_API_KEY do processo, sem prefixo VITE_ e sem espaços", () => {
    const anterior = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "  gemini-local-123  ";
    try {
      expect(chaveGemini()).toBe("gemini-local-123");
    } finally {
      if (anterior === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = anterior;
    }
  });

  test("sem GEMINI_API_KEY o Gemini fica desconfigurado, mesmo com chave VITE_ no ambiente", () => {
    const anterior = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      // O ambiente de teste tem VITE_GEMINI_API_KEY (chave de cliente): ela
      // não pode mais acionar o Gemini — isso é o que mantém a chave fora do bundle.
      expect(chaveGemini()).toBe("");
    } finally {
      if (anterior !== undefined) process.env.GEMINI_API_KEY = anterior;
    }
  });
});

describe("ai/gemini — validarParagrafos (corpo do POST /api/gemini)", () => {
  test("aceita a lista { index, texto } enviada pela tela", () => {
    const r = validarParagrafos([
      { index: 1, texto: "Primeiro parágrafo do manuscrito." },
      { index: 2, texto: "Segundo parágrafo." },
    ]);
    expect(r).not.toBeNull();
    expect(r!.length).toBe(2);
    expect(r![0]).toEqual({ index: 1, texto: "Primeiro parágrafo do manuscrito." });
  });

  test("rejeita corpo que não é uma lista de parágrafos válida", () => {
    const invalidos: unknown[] = [
      undefined,
      null,
      "texto puro",
      42,
      [], // vazio não manda nada útil
      {},
      { paragrafos: [] },
      [{ index: "1", texto: "index como string" }],
      [{ index: 1 }], // sem texto
      [{ texto: "sem index" }],
      [{ index: -1, texto: "index negativo" }],
      [{ index: Number.NaN, texto: "index inválido" }],
      [null],
      ["não é objeto"],
    ];
    for (const valor of invalidos) expect(validarParagrafos(valor)).toBeNull();
  });

  test("normaliza index fracionário e aceita texto vazio", () => {
    expect(validarParagrafos([{ index: 2.7, texto: "" }])).toEqual([{ index: 2, texto: "" }]);
  });
});

describe("ai/gemini — recortarParagrafos (limite de envio)", () => {
  test("texto curto passa inteiro, sem truncar", () => {
    const r = recortarParagrafos([
      { index: 1, texto: "  Primeiro.  " },
      { index: 2, texto: "Segundo." },
    ]);
    expect(r.truncado).toBe(false);
    expect(r.paragrafos).toEqual([
      { index: 1, texto: "Primeiro." },
      { index: 2, texto: "Segundo." },
    ]);
  });

  test("manuscrito longo para no limite e marca truncado", () => {
    const longo = Array.from({ length: 100 }, (_, i) => ({ index: i + 1, texto: "a".repeat(1000) }));
    const r = recortarParagrafos(longo);
    expect(r.truncado).toBe(true);
    expect(r.paragrafos.length).toBeGreaterThan(0);
    expect(r.paragrafos.length).toBeLessThan(100);
    const total = r.paragrafos.reduce((soma, p) => soma + `[${p.index}] `.length + p.texto.length + 2, 0);
    expect(total).toBeLessThanOrEqual(36_000);
  });

  test("um único parágrafo gigante é cortado no meio", () => {
    const r = recortarParagrafos([{ index: 1, texto: "b".repeat(50_000) }]);
    expect(r.truncado).toBe(true);
    expect(r.paragrafos.length).toBe(1);
    expect(`[1] ${r.paragrafos[0].texto}`.length).toBeLessThanOrEqual(36_000);
  });
});

describe("ai/gemini — executarDiagnostico (tentativas e prazo)", () => {
  const fetchOriginal = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  const PARAGRAFOS = [{ index: 1, texto: "Texto do manuscrito." }];

  /** Resposta de sucesso no formato da API do Gemini. */
  function sucesso(): Response {
    const conteudo = JSON.stringify({ resumo: "Tudo certo.", diagnosticos: [] });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: conteudo }] } }] }), {
      status: 200,
    });
  }

  /** Troca o fetch global e registra as URLs chamadas. */
  function simular(responder: (url: string, init?: RequestInit) => Promise<Response>): string[] {
    const urls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      urls.push(String(url));
      return responder(String(url), init);
    }) as typeof fetch;
    return urls;
  }

  test("instabilidade no primeiro modelo: tenta o segundo", async () => {
    const urls = simular(async (url) => (url.includes("flash-lite") ? new Response("", { status: 503 }) : sucesso()));
    const r = await executarDiagnostico(PARAGRAFOS, "chave");
    expect(r.ok).toBe(true);
    expect(urls.length).toBe(2);
  });

  test("chave recusada (401): não tenta outro modelo", async () => {
    const urls = simular(async () => new Response("", { status: 401 }));
    const r = await executarDiagnostico(PARAGRAFOS, "chave");
    expect(r.ok).toBe(false);
    expect(urls.length).toBe(1);
  });

  test("Gemini sem responder: desiste no prazo total com motivo legível", async () => {
    const urls = simular(
      (_url, init) =>
        new Promise<Response>((_, rejeitar) => {
          init?.signal?.addEventListener("abort", () => {
            const erro = new Error("abortado");
            erro.name = "AbortError";
            rejeitar(erro);
          });
        }),
    );
    const inicio = Date.now();
    const r = await executarDiagnostico(PARAGRAFOS, "chave", 50);
    expect(Date.now() - inicio).toBeLessThan(2000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("demorou demais");
    expect(urls.length).toBe(1);
  });

  test("sem prazo para a segunda tentativa: devolve o motivo da primeira", async () => {
    const urls = simular(async () => new Response("", { status: 503 }));
    const r = await executarDiagnostico(PARAGRAFOS, "chave", 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("alta demanda");
    expect(urls.length).toBe(1);
  });
});
