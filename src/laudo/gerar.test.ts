import { describe, expect, test } from "bun:test";
import { encaminhamento, construirLaudo, gerarLaudo, laudoComoTexto } from "./gerar";
import { iniciarRevisao } from "../review/orquestrar";

/**
 * Sprint do laudo — a tela /laudo apura o manuscrito salvo e apresenta o
 * resultado como relatório. Testes de domínio seguem [[Testes de Qualidade]].
 */

const MANUSCRITO = [
  "INTRODUÇÃO",
  "A inteligência artificial vem transformando a produção científica .",
  "METODOLOGIA",
  "Realizamos uma revisão da produção recente sobre o tema (Silva 2021).",
  "REFERÊNCIAS",
  "SILVA, M. Bioética médica. 2021",
].join("\n\n");

describe("laudo/gerar", () => {
  test("laudo apura métricas, resumo e seções da análise", () => {
    const laudo = gerarLaudo(MANUSCRITO);
    expect(laudo.metricas.paragrafos).toBe(6);
    expect(laudo.resumo.total).toBe(iniciarRevisao(MANUSCRITO).resumo.total);
    expect(laudo.secoes.some((s) => s.secao === "INTRODUÇÃO")).toBe(true);
  });

  test("achados ficam ordenados por parágrafo e sem problemas de documento inteiro", () => {
    const laudo = gerarLaudo("Texto curtinho sem título suficiente");
    for (const p of laudo.achados) expect(p.paragrafo).toBeGreaterThan(0);
    const indices = laudo.achados.map((p) => p.paragrafo);
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  test("severidade máxima dirige o encaminhamento", () => {
    expect(encaminhamento({ maiorSeveridade: "critico", resumo: { total: 1, criticos: 1, advertencias: 0, observacoes: 0 } }).titulo).toContain("correções críticas");
    expect(encaminhamento({ maiorSeveridade: null, resumo: { total: 0, criticos: 0, advertencias: 0, observacoes: 0 } }).titulo).toContain("conformidade");
  });

  test("rótulos do encaminhamento são palavras comuns (sem 'Advertencial'/'Empregável')", () => {
    const resumo = { total: 0, criticos: 0, advertencias: 0, observacoes: 0 };
    const titulos = (["critico", "advertencia", "observacao", null] as const).map(
      (s) => encaminhamento({ maiorSeveridade: s, resumo }).titulo,
    );
    for (const t of titulos) expect(t).not.toMatch(/Advertencial|Empregável/);
    expect(titulos[1]).toBe("Com ressalvas — ajustes recomendados antes da entrega");
    expect(titulos[3]).toBe("Em conformidade — nenhuma pendência normativa");
  });

  test("texto do laudo contém cabeçalho, resumo e rodapé legíveis", () => {
    const laudo = construirLaudo(iniciarRevisao(MANUSCRITO));
    const texto = laudoComoTexto(laudo);
    expect(texto).toContain("LAUDO NORMAREVIEW AI");
    expect(texto).toContain("CONFORMIDADE POR SEÇÃO");
    expect(texto).toContain("REFERÊNCIAS");
    expect(texto).toContain("IA apenas assistente");
  });

  test("texto vazio produz laudo vazio sem travar a tela", () => {
    const laudo = gerarLaudo("");
    expect(laudo.metricas.paragrafos).toBe(0);
    // R006 (documento muito curto) é apontada como problema do documento
    // inteiro: entra no resumo, mas não na lista de achados por parágrafo.
    expect(laudo.resumo.total).toBe(1);
    expect(laudo.achados.length).toBe(0);
    expect(laudo.secoes.length).toBe(0);
  });
});
