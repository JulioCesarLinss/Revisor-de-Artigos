import { describe, expect, test } from "bun:test";
import { ajustarTrechos, localizarTrecho, unirTrechos } from "./destaques";

/** Texto apontado por cada marca, para os testes lerem como o usuário vê. */
const lidos = (texto: string, trechos: { inicio: number; fim: number }[]) =>
  trechos.map((t) => texto.slice(t.inicio, t.fim));

const TEXTO = "um ERRO dois ERRO tres ERRO quatro ERRO fim";
const posicoes = (texto: string) =>
  [...texto.matchAll(/ERRO/g)].map((m) => ({ inicio: m.index ?? 0, fim: (m.index ?? 0) + 4 }));

describe("workspace/destaques — cada erro tem a própria marca", () => {
  test("corrigir um dos 4 erros apaga só a marca dele", () => {
    const depois = TEXTO.replace("dois ERRO", "dois certo");
    const marcas = ajustarTrechos(posicoes(TEXTO), TEXTO, depois);
    expect(marcas.length).toBe(3);
    expect(lidos(depois, marcas)).toEqual(["ERRO", "ERRO", "ERRO"]);
    expect(depois.slice(marcas[1].fim, marcas[2].inicio)).toBe(" quatro ");
  });

  test("digitar fora das marcas mantém todas, no lugar certo", () => {
    const depois = TEXTO.replace("tres", "tres mais texto");
    const marcas = ajustarTrechos(posicoes(TEXTO), TEXTO, depois);
    expect(marcas.length).toBe(4);
    expect(lidos(depois, marcas)).toEqual(["ERRO", "ERRO", "ERRO", "ERRO"]);
  });

  test("apagar texto antes das marcas também as acompanha", () => {
    const depois = TEXTO.slice(3);
    expect(lidos(depois, ajustarTrechos(posicoes(TEXTO), TEXTO, depois))).toEqual(["ERRO", "ERRO", "ERRO", "ERRO"]);
  });

  test("digitar logo depois da marca conta como mexer nela (o ponto que faltava)", () => {
    const depois = TEXTO.replace("um ERRO", "um ERRO.");
    expect(ajustarTrechos(posicoes(TEXTO), TEXTO, depois).length).toBe(3);
  });

  test("digitar um espaço antes do espaço que precede a marca não a apaga", () => {
    const depois = TEXTO.replace("um ERRO", "um  ERRO");
    expect(lidos(depois, ajustarTrechos(posicoes(TEXTO), TEXTO, depois))).toEqual(["ERRO", "ERRO", "ERRO", "ERRO"]);
  });

  test("apagar um espaço de um espaço duplo apaga a marca dele", () => {
    const antes = "a  b  c";
    const marcas = [{ inicio: 1, fim: 3 }, { inicio: 4, fim: 6 }];
    const depois = "a b  c";
    expect(ajustarTrechos(marcas, antes, depois)).toEqual([{ inicio: 3, fim: 5 }]);
  });

  test("texto igual não muda nada", () => {
    expect(ajustarTrechos(posicoes(TEXTO), TEXTO, TEXTO).length).toBe(4);
  });

  test("texto trocado por inteiro apaga as marcas", () => {
    expect(ajustarTrechos(posicoes(TEXTO), TEXTO, "outro documento")).toEqual([]);
  });

  test("unirTrechos ordena, junta sobrepostos e mantém os encostados separados", () => {
    expect(
      unirTrechos([
        { inicio: 10, fim: 12 },
        { inicio: 0, fim: 4 },
        { inicio: 2, fim: 6 },
        { inicio: 12, fim: 14 },
        { inicio: 20, fim: 20 },
      ]),
    ).toEqual([
      { inicio: 0, fim: 6 },
      { inicio: 10, fim: 12 },
      { inicio: 12, fim: 14 },
    ]);
  });
});

describe("workspace/destaques — trecho citado pela IA", () => {
  test("acha o trecho exato", () => {
    expect(localizarTrecho("Os dados foi coletados ontem.", "dados foi coletados")).toEqual({ inicio: 3, fim: 22 });
  });

  test("tolera espaços e maiúsculas diferentes, e marca o que está no texto", () => {
    const texto = "Os dados  foi coletados ontem.";
    const achado = localizarTrecho(texto, "DADOS foi coletados");
    expect(achado && texto.slice(achado.inicio, achado.fim)).toBe("dados  foi coletados");
  });

  test("caracteres especiais do trecho não quebram a busca", () => {
    expect(localizarTrecho("Segundo (Silva 2021) [sic].", "(Silva 2021) [sic]")).toEqual({ inicio: 8, fim: 26 });
  });

  test("trecho que não está no parágrafo, vazio ou ausente devolve null", () => {
    expect(localizarTrecho("Texto real.", "frase inventada")).toBeNull();
    expect(localizarTrecho("Texto real.", "   ")).toBeNull();
    expect(localizarTrecho("Texto real.", undefined)).toBeNull();
  });
});
