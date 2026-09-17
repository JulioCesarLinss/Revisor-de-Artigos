/**
 * Registro de alterações com rastro (DC-13): cada entrada distingue se veio de
 * correção manual/rápida (determinística) ou de sugestão aceita da IA.
 */

export type OrigemAlteracao = "manual" | "ia";

export interface RegistroAlteracao {
  id: number;
  origem: OrigemAlteracao;
  /** "Aplicar correção" (determinística) ou descrição da sugestão IA. */
  descricao: string;
  paragrafo: number;
  quando: string;
}

let proximoId = 1;

export function novoHistorico(): RegistroAlteracao[] {
  return [];
}

export function registrar(
  historico: RegistroAlteracao[],
  entrada: { origem: OrigemAlteracao; descricao: string; paragrafo: number },
): RegistroAlteracao[] {
  return [
    ...historico,
    {
      id: proximoId++,
      ...entrada,
      quando: new Date().toLocaleTimeString("pt-BR"),
    },
  ];
}

export const ROTULO_ORIGEM: Record<OrigemAlteracao, string> = {
  manual: "Correção manual",
  ia: "Sugestão IA aceita",
};
