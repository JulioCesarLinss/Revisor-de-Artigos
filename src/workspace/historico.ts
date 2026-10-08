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
  // Id auto-recuperável: mesmo que o histórico restaurado venha de outro
  // processo (ou em qualquer ordem), o próximo id nunca colide com os existentes.
  const id = Math.max(proximoId, historico.reduce((maior, e) => Math.max(maior, e.id), 0) + 1);
  proximoId = id + 1;
  return [
    ...historico,
    {
      id,
      ...entrada,
      quando: new Date().toLocaleTimeString("pt-BR"),
    },
  ];
}

export const ROTULO_ORIGEM: Record<OrigemAlteracao, string> = {
  manual: "Correção manual",
  ia: "Sugestão IA aceita",
};
