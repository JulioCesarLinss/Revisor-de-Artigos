import { describe, expect, test } from "bun:test";
import {
  ajustarFormatacao,
  alternarEstilo,
  estilosEm,
  partesFormatadas,
  type Estilo,
  type TrechoFormatado,
} from "./formatacao";

const TEXTO = "uma frase de teste";
/** "frase" em negrito. */
const NEGRITO: TrechoFormatado[] = [{ inicio: 4, fim: 9, estilo: "negrito" }];
const lidos = (texto: string, trechos: TrechoFormatado[], estilo: Estilo = "negrito") =>
  trechos.filter((t) => t.estilo === estilo).map((t) => texto.slice(t.inicio, t.fim));

describe("workspace/formatacao — aplicar à seleção", () => {
  test("seleção sem o estilo recebe; seleção toda com o estilo perde", () => {
    const aplicado = alternarEstilo([], "negrito", 4, 9);
    expect(lidos(TEXTO, aplicado)).toEqual(["frase"]);
    expect(alternarEstilo(aplicado, "negrito", 4, 9)).toEqual([]);
  });

  test("tirar o estilo do meio divide a faixa", () => {
    const r = alternarEstilo([{ inicio: 0, fim: 18, estilo: "negrito" }], "negrito", 4, 9);
    expect(lidos(TEXTO, r)).toEqual(["uma ", " de teste"]);
  });

  test("seleção só em parte com o estilo: completa em vez de tirar", () => {
    expect(lidos(TEXTO, alternarEstilo(NEGRITO, "negrito", 0, 9))).toEqual(["uma frase"]);
  });

  test("estilos diferentes não se misturam", () => {
    const r = alternarEstilo(NEGRITO, "italico", 4, 9);
    expect(lidos(TEXTO, r, "negrito")).toEqual(["frase"]);
    expect(lidos(TEXTO, r, "italico")).toEqual(["frase"]);
  });
});

describe("workspace/formatacao — botões ligados", () => {
  test("sem seleção, vale o caractere antes do cursor", () => {
    expect(estilosEm(NEGRITO, 9, 9)).toEqual(["negrito"]); // logo depois de "frase"
    expect(estilosEm(NEGRITO, 4, 4)).toEqual([]); // logo antes
    expect(estilosEm(NEGRITO, 6, 6)).toEqual(["negrito"]);
  });

  test("com seleção, só liga o que cobre tudo", () => {
    expect(estilosEm(NEGRITO, 4, 9)).toEqual(["negrito"]);
    expect(estilosEm(NEGRITO, 0, 9)).toEqual([]);
  });

  test("no início do texto, vale o primeiro caractere", () => {
    expect(estilosEm([{ inicio: 0, fim: 3, estilo: "italico" }], 0, 0)).toEqual(["italico"]);
  });
});

describe("workspace/formatacao — texto mudando", () => {
  test("com o botão ligado, o que se digita sai no estilo", () => {
    const depois = "uma frase de testes";
    const r = ajustarFormatacao([], TEXTO, depois, ["negrito"]);
    expect(lidos(depois, r)).toEqual(["s"]);
  });

  test("letras seguidas no estilo viram uma faixa só", () => {
    let trechos: TrechoFormatado[] = [];
    let texto = "";
    for (const letra of "abc") {
      const novo = texto + letra;
      trechos = ajustarFormatacao(trechos, texto, novo, ["negrito"]);
      texto = novo;
    }
    expect(trechos).toEqual([{ inicio: 0, fim: 3, estilo: "negrito" }]);
  });

  test("com o botão desligado, digitar no meio do negrito abre uma brecha", () => {
    const depois = "uma frXase de teste";
    expect(lidos(depois, ajustarFormatacao(NEGRITO, TEXTO, depois, []))).toEqual(["fr", "ase"]);
  });

  test("texto antes da faixa a desloca, sem perder o estilo", () => {
    const depois = "ainda uma frase de teste";
    expect(lidos(depois, ajustarFormatacao(NEGRITO, TEXTO, depois, []))).toEqual(["frase"]);
  });

  test("apagar o trecho formatado apaga a faixa; apagar parte a encurta", () => {
    expect(ajustarFormatacao(NEGRITO, TEXTO, "uma  de teste", [])).toEqual([]);
    const depois = "uma fra de teste";
    expect(lidos(depois, ajustarFormatacao(NEGRITO, TEXTO, depois, []))).toEqual(["fra"]);
  });

  test("substituir uma seleção usa os estilos ligados", () => {
    const depois = "uma X de teste";
    expect(lidos(depois, ajustarFormatacao(NEGRITO, TEXTO, depois, ["negrito"]))).toEqual(["X"]);
  });

  test("sem estilos informados (correção), o texto de dentro herda da faixa", () => {
    const depois = "uma fraXse de teste";
    expect(lidos(depois, ajustarFormatacao(NEGRITO, TEXTO, depois))).toEqual(["fraXse"]);
  });

  test("texto igual não muda nada", () => {
    expect(ajustarFormatacao(NEGRITO, TEXTO, TEXTO, ["italico"])).toBe(NEGRITO);
  });
});

describe("workspace/formatacao — partes", () => {
  test("divide onde os estilos mudam, sem perder texto", () => {
    const trechos: TrechoFormatado[] = [...NEGRITO, { inicio: 7, fim: 12, estilo: "sublinhado" }];
    const partes = partesFormatadas(TEXTO, 0, trechos);
    expect(partes.map((p) => p.texto).join("")).toBe(TEXTO);
    expect(partes.map((p) => [p.texto, p.estilos])).toEqual([
      ["uma ", []],
      ["fra", ["negrito"]],
      ["se", ["negrito", "sublinhado"]],
      [" de", ["sublinhado"]],
      [" teste", []],
    ]);
  });

  test("respeita a posição de um pedaço no meio do texto", () => {
    const partes = partesFormatadas(TEXTO.slice(6), 6, NEGRITO);
    expect(partes.map((p) => [p.inicio, p.texto, p.estilos])).toEqual([
      [6, "ase", ["negrito"]],
      [9, " de teste", []],
    ]);
  });

  test("texto vazio não gera partes", () => {
    expect(partesFormatadas("", 0, NEGRITO)).toEqual([]);
  });
});
