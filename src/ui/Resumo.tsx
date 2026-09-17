import type { AnaliseRevisao } from "../review/orquestrar";

export function Resumo({ analise }: { analise: AnaliseRevisao | null }) {
  const r = analise?.resumo;
  return (
    <div className="resumo-card">
      <h2>Resumo da análise</h2>
      <div className="resumo-grid">
        <div className="resumo-item total">
          <strong>{r?.total ?? 0}</strong>
          <span>Total</span>
        </div>
        <div className="resumo-item critico">
          <strong>{r?.criticos ?? 0}</strong>
          <span>Críticos</span>
        </div>
        <div className="resumo-item advertencia">
          <strong>{r?.advertencias ?? 0}</strong>
          <span>Advert.</span>
        </div>
        <div className="resumo-item observacao">
          <strong>{r?.observacoes ?? 0}</strong>
          <span>Obs.</span>
        </div>
      </div>
    </div>
  );
}
