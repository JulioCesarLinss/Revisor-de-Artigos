import { describe, expect, test } from "bun:test";
import { aplicarCorrecao } from "../document/acoes";
import { iniciarRevisao } from "../review/orquestrar";

/**
 * Sprint 5 — tratamento de erros e limites: entradas improváveis não podem
 * travar o sistema nem perder conteúdo ([[Testes de Qualidade]]).
 */

describe("Sprint 5 — erros e limites", () => {
  test("texto vazio e só whitespace não travam", () => {
    for (const bruto of ["", "   ", "\n\n\n", "\t \n"]) {
      const analise = iniciarRevisao(bruto);
      expect(analise.manuscrito.paragrafos.length).toBe(0);
      expect(analise.resumo.total).toBeGreaterThanOrEqual(0);
    }
  });

  test("texto muito longo não trava e mantém contagens corretas", () => {
    const longo = Array.from({ length: 500 }, (_, i) => `Parágrafo ${i} com texto de preenchimento adequado.`).join("\n\n");
    const analise = iniciarRevisao(longo);
    expect(analise.manuscrito.paragrafos.length).toBe(500);
    expect(analise.resumo.total).toBeGreaterThanOrEqual(0);
  });

  test("parágrafo único gigante produz problema de parágrafo longo sem travar", () => {
    const gigante = "x".repeat(50_000);
    const analise = iniciarRevisao(gigante);
    expect(analise.problemas.some((p) => p.regraId === "R002")).toBe(true);
  });

  test("caracteres atípicos, emojis e unicode composto são preservados", () => {
    const bruto = "Texto com emoji 🎓 e acentos àéíóú üï ñ ç — travessão e “aspas tipográficas”.";
    const analise = iniciarRevisao(bruto);
    expect(analise.manuscrito.bruto).toBe(bruto);
    expect(analise.manuscrito.totalCaracteres).toBe(bruto.length);
  });

  test("encoding quebrado (mojibake) não trava a análise", () => {
    const bruto = "Texto com mojibake: caf\u00e9\u0301 \uFFFD\uFFFD caracteres de substituição \u00E9 v\u00E1lido.";
    const analise = iniciarRevisao(bruto);
    expect(analise.manuscrito.bruto).toContain("caf");
  });

  test("correção em índice inexistente devolve texto inalterado", () => {
    const bruto = "Parágrafo único razoável.";
    expect(aplicarCorrecao(bruto, "adicionarPontoFinal", 99)).toBe(bruto);
    expect(aplicarCorrecao(bruto, "removerEspacosPontuacao", -1)).toBe(bruto);
  });

  test("separadores não convencionais não perdem conteúdo", () => {
    const bruto = "A\n   \nB\n\n\n\nC";
    const analise = iniciarRevisao(bruto);
    expect(analise.manuscrito.bruto).toBe(bruto);
    expect(analise.manuscrito.paragrafos.map((p) => p.texto)).toEqual(["A", "B", "C"]);
  });
});
