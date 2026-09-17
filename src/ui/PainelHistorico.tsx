import { ROTULO_ORIGEM, type RegistroAlteracao } from "../workspace/historico";

/** Histórico de alterações com rastro distinguível (DC-13). */
export function PainelHistorico({ historico }: { historico: RegistroAlteracao[] }) {
  if (historico.length === 0) return null;

  return (
    <div className="resumo-card">
      <h2>Histórico de alterações</h2>
      <ul className="historico-lista">
        {[...historico].reverse().map((h) => (
          <li key={h.id}>
            <span className={`historico-origem origem-${h.origem}`}>{ROTULO_ORIGEM[h.origem]}</span>
            <span className="historico-desc">
              ¶{h.paragrafo} — {h.descricao}
            </span>
            <span className="historico-quando">{h.quando}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
