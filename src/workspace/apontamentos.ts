import type { DiagnosticoGemini } from "../ai/gemini.js";
import { ajustarTrechos, localizarApontamento } from "./destaques.js";
import { posicoesParagrafos } from "./paragrafos.js";

/**
 * Apontamentos do Gemini acompanhando a edição: cada um guarda onde está o
 * trecho no texto; mexer nesse trecho resolve o apontamento e ele sai da
 * lista. Os que falam do parágrafo ou do artigo inteiro (sem trecho achado)
 * ficam até o usuário marcar "Já resolvi" ou pedir um novo diagnóstico.
 */

/** Preenche `posicao` de quem ainda não tem, procurando o trecho em `texto`. */
export function posicionarApontamentos(diagnosticos: DiagnosticoGemini[], texto: string): DiagnosticoGemini[] {
  const posicoes = posicoesParagrafos(texto);
  const textos = posicoes.map((p) => texto.slice(p.inicio, p.fim));
  return diagnosticos.map((d) => {
    if (d.posicao || d.paragrafo <= 0) return d;
    const achado = localizarApontamento(textos, d);
    const base = achado ? posicoes[achado.paragrafo - 1] : undefined;
    if (!achado || !base) return d;
    return { ...d, posicao: { inicio: base.inicio + achado.posicao.inicio, fim: base.inicio + achado.posicao.fim } };
  });
}

/**
 * O texto mudou de `antes` para `depois`: o apontamento cujo trecho foi
 * tocado sai (resolvido); os outros acompanham o deslocamento.
 */
export function acompanharApontamentos(
  diagnosticos: DiagnosticoGemini[],
  antes: string,
  depois: string,
): { diagnosticos: DiagnosticoGemini[]; resolvidos: number } {
  if (antes === depois) return { diagnosticos, resolvidos: 0 };
  const restantes: DiagnosticoGemini[] = [];
  for (const d of diagnosticos) {
    if (!d.posicao) {
      restantes.push(d);
      continue;
    }
    const [ajustada] = ajustarTrechos([d.posicao], antes, depois);
    if (ajustada) restantes.push({ ...d, posicao: ajustada });
  }
  return { diagnosticos: restantes, resolvidos: diagnosticos.length - restantes.length };
}
