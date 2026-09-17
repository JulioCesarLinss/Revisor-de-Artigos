import { ROTULO_ORIGEM, type RegistroAlteracao } from "../workspace/historico";

interface Props {
  historico: RegistroAlteracao[];
  feedbacks: Record<number, boolean>;
  /** Registra "isso ajudou?" para uma alteração (Sprint 4). */
  onFeedback: (historicoId: number, ajudou: boolean) => void;
}

/** Histórico de alterações com rastro distinguível (DC-13) e feedback (Sprint 4). */
export function PainelHistorico({ historico, feedbacks, onFeedback }: Props) {
  if (historico.length === 0) return null;

  return (
    <div className="resumo-card">
      <h2>Histórico de alterações</h2>
      <ul className="historico-lista">
        {[...historico].reverse().map((h) => {
          const fb = feedbacks[h.id];
          return (
            <li key={h.id}>
              <span className={`historico-origem origem-${h.origem}`}>{ROTULO_ORIGEM[h.origem]}</span>
              <span className="historico-desc">
                ¶{h.paragrafo} — {h.descricao}
              </span>
              <span className="historico-quando">{h.quando}</span>
              {fb === undefined ? (
                <span className="historico-feedback" aria-label="Isso ajudou?">
                  Ajudou?
                  <button type="button" title="Sim, ajudou" onClick={() => onFeedback(h.id, true)}>👍</button>
                  <button type="button" title="Não ajudou" onClick={() => onFeedback(h.id, false)}>👎</button>
                </span>
              ) : (
                <span className={`historico-feedback registrado ${fb ? "positivo" : "negativo"}`}>
                  {fb ? "👍 ajudou" : "👎 não ajudou"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
