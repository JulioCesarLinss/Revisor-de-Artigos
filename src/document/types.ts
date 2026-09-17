/**
 * Módulo `document` — entrada, representação e saída do texto/Manuscrito.
 * Não contém regras de revisão nem lógica de IA (ver docs/02-arquitetura-modulos.md).
 */

export interface ParagrafoManuscrito {
  /** Número do parágrafo no documento, começando em 1. */
  index: number;
  texto: string;
}

export interface Manuscrito {
  /** Texto bruto importado — fonte de verdade; nada do conteúdo é descartado. */
  bruto: string;
  paragrafos: ParagrafoManuscrito[];
  totalCaracteres: number;
  totalPalavras: number;
}

export function contarPalavras(texto: string): number {
  return texto
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function contarParagrafos(bruto: string): number {
  return bruto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0).length;
}
