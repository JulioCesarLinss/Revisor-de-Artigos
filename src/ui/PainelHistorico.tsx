import { ROTULO_ORIGEM, type RegistroAlteracao } from "../workspace/historico";
import { tituloDaRegra } from "./rotulos";

interface Props {
  historico: RegistroAlteracao[];
}

/** Histórico de alterações com rastro distinguível (DC-13). */
export function PainelHistorico({ historico }: Props) {
  if (historico.length === 0) return null;

  /** H6: troca o código da regra pelo título legível, sem esconder o rastro. */
  const descrever = (descricao: string) =>
    descricao.replace(/\(([A-Z]\d{3})\)/, (_, id: string) => `(${tituloDaRegra(id) ?? id})`);

  return (
    <div className="resumo-card">
      <h2>Histórico de alterações</h2>
      <ul className="historico-lista">
        {[...historico].reverse().map((h) => (
          <li key={h.id}>
            <span className={`historico-origem origem-${h.origem}`}>{ROTULO_ORIGEM[h.origem]}</span>
            <span className="historico-desc">
              ¶{h.paragrafo} — {descrever(h.descricao)}
            </span>
            <span className="historico-quando">{h.quando}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
