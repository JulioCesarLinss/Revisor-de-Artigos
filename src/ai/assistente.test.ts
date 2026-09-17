import { describe, expect, test } from "bun:test";
import { aplicarSugestao } from "../document/aplicarSugestao";
import { novoHistorico, registrar } from "../workspace/historico";
import type { SugestaoIA } from "./types";

const SUGESTAO: SugestaoIA = {
  textoSugerido: "A inteligência artificial transforma a produção científica.",
  explicacao: "Forma mais direta e acadêmica.",
  paragrafo: 1,
  regraId: "R005",
};

describe("ai/assistente (Sprint 3)", () => {
  test("aplicarSugestao troca apenas o parágrafo alvo", () => {
    const bruto = "Primeiro parágrafo antigo.\n\nSegundo parágrafo.\n\nTerceiro.";
    const resultado = aplicarSugestao(bruto, SUGESTAO, SUGESTAO.textoSugerido);
    expect(resultado).toBe(
      "A inteligência artificial transforma a produção científica.\n\nSegundo parágrafo.\n\nTerceiro.",
    );
  });

  test("aplicarSugestao preserva separadores e demais parágrafos", () => {
    const bruto = "A\n\n\n\nB\n\nC";
    const resultado = aplicarSugestao(bruto, { ...SUGESTAO, paragrafo: 2 }, "B revisado");
    expect(resultado).toBe("A\n\n\n\nB revisado\n\nC");
  });

  test("histórico distingue origem manual de IA (DC-13)", () => {
    let h = novoHistorico();
    h = registrar(h, { origem: "manual", descricao: "correção rápida aplicada", paragrafo: 1 });
    h = registrar(h, { origem: "ia", descricao: "sugestão aceita (R005)", paragrafo: 1 });
    expect(h[0].origem).toBe("manual");
    expect(h[1].origem).toBe("ia");
    expect(h[1].descricao).toContain("R005");
  });
});
