import { describe, expect, test } from "bun:test";
import { REGRAS_SENHA, faltandoRegras, senhaValida } from "./senha";

describe("auth/senha — regras de cadastro", () => {
  test("senha completa atende todas as regras e não sobra nada", () => {
    const senha = "Norma@Review2024";

    expect(senhaValida(senha)).toBe(true);
    expect(faltandoRegras(senha)).toEqual([]);
    expect(REGRAS_SENHA.every((regra) => regra.atende(senha))).toBe(true);
  });

  test("cada regra isoladamente aponta o que falta", () => {
    expect(faltandoRegras("")).toHaveLength(5);

    // 8 caracteres com minúscula e número: faltam maiúscula e símbolo
    const faltantes = faltandoRegras("abc12345");
    expect(faltantes).toEqual([
      "Letra maiúscula (A, B, C…)",
      "Símbolo (!, @, #…)",
    ]);
  });

  test("letras acentuadas valem como maiúscula e minúscula", () => {
    expect(senhaValida("RevisãoAbnt@7")).toBe(true);
    expect(faltandoRegras("RevisãoAbnt@7")).toEqual([]);
  });

  test("número aceita só ASCII e símbolo é o que não é letra nem número", () => {
    const [tamanho, maiuscula, minuscula, numero, simbolo] = REGRAS_SENHA;

    expect(tamanho.atende("12345678")).toBe(true);
    expect(numero.atende("aA!12345")).toBe(true);
    expect(numero.atende("aA!doito")).toBe(false);
    expect(simbolo.atende("Abcdefg1")).toBe(false);
    expect(simbolo.atende("Abcdefg1!")).toBe(true);
    expect(simbolo.atende("Abcdefg1 ")).toBe(true); // espaço conta como símbolo
    expect(maiuscula.atende("abcdefg1!")).toBe(false);
    expect(minuscula.atende("ABCDEFG1!")).toBe(false);
  });
});
