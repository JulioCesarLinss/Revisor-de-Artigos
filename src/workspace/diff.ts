import { importarTexto } from "../document/importar";
import type { Manuscrito } from "../document/types";

/**
 * Comparação lado a lado original × revisado (Sprint 4), por parágrafo.
 * Parágrafos idênticos são marcados como iguais; os demais são emparelhados
 * pela posição para exibição comparativa.
 */

export interface LinhaDiff {
  paragrafo: number;
  original: string;
  revisado: string;
  mudou: boolean;
}

export function compararManuscritos(original: string, revisado: string): LinhaDiff[] {
  const a: Manuscrito = importarTexto(original);
  const b: Manuscrito = importarTexto(revisado);
  const total = Math.max(a.paragrafos.length, b.paragrafos.length);

  const linhas: LinhaDiff[] = [];
  for (let i = 0; i < total; i++) {
    const pa = a.paragrafos[i];
    const pb = b.paragrafos[i];
    linhas.push({
      paragrafo: i + 1,
      original: pa?.texto ?? "—",
      revisado: pb?.texto ?? "—",
      mudou: (pa?.texto ?? "") !== (pb?.texto ?? ""),
    });
  }
  return linhas;
}

export function resumoDiff(linhas: LinhaDiff[]): { mudados: number; totais: number } {
  return { mudados: linhas.filter((l) => l.mudou).length, totais: linhas.length };
}
