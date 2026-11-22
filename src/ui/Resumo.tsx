import { contarApontamentos, type ResultadoDiagnostico } from "../ai/gemini";
import type { AnaliseRevisao } from "../review/orquestrar";

interface Props {
  analise: AnaliseRevisao | null;
  /** Último diagnóstico do Gemini; só entra na soma quando deu certo. */
  diagnostico?: ResultadoDiagnostico | null;
}

/**
 * Resumo da análise: um total só, somando os avisos das regras e os
 * apontamentos do Gemini (pedido do usuário: não dividir por origem). A
 * severidade do Gemini entra na faixa equivalente — alta como crítico,
 * média como advertência, baixa como observação —, a mesma correspondência
 * de cores do painel do Gemini.
 */
export function Resumo({ analise, diagnostico }: Props) {
  const r = analise?.resumo;
  const g = diagnostico?.ok ? contarApontamentos(diagnostico.diagnosticos) : null;

  const total = (r?.total ?? 0) + (g?.total ?? 0);
  const criticos = (r?.criticos ?? 0) + (g?.altos ?? 0);
  const advertencias = (r?.advertencias ?? 0) + (g?.medios ?? 0);
  const observacoes = (r?.observacoes ?? 0) + (g?.baixos ?? 0);

  return (
    <div className="resumo-card">
      <h2>Resumo da análise</h2>
      <div className="resumo-grid">
        <div className="resumo-item total">
          <strong>{total}</strong>
          <span>Total</span>
        </div>
        <div className="resumo-item critico">
          <strong>{criticos}</strong>
          <span>Críticos</span>
        </div>
        <div className="resumo-item advertencia">
          <strong>{advertencias}</strong>
          <span>Advertências</span>
        </div>
        <div className="resumo-item observacao">
          <strong>{observacoes}</strong>
          <span>Observações</span>
        </div>
      </div>
    </div>
  );
}
