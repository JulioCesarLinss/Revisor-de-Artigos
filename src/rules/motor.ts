import type { Manuscrito } from "../document/types";
import { CATALOGO } from "./catalogo";
import type { Problema, Severidade } from "./types";

const ORDEM_SEVERIDADE: Record<Severidade, number> = {
  critico: 0,
  advertencia: 1,
  observacao: 2,
};

/**
 * Aplica todas as regras do catálogo ao Manuscrito e devolve a lista de
 * problemas ordenada por severidade e, em seguida, por posição no documento.
 * Os ids são determinísticos: mesma entrada produz mesma saída.
 */
export function avaliarManuscrito(manuscrito: Manuscrito): Problema[] {
  const encontrados = CATALOGO.flatMap((regra) => regra.avaliar(manuscrito));

  encontrados.sort(
    (a, b) =>
      ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] ||
      a.paragrafo - b.paragrafo ||
      a.regraId.localeCompare(b.regraId),
  );

  return encontrados.map((p, i) => ({ ...p, id: `${p.regraId}-${i + 1}` }));
}
