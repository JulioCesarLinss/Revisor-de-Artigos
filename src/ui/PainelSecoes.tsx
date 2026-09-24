import type { LinhaRelatorio } from "../review/secoes";

interface Props {
  secoes: LinhaRelatorio[];
  /** Recebe os índices de parágrafos da seção para a navegação ao trecho. */
  onFocarSecao: (indices: number[]) => void;
}

/** Indicador de conformidade da seção (verde = sem problemas). */
function statusSecao(l: LinhaRelatorio): { cor: string; rotulo: string } {
  if (l.problemas === 0) return { cor: "var(--emerald)", rotulo: "em conformidade" };
  if (l.criticos > 0) return { cor: "var(--crimson)", rotulo: "problemas críticos" };
  if (l.advertencias > 0) return { cor: "var(--amber)", rotulo: "advertências" };
  return { cor: "var(--cobalt-dark)", rotulo: "observações" };
}

export function PainelSecoes({ secoes, onFocarSecao }: Props) {
  if (secoes.length === 0) return null;

  return (
    <div className="resumo-card">
      <h2>Conformidade por seção</h2>
      {/* H6: legenda explica as abreviações da linha antes do primeiro uso. */}
      <p className="resumo-legenda">
        Cada linha mostra os parágrafos (¶) da seção e a quantidade de problemas (prob.). Clique para localizar no manuscrito.
      </p>
      <div className="secoes-lista" role="list" aria-label="Relatório de conformidade por seção">
        {secoes.map((l) => {
          const st = statusSecao(l);
          return (
            <button
              key={l.secao}
              type="button"
              className="secao-linha"
              onClick={() => onFocarSecao(l.indices)}
              title={`Seção ${l.secao}: ${st.rotulo}. Clique para localizar no manuscrito.`}
            >
              <span className="secao-dot" style={{ background: st.cor }} role="img" aria-label={st.rotulo} />
              <span className="secao-nome">{l.secao}</span>
              <span className="secao-nums">
                {l.totalParagrafos} ¶ · {l.problemas} prob.
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
