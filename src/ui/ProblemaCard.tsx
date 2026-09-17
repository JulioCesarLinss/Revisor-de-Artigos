import type { Problema } from "../rules/types";

interface Props {
  problema: Problema;
  onCorrigir: (problema: Problema) => void;
  /** Navega até o trecho problema no manuscrito (Sprint 2). */
  onLocalizar: () => void;
  /** Presente quando a assistência IA está configurada (Sprint 3). */
  onSugerir?: () => void;
  sugerindo?: boolean;
}

const ROTULO_SEVERIDADE = {
  critico: "Crítico",
  advertencia: "Advertência",
  observacao: "Observação",
} as const;

export function ProblemaCard({ problema, onCorrigir, onLocalizar, onSugerir, sugerindo }: Props) {
  const local = problema.paragrafo > 0 ? `Parágrafo ${problema.paragrafo}` : "Documento inteiro";

  return (
    <article className="problema-card">
      <div className="problema-topo">
        <span className="chip-regra">{problema.regraId}</span>
        <span className="chip-origem">Regra normativa</span>
        <span className={`badge-sev ${problema.severidade}`}>{ROTULO_SEVERIDADE[problema.severidade]}</span>
      </div>

      <p className="problema-msg">
        <strong>{local}:</strong> {problema.mensagem}
      </p>

      <button type="button" onClick={onLocalizar} className="problema-trecho" title="Localizar no manuscrito">
        “{problema.trecho}”
      </button>

      <span className="problema-ref">Ref.: {problema.referencia}</span>

      {(problema.acao || problema.paragrafo > 0) && (
        <div className="problema-acoes">
          {problema.paragrafo > 0 && (
            <button className="btn" type="button" onClick={onLocalizar}>
              Localizar no texto
            </button>
          )}
          {onSugerir && (
            <button className="btn btn-ia" type="button" onClick={onSugerir} disabled={sugerindo}>
              {sugerindo ? "Pedindo sugestão…" : "Sugerir com IA"}
            </button>
          )}
          {problema.acao && (
            <button className="btn btn-primary" type="button" onClick={() => onCorrigir(problema)}>
              Aplicar correção
            </button>
          )}
        </div>
      )}
    </article>
  );
}
