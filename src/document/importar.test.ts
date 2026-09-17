import { describe, expect, test } from "bun:test";
import { importarTexto } from "./importar";

describe("document/importar", () => {
  test("separa parágrafos por linha em branco e numera a partir de 1", () => {
    const m = importarTexto("Primeiro parágrafo.\n\nSegundo parágrafo.\n\n\n\nTerceiro.");
    expect(m.paragrafos.length).toBe(3);
    expect(m.paragrafos[0]).toEqual({ index: 1, texto: "Primeiro parágrafo." });
    expect(m.paragrafos[2].texto).toBe("Terceiro.");
  });

  test("não descarta conteúdo: bruto permanece intacto", () => {
    const bruto = "A\n\n   B   \n\nC";
    const m = importarTexto(bruto);
    expect(m.bruto).toBe(bruto);
    expect(m.totalCaracteres).toBe(bruto.length);
  });

  test("conta palavras ignorando espaços redundantes", () => {
    const m = importarTexto("duas palavras\n\n três   palavras  aqui");
    expect(m.totalPalavras).toBe(5);
  });

  test("texto vazio produz manuscrito vazio sem erro", () => {
    const m = importarTexto("");
    expect(m.paragrafos.length).toBe(0);
    expect(m.totalPalavras).toBe(0);
  });
});
