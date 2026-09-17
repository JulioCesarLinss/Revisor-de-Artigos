/**
 * Módulo `ai` — orquestração do assistente IA (Sprint 3).
 * Limites do [[Cérebro do Projeto]]:
 * - IA é assistente, nunca juiz normativo (DC-02). As regras do catálogo
 *   continuam sendo a referência primária de conformidade.
 * - IA é opcional: se falhar ou não estiver configurada, o fluxo principal
 *   continua funcionando (DC-03).
 * - Toda alteração por IA tem rastro, distinguível da correção manual (DC-13).
 */

export interface ConfiguracaoIA {
  apiKey: string;
  /** Endpoint compatível com OpenAI (default: api.openai.com). */
  baseUrl?: string;
  /** Modelo de conversação (default: gpt-4o-mini, custo baixo). */
  modelo?: string;
}

export type StatusIA = "nao_configurada" | "pronta" | "indisponivel";

export interface SugestaoIA {
  /** Versão reescrita do trecho, sugerida pela IA. */
  textoSugerido: string;
  /** Explicação contextual: por que a mudança é recomendada. */
  explicacao: string;
  /** Regra do catálogo associada, quando a sugestão parte de um problema. */
  regraId?: string;
  paragrafo: number;
}

export type ResultadoSugestao =
  | { ok: true; sugestao: SugestaoIA }
  | { ok: false; motivo: string };
