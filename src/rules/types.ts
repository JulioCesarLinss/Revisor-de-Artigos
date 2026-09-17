import type { Manuscrito } from "../document/types";

/** Severidade indica o impacto do problema (ver Glossário do CEREBRO). */
export type Severidade = "critico" | "advertencia" | "observacao";
export type Categoria = "estrutura" | "formatacao";

/** Ação determinística disponível para o usuário — nunca inferência de IA. */
export type AcaoRapida = "removerEspacosPontuacao" | "adicionarPontoFinal" | "colapsarEspacos";

/** Campos mínimos de um problema (DC-08 em docs/03-decisoes-tecnologias.md). */
export interface Problema {
  id: string;
  regraId: string;
  categoria: Categoria;
  severidade: Severidade;
  mensagem: string;
  referencia: string;
  /** Parágrafo afetado (1-based); 0 indica problema do documento inteiro. */
  paragrafo: number;
  /** Excerto localizável do trecho. */
  trecho: string;
  acao?: AcaoRapida;
}

/** Uma regra deve ser legível e testável isoladamente, sem consultar a UI. */
export interface Regra {
  id: string;
  titulo: string;
  severidade: Severidade;
  categoria: Categoria;
  mensagem: string;
  referencia: string;
  avaliar: (manuscrito: Manuscrito) => Problema[];
}

/** Compacta espaços e limita o excerto para exibição. */
export function trechoDe(texto: string, limite = 90): string {
  const compacto = texto.replace(/\s+/g, " ").trim();
  return compacto.length <= limite
    ? compacto
    : `${compacto.slice(0, limite - 1).trimEnd()}…`;
}
