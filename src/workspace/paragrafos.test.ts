import { describe, expect, test } from "bun:test";
import { importarTexto } from "../document/importar";
import { posicoesParagrafos } from "./paragrafos";

/** O trecho de cada posição deve ser exatamente o parágrafo da análise. */
function confere(bruto: string) {
  const posicoes = posicoesParagrafos(bruto);
  const paragrafos = importarTexto(bruto).paragrafos;
  expect(posicoes.length).toBe(paragrafos.length);
  posicoes.forEach((p, i) => {
    expect(p.index).toBe(paragrafos[i].index);
    expect(bruto.slice(p.inicio, p.fim)).toBe(paragrafos[i].texto);
  });
}

describe("workspace/paragrafos — mesma numeração da análise", () => {
  test("texto simples com linhas em branco", () => {
    confere("INTRODUÇÃO\n\nPrimeiro parágrafo do texto.\n\nSegundo parágrafo.");
  });

  test("várias linhas em branco, espaços e quebras de linha internas", () => {
    confere("\n\n  Título  \n\n\n\n Parágrafo com\nquebra interna. \n \n\t\nÚltimo.\n\n");
  });

  test("quebras do Windows (\\r\\n) e texto vazio", () => {
    confere("Um.\r\n\r\nDois.\r\n\r\n\r\nTrês.");
    confere("");
    confere("   \n\n  ");
  });

  test("posições apontam para o texto aparado", () => {
    const bruto = "  Alfa  \n\nBeta";
    expect(posicoesParagrafos(bruto)).toEqual([
      { index: 1, inicio: 2, fim: 6 },
      { index: 2, inicio: 10, fim: 14 },
    ]);
  });
});
