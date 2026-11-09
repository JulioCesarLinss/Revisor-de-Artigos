import { describe, expect, test } from "bun:test";
import { importarTexto } from "../document/importar";
import { ehTituloDeSecao } from "../document/titulo";
import { CATALOGO } from "./catalogo";
import { avaliarManuscrito } from "./motor";

function porRegra(texto: string, regraId: string) {
  return avaliarManuscrito(importarTexto(texto)).filter((p) => p.regraId === regraId);
}

/** O que cada posição do problema aponta, lido do próprio parágrafo. */
function marcados(texto: string, regraId: string): string[] {
  const manuscrito = importarTexto(texto);
  const achado = avaliarManuscrito(manuscrito).find((p) => p.regraId === regraId);
  const paragrafo = manuscrito.paragrafos.find((p) => p.index === achado?.paragrafo);
  return (achado?.posicoes ?? []).map(({ inicio, fim }) => (paragrafo?.texto ?? "").slice(inicio, fim));
}

describe("rules/catálogo — posição do erro no parágrafo", () => {
  test("R001 aponta cada espaço com a pontuação", () => {
    expect(marcados("Uma frase , com dois erros ; aqui mesmo.", "R001")).toEqual([" ,", " ;"]);
  });

  test("R003 aponta as aspas do parágrafo", () => {
    expect(marcados("Ele disse “algo sem fechar aspas no fim da frase.", "R003")).toEqual(["“"]);
  });

  test("R004 aponta a última palavra do parágrafo sem pontuação", () => {
    expect(marcados("Este parágrafo comprido termina sem nenhuma pontuação", "R004")).toEqual(["pontuação"]);
  });

  test("R005 aponta cada palavra em caixa-alta", () => {
    expect(marcados("Texto com MUITAS PALAVRAS em CAIXA ALTA no meio.", "R005")).toEqual([
      "MUITAS",
      "PALAVRAS",
      "CAIXA",
      "ALTA",
    ]);
  });

  test("R007 aponta só a citação sem vírgula", () => {
    expect(marcados("Segundo (Silva 2021) e também (Souza, 2020) e (Lima 2019a).", "R007")).toEqual([
      "(Silva 2021)",
      "(Lima 2019a)",
    ]);
  });

  test("R008 aponta só a citação longa", () => {
    const longa = `“${"palavra ".repeat(20).trim()}”`;
    expect(marcados(`Ele disse “pouco” e depois ${longa} sem página.`, "R008")).toEqual([longa]);
  });

  test("R010 aponta só os espaços repetidos", () => {
    expect(marcados("Tem  dois e   três espaços.", "R010")).toEqual(["  ", "   "]);
  });

  test("R002, R006 e R009 valem para o trecho inteiro: sem posição", () => {
    expect(marcados(`${"x".repeat(700)}\n\nCurto.`, "R002")).toEqual([]);
    expect(marcados("Só um parágrafo.", "R006")).toEqual([]);
    expect(marcados("SILVA, João. Título da obra sem data.", "R009")).toEqual([]);
  });
});

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

  test("título em caixa-alta não gera R005 nem R004", () => {
    // Título curto em caixa-alta, sem pontuação final e com 4+ palavras CAPS:
    // sem a marcação ehTitulo dispararia R005 e R004.
    const titulo = "ANALISE SISTEMATICA DE DADOS EXPERIMENTAIS OBTIDOS EM VIVOS";
    expect(ehTituloDeSecao(titulo)).toBe(true);
    const m = importarTexto(`${titulo}\n\nParágrafo final razoável e completo.`);
    expect(m.paragrafos[0].ehTitulo).toBe(true);
    expect(avaliarManuscrito(m).filter((p) => p.regraId === "R005").length).toBe(0);
    expect(avaliarManuscrito(m).filter((p) => p.regraId === "R004").length).toBe(0);
  });

  test("parágrafo longo em caixa-alta continua sendo avaliado (R002)", () => {
    // Acima de 80 caracteres deixa de ser título; R002 segue valendo.
    const grito = "TEXTO LONGO EM CAIXA ALTA ".repeat(30).trim();
    expect(ehTituloDeSecao(grito)).toBe(false);
    expect(grito.length).toBeGreaterThan(600);
    const achados = porRegra(`${grito}\n\nParágrafo final razoável e completo.`, "R002");
    expect(achados.length).toBe(1);
    expect(achados[0].paragrafo).toBe(1);
  });

  test("catálogo tem 10 regras determinísticas", () => {
    expect(CATALOGO.length).toBe(10);
  });
});
