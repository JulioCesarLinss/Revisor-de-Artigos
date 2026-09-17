import { describe, expect, test } from "bun:test";
import { aplicarCorrecao } from "../document/acoes";
import { iniciarRevisao } from "./orquestrar";

const EXEMPLO = [
  "Este parágrafo tem um espaço antes da pontuação .",
  'Ele abriu aspas "mas nunca fechou.',
  "Um parágrafo final que não tem pontuação nem problema grave além disso",
].join("\n\n");

describe("review/orquestrar (fluxo principal da Sprint 1)", () => {
  test("importar → analisar produz problemas com resumo consistente", () => {
    const analise = iniciarRevisao(EXEMPLO);
    expect(analise.manuscrito.paragrafos.length).toBe(3);
    expect(analise.problemas.length).toBeGreaterThan(0);
    expect(analise.resumo.total).toBe(analise.problemas.length);
    expect(analise.resumo.advertencias).toBeGreaterThan(0);
  });

  test("problemas vêm ordenados por severidade e posição", () => {
    const { problemas } = iniciarRevisao(EXEMPLO);
    const ordem = { critico: 0, advertencia: 1, observacao: 2 };
    for (let i = 1; i < problemas.length; i++) {
      const anterior = ordem[problemas[i - 1].severidade];
      const atual = ordem[problemas[i].severidade];
      expect(atual >= anterior).toBe(true);
    }
  });

  test("corrigir → reanalisar reduz os problemas sem perder conteúdo", () => {
    const primeira = iniciarRevisao(EXEMPLO);
    const alvo = primeira.problemas.find((p) => p.acao === "removerEspacosPontuacao");
    expect(alvo).toBeDefined();

    const corrigido = aplicarCorrecao(EXEMPLO, alvo!.acao!, alvo!.paragrafo);
    const segunda = iniciarRevisao(corrigido);

    expect(segunda.resumo.total).toBeLessThan(primeira.resumo.total);
    // critério de aceitação: nenhuma perda de conteúdo — remoção de espaço só
    // altera whitespace; todos os caracteres não-branco permanecem intactos.
    expect(corrigido.replace(/\s+/g, "")).toBe(EXEMPLO.replace(/\s+/g, ""));
  });

  test("mesma entrada produz saída determinística", () => {
    const a = iniciarRevisao(EXEMPLO);
    const b = iniciarRevisao(EXEMPLO);
    expect(a.problemas.map((p) => p.id)).toEqual(b.problemas.map((p) => p.id));
  });
});
