import { importarTexto } from "../document/importar.js";
import type { Manuscrito } from "../document/types.js";
import { relatorioPorSecao, type LinhaRelatorio } from "./secoes.js";
import { avaliarManuscrito } from "../rules/motor.js";
import type { Problema } from "../rules/types.js";

export interface ResumoRevisao {
  total: number;
  criticos: number;
  advertencias: number;
  observacoes: number;
}

export function resumir(problemas: Problema[]): ResumoRevisao {
  return {
    total: problemas.length,
    criticos: problemas.filter((p) => p.severidade === "critico").length,
    advertencias: problemas.filter((p) => p.severidade === "advertencia").length,
    observacoes: problemas.filter((p) => p.severidade === "observacao").length,
  };
}

export interface AnaliseRevisao {
  manuscrito: Manuscrito;
  problemas: Problema[];
  resumo: ResumoRevisao;
  /** Relatório de conformidade por seção (Sprint 2). */
  secoes: LinhaRelatorio[];
}

/**
 * Orquestra a revisão (contrato `review` → `ui`): a UI recebe uma estrutura
 * pronta para apresentação e não precisa saber como cada regra funciona.
 */
export function iniciarRevisao(bruto: string): AnaliseRevisao {
  const manuscrito = importarTexto(bruto);
  const problemas = avaliarManuscrito(manuscrito);
  return { manuscrito, problemas, resumo: resumir(problemas), secoes: relatorioPorSecao(manuscrito, problemas) };
}
