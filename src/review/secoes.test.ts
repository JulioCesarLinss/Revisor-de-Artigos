import { describe, expect, test } from "bun:test";
import { importarTexto } from "../document/importar";
import { avaliarManuscrito } from "../rules/motor";
import { detectarSecoes, relatorioPorSecao } from "./secoes";

const DOC = [
  "INTRODUÇÃO",
  "Parágrafo de abertura da introdução com conteúdo razoável.",
  "METODOLOGIA",
  "Parágrafo da metodologia descrevendo o procedimento adotado no estudo.",
  "REFERÊNCIAS",
  "SILVA, M. Bioética médica. 2021",
].join("\n\n");

describe("review/secoes (Sprint 2 — conformidade por seção)", () => {
  test("detecta seções por títulos em caixa-alta", () => {
    const secoes = detectarSecoes(importarTexto(DOC));
    expect(secoes.map((s) => s.nome)).toEqual(["INTRODUÇÃO", "METODOLOGIA", "REFERÊNCIAS"]);
    expect(secoes[0].paragrafos).toEqual([2]);
    expect(secoes[1].paragrafos).toEqual([4]);
  });

  test("corpo antes do primeiro título entra em Abertura", () => {
    const secoes = detectarSecoes(importarTexto("Texto inicial sem título.\n\nINTRODUÇÃO\n\nCorpo."));
    expect(secoes[0].nome).toBe("Abertura");
    expect(secoes[0].paragrafos).toEqual([1]);
  });

  test("relatório por seção agrega problemas da sua área", () => {
    const bruto = [
      "INTRODUÇÃO",
      "Texto com espaço antes da pontuação .",
      "METODOLOGIA",
      "Parágrafo adequado e tranquilo aqui.",
    ].join("\n\n");

    const m = importarTexto(bruto);
    const rel = relatorioPorSecao(m, avaliarManuscrito(m));
    const intro = rel.find((r) => r.secao === "INTRODUÇÃO")!;
    expect(intro.problemas).toBe(1);
    expect(intro.observacoes).toBe(1);
    expect(rel.find((r) => r.secao === "METODOLOGIA")!.problemas).toBe(0);
  });

  test("cada linha do relatório carrega os índices para navegação", () => {
    const m = importarTexto(DOC);
    const rel = relatorioPorSecao(m, []);
    expect(rel[0].indices).toEqual([2]);
    expect(rel[2].indices).toEqual([6]);
  });
});
