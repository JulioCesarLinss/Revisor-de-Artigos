/**
 * Posição de cada parágrafo no texto bruto — base do destaque no editor.
 * Segue a mesma separação de `importarTexto` (document/importar): parágrafos
 * divididos por linha em branco, aparados, vazios descartados. Assim o
 * número que as regras apontam é o mesmo parágrafo destacado aqui (teste
 * em paragrafos.test.ts garante a equivalência).
 */

export interface PosicaoParagrafo {
  /** Número do parágrafo (1, 2, …), igual ao da análise. */
  index: number;
  /** Início do texto aparado, no texto bruto. */
  inicio: number;
  /** Fim (exclusivo) do texto aparado, no texto bruto. */
  fim: number;
}

const SEPARADOR = /\n\s*\n/g;

export function posicoesParagrafos(bruto: string): PosicaoParagrafo[] {
  const posicoes: PosicaoParagrafo[] = [];
  const registrar = (inicioTrecho: number, fimTrecho: number) => {
    const trecho = bruto.slice(inicioTrecho, fimTrecho);
    const semInicio = trecho.trimStart();
    if (semInicio.length === 0) return;
    const inicio = inicioTrecho + (trecho.length - semInicio.length);
    const fim = inicio + semInicio.trimEnd().length;
    posicoes.push({ index: posicoes.length + 1, inicio, fim });
  };

  let anterior = 0;
  for (const separador of bruto.matchAll(SEPARADOR)) {
    const inicioSeparador = separador.index ?? 0;
    registrar(anterior, inicioSeparador);
    anterior = inicioSeparador + separador[0].length;
  }
  registrar(anterior, bruto.length);
  return posicoes;
}
