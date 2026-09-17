import { describe, expect, test } from "bun:test";
import { aplicarCorrecao } from "./acoes";

describe("document/acoes", () => {
  const bruto = "Olá , mundo !\n\nTexto sem ponto final aqui no fim\n\nFim.";

  test("remove espaços antes da pontuação apenas no parágrafo alvo", () => {
    const resultado = aplicarCorrecao(bruto, "removerEspacosPontuacao", 1);
    expect(resultado.startsWith("Olá, mundo!")).toBe(true);
    expect(resultado).toContain("Texto sem ponto final aqui no fim");
  });

  test("adiciona ponto final apenas no parágrafo alvo quando falta pontuação", () => {
    const resultado = aplicarCorrecao(bruto, "adicionarPontoFinal", 2);
    expect(resultado).toContain("aqui no fim.");
    expect(resultado).toContain("Fim.");
    // parágrafos fora do alvo permanecem iguais
    expect(resultado.startsWith("Olá , mundo !")).toBe(true);
  });

  test("não duplica pontuação final já existente", () => {
    const resultado = aplicarCorrecao("Já tem ponto.\n\nOutro", "adicionarPontoFinal", 1);
    expect(resultado).toBe("Já tem ponto.\n\nOutro");
  });

  test("preserva separadores originais entre parágrafos", () => {
    const comQuebras = "A ,\n\n\n\nB ,";
    const resultado = aplicarCorrecao(comQuebras, "removerEspacosPontuacao", 2);
    expect(resultado).toBe("A ,\n\n\n\nB,");
  });

  test("alvo inválido devolve o texto inalterado", () => {
    expect(aplicarCorrecao(bruto, "adicionarPontoFinal", 0)).toBe(bruto);
    expect(aplicarCorrecao(bruto, "adicionarPontoFinal", 99)).toBe(bruto);
  });
});
