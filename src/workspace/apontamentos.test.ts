import { describe, expect, test } from "bun:test";
import type { DiagnosticoGemini } from "../ai/gemini";
import { acompanharApontamentos, posicionarApontamentos } from "./apontamentos";

const TEXTO = "Introdução\n\nOs dados foi coletados ontem.\n\nO problmas está na conclusão.";

function apontamento(extra: Partial<DiagnosticoGemini>): DiagnosticoGemini {
  return { paragrafo: 2, categoria: "Gramática", descricao: "Erro.", sugestao: "", severidade: "media", ...extra };
}

describe("workspace/apontamentos — posição de cada apontamento", () => {
  test("acha o trecho e guarda a posição absoluta no texto", () => {
    const [d] = posicionarApontamentos([apontamento({ trecho: "dados foi" })], TEXTO);
    expect(d.posicao).toBeDefined();
    expect(TEXTO.slice(d.posicao!.inicio, d.posicao!.fim)).toBe("dados foi");
  });

  test("apontamento do artigo inteiro ou sem trecho achado fica sem posição", () => {
    const lista = posicionarApontamentos(
      [apontamento({ paragrafo: 0, categoria: "Estrutura" }), apontamento({ trecho: "não existe aqui" })],
      TEXTO,
    );
    expect(lista.every((d) => d.posicao === undefined)).toBe(true);
    // Sem o campo (o Firestore recusa undefined).
    expect("posicao" in lista[0]).toBe(false);
  });

  test("cada apontamento ganha um id estável, sem repetir os que já existem", () => {
    const lista = posicionarApontamentos([apontamento({ id: 4 }), apontamento({}), apontamento({})], TEXTO);
    expect(lista.map((d) => d.id)).toEqual([4, 5, 6]);
  });

  test("não refaz a posição de quem já tem", () => {
    const [d] = posicionarApontamentos([apontamento({ trecho: "dados foi", posicao: { inicio: 1, fim: 2 } })], TEXTO);
    expect(d.posicao).toEqual({ inicio: 1, fim: 2 });
  });
});

describe("workspace/apontamentos — acompanhar a edição", () => {
  const lista = posicionarApontamentos(
    [
      apontamento({ trecho: "dados foi" }),
      apontamento({ paragrafo: 3, trecho: "problmas" }),
      apontamento({ paragrafo: 0, categoria: "Estrutura", descricao: "Falta metodologia." }),
    ],
    TEXTO,
  );

  test("corrigir um trecho tira só aquele apontamento", () => {
    const depois = TEXTO.replace("problmas", "problema");
    const r = acompanharApontamentos(lista, TEXTO, depois);
    expect(r.resolvidos).toBe(1);
    expect(r.diagnosticos.map((d) => d.trecho ?? "")).toEqual(["dados foi", ""]);
  });

  test("editar antes de um trecho só desloca a posição dele", () => {
    const depois = TEXTO.replace("Introdução", "Introdução geral");
    const r = acompanharApontamentos(lista, TEXTO, depois);
    expect(r.resolvidos).toBe(0);
    const dados = r.diagnosticos[0];
    expect(depois.slice(dados.posicao!.inicio, dados.posicao!.fim)).toBe("dados foi");
  });

  test("apontamento sem posição (artigo inteiro) continua até ser marcado como resolvido", () => {
    const depois = TEXTO.replace("dados foi", "dados foram").replace("problmas", "problema");
    const r = acompanharApontamentos(lista, TEXTO, depois);
    expect(r.resolvidos).toBe(2);
    expect(r.diagnosticos).toHaveLength(1);
    expect(r.diagnosticos[0].categoria).toBe("Estrutura");
  });

  test("apontamento sobre o artigo com trecho não some ao editar: o trecho cobre o texto novo", () => {
    const [d] = posicionarApontamentos(
      [apontamento({ trecho: "dados foi coletados", tipo: "conteudo", categoria: "Coerência" })],
      TEXTO,
    );
    const depois = TEXTO.replace("dados foi coletados", "dados foram coletados por entrevista");
    const r = acompanharApontamentos([d], TEXTO, depois);
    expect(r.resolvidos).toBe(0);
    const p = r.diagnosticos[0].posicao!;
    expect(depois.slice(p.inicio, p.fim)).toBe("dados foram coletados por entrevista");
  });

  test("texto igual não muda nada", () => {
    expect(acompanharApontamentos(lista, TEXTO, TEXTO)).toEqual({ diagnosticos: lista, resolvidos: 0 });
  });
});
