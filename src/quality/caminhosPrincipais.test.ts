import { describe, expect, test } from "bun:test";
import { aplicarCorrecao } from "../document/acoes";
import { iniciarRevisao } from "../review/orquestrar";
import { desempilhar, empilhar } from "../workspace/desfazer";

/**
 * Sprint 5 — testes automatizados dos caminhos principais (P0):
 * cada teste conduz um fluxo real de uso de ponta a ponta, no nível de
 * domínio, como exigem [[Testes de Qualidade]].
 */

const TOTAL_PARAGRAFOS = 30;

const MANUSCRITO = [
  "INTRODUÇÃO",
  "A inteligência artificial vem transformando a produção científica .",
  "METODOLOGIA",
  "Realizamos uma revisão da produção recente  sobre o tema (Silva 2021).",
  "REFERÊNCIAS",
  "SILVA, M. Bioética médica. 2021",
].join("\n\n");

/** Exige que a IA tenha falhado e devolve o motivo, sem asserção condicional. */
describe("Sprint 5 — caminhos principais", () => {
  test("caminho 1: importar → analisar → corrigir → reanalisar → desfazer", () => {
    const primeira = iniciarRevisao(MANUSCRITO);
    expect(primeira.resumo.total).toBeGreaterThan(0);
    expect(primeira.secoes.length).toBeGreaterThan(0);

    // aplicar todas as correções rápidas disponíveis, guardando o "Desfazer"
    let texto = MANUSCRITO;
    let pilha: string[] = [];
    for (let i = 0; i < 10; i++) {
      const analise = iniciarRevisao(texto);
      const alvo = analise.problemas.find((p) => p.acao);
      if (!alvo) break;
      pilha = empilhar(pilha, texto);
      texto = aplicarCorrecao(texto, alvo.acao!, alvo.paragrafo);
    }

    const segunda = iniciarRevisao(texto);
    expect(segunda.resumo.total).toBeLessThan(primeira.resumo.total);

    // desfazer todas as correções volta ao manuscrito importado
    let passo = desempilhar(pilha);
    while (passo) {
      texto = passo.estado;
      passo = desempilhar(passo.pilha);
    }
    expect(texto).toBe(MANUSCRITO);
  });

  test("caminho 2: documento realista completo — 0 a N problemas sem travar", () => {
    const titulos = ["INTRODUÇÃO", "METODOLOGIA", "RESULTADOS", "CONSIDERAÇÕES FINAIS"];
    const partes: string[] = [];
    for (let i = 0; i < TOTAL_PARAGRAFOS; i++) {
      partes.push(i % 7 === 0 ? titulos[i / 7] ?? "DISCUSSÃO" : `Parágrafo ${i} com conteúdo acadêmico razoável e pontuação final.`);
    }
    const analise = iniciarRevisao(partes.join("\n\n"));
    expect(analise.manuscrito.paragrafos.length).toBe(TOTAL_PARAGRAFOS);
    expect(analise.secoes.length).toBeGreaterThan(0);
  });
});
