import { ROTULO_ORIGEM, type RegistroAlteracao } from "../workspace/historico";
import { tituloDaRegra } from "./rotulos";

interface Props {
  historico: RegistroAlteracao[];
  feedbacks: Record<number, boolean>;
  /** Registra "isso ajudou?" para uma alteração (Sprint 4). */
  onFeedback: (historicoId: number, ajudou: boolean) => void;
}

/** Histórico de alterações com rastro distinguível (DC-13) e feedback (Sprint 4). */
export function PainelHistorico({ historico, feedbacks, onFeedback }: Props) {
  if (historico.length === 0) return null;

  /** H6: troca o código da regra pelo título legível, sem esconder o rastro. */
  const descrever = (descricao: string) =>
    descricao.replace(/\(([A-Z]\d{3})\)/, (_, id: string) => `(${tituloDaRegra(id) ?? id})`);

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
                ¶{h.paragrafo} — {descrever(h.descricao)}
              </span>
              <span className="historico-quando">{h.quando}</span>
              {fb === undefined ? (
                <span className="historico-feedback" aria-label="Isso ajudou?">
                  Ajudou?
                  <button type="button" title="Sim, ajudou" aria-label="Sim, ajudou" onClick={() => onFeedback(h.id, true)}>👍</button>
                  <button type="button" title="Não ajudou" aria-label="Não ajudou" onClick={() => onFeedback(h.id, false)}>👎</button>
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
