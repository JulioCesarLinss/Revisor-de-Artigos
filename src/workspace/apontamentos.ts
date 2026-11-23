import { ehDoArtigo, type DiagnosticoGemini } from "../ai/gemini.js";
import { ajustarTrechos, faixaAlterada, localizarApontamento } from "./destaques.js";
import { posicoesParagrafos } from "./paragrafos.js";

/**
 * Apontamentos do Gemini acompanhando a edição. Cada um guarda onde está o
 * trecho no texto:
 * - de linguagem (ortografia, gramática, pontuação): mexer no trecho resolve,
 *   e ele sai da lista — como os avisos das regras;
 * - sobre o artigo (estrutura, conteúdo, sentido): nunca sai sozinho; a
 *   posição só acompanha o texto, para o "Localizar". Sai com "Conferir"
 *   (o Gemini confirma) ou "Já resolvi".
 */

/** Preenche `id` e `posicao` de quem ainda não tem, procurando o trecho em `texto`. */
export function posicionarApontamentos(diagnosticos: DiagnosticoGemini[], texto: string): DiagnosticoGemini[] {
  const posicoes = posicoesParagrafos(texto);
  const textos = posicoes.map((p) => texto.slice(p.inicio, p.fim));
  let proximoId = diagnosticos.reduce((maior, d) => Math.max(maior, d.id ?? 0), 0) + 1;
  return diagnosticos.map((original) => {
    const d = original.id === undefined ? { ...original, id: proximoId++ } : original;
    if (d.posicao || d.paragrafo <= 0) return d;
    const achado = localizarApontamento(textos, d);
    const base = achado ? posicoes[achado.paragrafo - 1] : undefined;
    if (!achado || !base) return d;
    return { ...d, posicao: { inicio: base.inicio + achado.posicao.inicio, fim: base.inicio + achado.posicao.fim } };
  });
}

/**
 * O texto mudou de `antes` para `depois`: o apontamento de linguagem cujo
 * trecho foi tocado sai (resolvido); o do artigo continua, com o trecho
 * cobrindo o que foi escrito no lugar; os outros acompanham o deslocamento.
 */
export function acompanharApontamentos(
  diagnosticos: DiagnosticoGemini[],
  antes: string,
  depois: string,
): { diagnosticos: DiagnosticoGemini[]; resolvidos: DiagnosticoGemini[] } {
  if (antes === depois) return { diagnosticos, resolvidos: [] };
  const resolvidos: DiagnosticoGemini[] = [];
  const faixa = faixaAlterada(antes, depois);
  const deslocamento = depois.length - antes.length;
  const restantes: DiagnosticoGemini[] = [];
  for (const d of diagnosticos) {
    if (!d.posicao) {
      restantes.push(d);
      continue;
    }
    const [ajustada] = ajustarTrechos([d.posicao], antes, depois);
    if (ajustada) restantes.push({ ...d, posicao: ajustada });
    else if (!ehDoArtigo(d)) resolvidos.push(d);
    else {
      // Tocado, mas é sobre o artigo: o trecho passa a cobrir o texto novo.
      const inicio = Math.min(d.posicao.inicio, faixa.inicio);
      const fim = Math.min(depois.length, Math.max(faixa.fimDepois, d.posicao.fim + deslocamento, inicio));
      restantes.push({ ...d, posicao: { inicio, fim } });
    }
  }
  return { diagnosticos: restantes, resolvidos };
}

/** Tamanho máximo da descrição no histórico. */
const LIMITE_DESCRICAO = 90;

/** Como o apontamento resolvido aparece no histórico, ex.: "Gemini — Gramática: Concordância verbal." */
export function descreverApontamento(d: Pick<DiagnosticoGemini, "categoria" | "descricao">, prefixo = "Gemini"): string {
  const texto = `${prefixo} — ${d.categoria}: ${d.descricao.replace(/\s+/g, " ").trim()}`;
  return texto.length <= LIMITE_DESCRICAO ? texto : `${texto.slice(0, LIMITE_DESCRICAO - 1).trimEnd()}…`;
}
