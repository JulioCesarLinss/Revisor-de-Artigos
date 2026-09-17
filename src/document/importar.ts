import { contarPalavras, type Manuscrito, type ParagrafoManuscrito } from "./types";

/**
 * Importa texto bruto (colagem) para a representação interna do Manuscrito.
 * Parágrafos são separados por linha em branco. Nada do conteúdo é descartado:
 * o texto bruto continua sendo a fonte de verdade da edição manual.
 */
export function importarTexto(bruto: string): Manuscrito {
  const paragrafos: ParagrafoManuscrito[] = bruto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((texto, i) => ({ index: i + 1, texto }));

  return {
    bruto,
    paragrafos,
    totalCaracteres: bruto.length,
    totalPalavras: contarPalavras(bruto),
  };
}
