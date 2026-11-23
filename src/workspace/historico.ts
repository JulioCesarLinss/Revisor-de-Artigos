/**
 * Registro de alterações com rastro (DC-13). Origem de cada entrada:
 * - "manual": botão "Aplicar correção" (correção automática das regras; o
 *   nome ficou de versões antigas e continua salvo assim);
 * - "edicao": o usuário corrigiu digitando e o erro sumiu (aviso das regras ou
 *   apontamento do Gemini), ou resolveu um apontamento sobre o artigo;
 * - "ia": sugestão do assistente aceita.
 */

export type OrigemAlteracao = "manual" | "edicao" | "ia";

export interface RegistroAlteracao {
  id: number;
  origem: OrigemAlteracao;
  /** O erro corrigido (nome da regra ou o apontamento do Gemini). */
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
  manual: "Correção automática",
  edicao: "Correção manual",
  ia: "Sugestão da IA aceita",
};
