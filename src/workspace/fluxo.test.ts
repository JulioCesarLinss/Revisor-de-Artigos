import { describe, expect, test } from "bun:test";
import { compararManuscritos, resumoDiff } from "./diff";
import { estadoInicial, proximoEstado, registrarVersao, ultimaVersao } from "./fluxo";

describe("workspace/fluxo (Sprint 4)", () => {
  test("estado inicial é rascunho e a ordem avança até final", () => {
    expect(estadoInicial()).toBe("rascunho");
    expect(proximoEstado("rascunho")).toBe("revisao");
    expect(proximoEstado("revisao")).toBe("final");
    expect(proximoEstado("final")).toBeNull();
  });

  test("snapshots registram versões e podem ser retomados por estado", () => {
    let v = registrarVersao([], { estado: "rascunho", bruto: "original", totalProblemas: 5 });
    v = registrarVersao(v, { estado: "revisao", bruto: "revisado", totalProblemas: 2 });
    expect(v.length).toBe(2);
    expect(ultimaVersao(v, "rascunho")?.bruto).toBe("original");
    expect(ultimaVersao(v, "revisao")?.totalProblemas).toBe(2);
    expect(ultimaVersao(v, "final")).toBeUndefined();
  });
});

describe("workspace/diff (Sprint 4)", () => {
  test("compara por parágrafo e marca mudanças", () => {
    const linhas = compararManuscritos("A igual.\n\nB antigo.", "A igual.\n\nB revisado.");
    expect(linhas.length).toBe(2);
    expect(linhas[0].mudou).toBe(false);
    expect(linhas[1].mudou).toBe(true);
    expect(linhas[1].revisado).toBe("B revisado.");
  });

  test("resume quantidade de parágrafos alterados", () => {
    const linhas = compararManuscritos("Um.\n\nDois.", "Um.\n\nDois alterado.");
    expect(resumoDiff(linhas)).toEqual({ mudados: 1, totais: 2 });
  });

  test("sem perda de conteúdo: diff reflete exatamente os textos", () => {
    const original = "Parágrafo 1.\n\nParágrafo 2.";
    const revisado = "Parágrafo 1 alterado.\n\nParágrafo 2.";
    const linhas = compararManuscritos(original, revisado);
    expect(linhas[0].original).toBe("Parágrafo 1.");
    expect(linhas[0].revisado).toBe("Parágrafo 1 alterado.");
  });
});
