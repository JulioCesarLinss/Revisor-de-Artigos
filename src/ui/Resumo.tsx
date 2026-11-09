import { contarApontamentos, type ResultadoDiagnostico } from "../ai/gemini";
import type { AnaliseRevisao } from "../review/orquestrar";

interface Props {
  analise: AnaliseRevisao | null;
  /**
   * Último diagnóstico do Gemini. Entra no resumo só quando deu certo: falha e
   * ausência de diagnóstico deixam o card apenas com as regras normativas.
   */
  diagnostico?: ResultadoDiagnostico | null;
}

export function Resumo({ analise, diagnostico }: Props) {
  const r = analise?.resumo;
  // DC-02: o Gemini complementa; as regras normativas continuam em primeiro.
  const gemini = diagnostico?.ok ? contarApontamentos(diagnostico.diagnosticos) : null;

  return (
    <div className="resumo-card">
      <h2>Resumo da análise</h2>
      {/* H6: legenda que explica os números e o símbolo ¶ sem exigir memorização. */}
      <p className="resumo-legenda">
        ¶ = parágrafo no manuscrito. Críticos pedem atenção imediata; advertências e observações são melhorias.
      </p>

      <h3 className="resumo-subtitulo">Regras normativas</h3>
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

      {/* Diagnóstico do Gemini: os mesmos números, contados por severidade da IA. */}
      {gemini && (
        <div className="resumo-gemini">
          <h3 className="resumo-subtitulo">Diagnóstico com Gemini</h3>
          <div className="resumo-grid">
            <div className="resumo-item total">
              <strong>{gemini.total}</strong>
              <span>Total</span>
            </div>
            <div className="resumo-item critico">
              <strong>{gemini.altos}</strong>
              <span>Alta</span>
            </div>
            <div className="resumo-item advertencia">
              <strong>{gemini.medios}</strong>
              <span>Média</span>
            </div>
            <div className="resumo-item observacao">
              <strong>{gemini.baixos}</strong>
              <span>Baixa</span>
            </div>
          </div>
          <p className="resumo-legenda">
            Apontamentos complementares do Gemini — eles não substituem as regras normativas.
          </p>
        </div>
      )}
    </div>
  );
}
