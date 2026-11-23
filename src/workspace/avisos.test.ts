import { describe, expect, test } from "bun:test";
import { iniciarRevisao } from "../review/orquestrar";
import { acompanharAvisos, type AvisoAcompanhado } from "./avisos";

const TEXTO = [
  "A revisão de artigos é uma etapa  essencial do processo editorial.",
  "O impacto da norma no texto acadêmico é grande  e visível.",
].join("\n\n");

/** Avisos de partida (como depois do "Analisar"): todos estabelecidos. */
function partida(texto: string): AvisoAcompanhado[] {
  return iniciarRevisao(texto).problemas.map((problema) => ({ problema, desde: 0 }));
}

function depois(antes: AvisoAcompanhado[], textoAntes: string, textoDepois: string, agora = 10_000) {
  return acompanharAvisos(antes, textoAntes, iniciarRevisao(textoDepois).problemas, textoDepois, agora);
}

describe("workspace/avisos — o que o usuário corrigiu digitando", () => {
  test("corrigir um espaço duplo resolve só aquele aviso", () => {
    const antes = partida(TEXTO);
    const novo = TEXTO.replace("etapa  essencial", "etapa essencial");
    const r = depois(antes, TEXTO, novo);
    expect(r.resolvidos.map((p) => p.regraId)).toEqual(["R010"]);
    expect(r.resolvidos[0].paragrafo).toBe(1);
    // O do segundo parágrafo continua, com o "desde" de antes.
    const restante = r.atuais.find((a) => a.problema.regraId === "R010");
    expect(restante?.problema.paragrafo).toBe(2);
    expect(restante?.desde).toBe(0);
  });

  test("digitar em outro lugar não resolve nada, mesmo deslocando os avisos", () => {
    const antes = partida(TEXTO);
    const novo = `Introdução.\n\n${TEXTO}`;
    // (O "Documento muito curto" pode sair, com razão: o texto cresceu.)
    expect(depois(antes, TEXTO, novo).resolvidos.filter((p) => p.regraId === "R010")).toEqual([]);
  });

  test("aviso passageiro da própria digitação não entra no histórico", () => {
    // O aviso apareceu agora há pouco (desde = 9 s) e some 1 s depois.
    const comErro = TEXTO.replace("grande  e", "grande   e");
    const recentes = iniciarRevisao(comErro).problemas.map((problema) => ({ problema, desde: 9_000 }));
    const r = depois(recentes, comErro, TEXTO.replace("grande  e", "grande e"));
    expect(r.resolvidos).toEqual([]);
  });

  test("aviso novo começa a contar agora", () => {
    const antes = partida(TEXTO);
    const novo = TEXTO.replace("editorial.", "editorial ."); // espaço antes da pontuação
    const r = depois(antes, TEXTO, novo, 12_345);
    const novoAviso = r.atuais.find((a) => a.problema.regraId === "R001");
    expect(novoAviso?.desde).toBe(12_345);
  });
});
