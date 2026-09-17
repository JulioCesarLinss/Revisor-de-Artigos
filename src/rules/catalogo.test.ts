import { describe, expect, test } from "bun:test";
import { importarTexto } from "../document/importar";
import { CATALOGO } from "./catalogo";
import { avaliarManuscrito } from "./motor";

function porRegra(texto: string, regraId: string) {
  return avaliarManuscrito(importarTexto(texto)).filter((p) => p.regraId === regraId);
}

describe("rules/catálogo", () => {
  test("todo problema tem os campos estruturados mínimos (DC-08)", () => {
    const problemas = avaliarManuscrito(
      importarTexto("Texto com espaço antes da pontuação .\n\nSegundo parágrafo razoável e completo."),
    );
    expect(problemas.length).toBeGreaterThan(0);
    for (const p of problemas) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.regraId.length).toBeGreaterThan(0);
      expect(p.mensagem.length).toBeGreaterThan(0);
      expect(p.referencia.length).toBeGreaterThan(0);
      expect(["critico", "advertencia", "observacao"]).toContain(p.severidade);
    }
  });

  test("R001 detecta espaço antes da pontuação", () => {
    const achados = porRegra("Frase com espaço , antes da vírgula.\n\nParágrafo bom e tranquilo.", "R001");
    expect(achados.length).toBe(1);
    expect(achados[0].paragrafo).toBe(1);
    expect(achados[0].acao).toBe("removerEspacosPontuacao");
  });

  test("R002 detecta parágrafo longo acima do limite", () => {
    const longo = "x".repeat(700);
    const achados = porRegra(`${longo}\n\nCurto.`, "R002");
    expect(achados.length).toBe(1);
    expect(achados[0].paragrafo).toBe(1);
  });

  test("R003 detecta aspas abertas sem fechamento", () => {
    const achados = porRegra('Ele disse "olá e foi embora.\n\nTudo certo aqui.', "R003");
    expect(achados.length).toBe(1);
  });

  test("R003 não dispara com aspas balanceadas", () => {
    const achados = porRegra('Ele disse "olá" e foi embora.\n\n“Curta” também.', "R003");
    expect(achados.length).toBe(0);
  });

  test("R004 detecta parágrafo sem pontuação final", () => {
    const achados = porRegra("Primeiro parágrafo ok.\n\nEste termina sem pontuação nenhuma por aqui", "R004");
    expect(achados.length).toBe(1);
    expect(achados[0].acao).toBe("adicionarPontoFinal");
  });

  test("R005 detecta caixa-alta em excesso", () => {
    const achados = porRegra("TEXTO GRITADO DEMAIS AQUI e mais\n\nNormal.", "R005");
    expect(achados.length).toBe(1);
  });

  test("R006 sinaliza documento curto no documento inteiro", () => {
    const achados = porRegra("Só um parágrafo.", "R006");
    expect(achados.length).toBe(1);
    expect(achados[0].paragrafo).toBe(0);
  });

  test("R007 detecta citação autor-data sem vírgula (NBR 10520)", () => {
    const achados = porRegra("A tese foi defendida (Silva 2021) sem vírgula.", "R007");
    expect(achados.length).toBe(1);
    expect(achados[0].referencia).toContain("NBR 10520");
  });

  test("R007 não dispara com citação correta", () => {
    const achados = porRegra("A tese foi defendida (Silva, 2021) corretamente.", "R007");
    expect(achados.length).toBe(0);
  });

  test("R008 detecta citação direta longa sem página (NBR 10520)", () => {
    const longa = "palavra ".repeat(20);
    const achados = porRegra(`Ele afirmou "${longa}" em sua tese.`, "R008");
    expect(achados.length).toBe(1);
  });

  test("R008 não dispara quando a página é indicada", () => {
    const longa = "palavra ".repeat(20);
    const achados = porRegra(`Ele afirmou "${longa}" (p. 112).`, "R008");
    expect(achados.length).toBe(0);
  });

  test("R009 detecta entrada de referência sem ano (NBR 6023)", () => {
    const achados = porRegra("SILVA, M. Bioética médica sem ano algum.", "R009");
    expect(achados.length).toBe(1);
    expect(achados[0].referencia).toContain("NBR 6023");
  });

  test("R009 não dispara com ano presente", () => {
    const achados = porRegra("SILVA, M. Bioética médica. 2021", "R009");
    expect(achados.length).toBe(0);
  });

  test("R010 detecta espaço duplo entre palavras (NBR 14724)", () => {
    const achados = porRegra("Texto com  espaço duplo aqui.", "R010");
    expect(achados.length).toBe(1);
    expect(achados[0].acao).toBe("colapsarEspacos");
  });

  test("catálogo tem 10 regras determinísticas", () => {
    expect(CATALOGO.length).toBe(10);
  });
});
