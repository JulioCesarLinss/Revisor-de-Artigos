import { describe, expect, test } from "bun:test";
import { statusIA, sugerirReescrita } from "../ai/assistente";
import { aplicarCorrecao } from "../document/acoes";
import { aplicarSugestao } from "../document/aplicarSugestao";
import { iniciarRevisao } from "../review/orquestrar";
import { compararManuscritos } from "../workspace/diff";
import { estadoInicial, proximoEstado, registrarVersao } from "../workspace/fluxo";
import { novoHistorico, registrar } from "../workspace/historico";

/**
 * Sprint 5 — testes automatizados dos caminhos principais (P0):
 * cada teste conduz um fluxo real de uso de ponta a ponta, no nível de
 * domínio, como exigem [[Testes de Qualidade]].
 */

const MANUSCRITO = [
  "INTRODUÇÃO",
  "A inteligência artificial vem transformando a produção científica .",
  "METODOLOGIA",
  "Realizamos uma revisão da produção recente  sobre o tema (Silva 2021).",
  "REFERÊNCIAS",
  "SILVA, M. Bioética médica. 2021",
].join("\n\n");

describe("Sprint 5 — caminhos principais", () => {
  test("caminho 1: importar → analisar → corrigir → reanalisar → avançar fluxo", () => {
    let estado = estadoInicial();
    expect(estado).toBe("rascunho");

    const primeira = iniciarRevisao(MANUSCRITO);
    expect(primeira.resumo.total).toBeGreaterThan(0);
    expect(primeira.secoes.length).toBeGreaterThan(0);

    // aplicar todas as correções rápidas disponíveis
    let texto = MANUSCRITO;
    for (let i = 0; i < 10; i++) {
      const analise = iniciarRevisao(texto);
      const alvo = analise.problemas.find((p) => p.acao);
      if (!alvo) break;
      texto = aplicarCorrecao(texto, alvo.acao!, alvo.paragrafo);
    }

    const segunda = iniciarRevisao(texto);
    expect(segunda.resumo.total).toBeLessThan(primeira.resumo.total);

    // avança no fluxo guiado com snapshots
    const versoes = registrarVersao([], { estado, bruto: MANUSCRITO, totalProblemas: primeira.resumo.total });
    estado = proximoEstado(estado)!;
    const versoesFinais = registrarVersao(versoes, { estado, bruto: texto, totalProblemas: segunda.resumo.total });
    expect(versoesFinais.length).toBe(2);

    // comparação lado a lado entre as versões
    const diff = compararManuscritos(MANUSCRITO, texto);
    expect(diff.some((l) => l.mudou)).toBe(true);
  });

  test("caminho 2: sugestão IA aceita com rastro no histórico", () => {
    const bruto = "Parágrafo que será reescrito pela assistência.";
    const sugestao = { textoSugerido: "Parágrafo reescrito de forma acadêmica.", explicacao: "Tom formal.", paragrafo: 1 };

    const novo = aplicarSugestao(bruto, sugestao, sugestao.textoSugerido);
    expect(novo).toBe(sugestao.textoSugerido);

    let h = novoHistorico();
    h = registrar(h, { origem: "ia", descricao: "sugestão aceita", paragrafo: 1 });
    expect(h[0].origem).toBe("ia");
  });

  test("caminho 3: sem chave de IA o fluxo permanece 100% funcional (DC-03)", () => {
    expect(statusIA(null)).toBe("nao_configurada");
    const analise = iniciarRevisao(MANUSCRITO);
    expect(analise.resumo.total).toBeGreaterThan(0);
  });

  test("caminho 4: falha de rede da IA não quebra o fluxo (timeout/DNS)", async () => {
    const resultado = await sugerirReescrita(
      { apiKey: "chave-de-teste", baseUrl: "http://localhost:1" }, // porta fechada
      "trecho de teste",
      1,
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo.length).toBeGreaterThan(0);
  });

  test("caminho 5: documento realista completo — 0 a N problemas sem travar", () => {
    const titulos = ["INTRODUÇÃO", "METODOLOGIA", "RESULTADOS", "CONSIDERAÇÕES FINAIS"];
    const partes: string[] = [];
    for (let i = 0; i < 30; i++) {
      partes.push(i % 7 === 0 ? titulos[i / 7] ?? "DISCUSSÃO" : `Parágrafo ${i} com conteúdo acadêmico razoável e pontuação final.`);
    }
    const analise = iniciarRevisao(partes.join("\n\n"));
    expect(analise.manuscrito.paragrafos.length).toBe(30);
    expect(analise.secoes.length).toBeGreaterThan(0);
  });
});
