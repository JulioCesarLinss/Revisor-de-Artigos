import type { AnaliseRevisao } from "../review/orquestrar";

export function Resumo({ analise }: { analise: AnaliseRevisao | null }) {
  const r = analise?.resumo;
  return (
    <div className="resumo-card">
      <h2>Resumo da análise</h2>
      {/* H6: legenda que explica os números e o símbolo ¶ sem exigir memorização. */}
      <p className="resumo-legenda">
        ¶ = parágrafo no manuscrito. Críticos pedem atenção imediata; advertências e observações são melhorias.
      </p>
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
          <span>Advertências</span>
        </div>
        <div className="resumo-item observacao">
          <strong>{r?.observacoes ?? 0}</strong>
          <span>Observações</span>
        </div>
      </div>
    </div>
  );
}
