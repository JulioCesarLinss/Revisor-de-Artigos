import { useMemo, useState } from "react";
import { compararManuscritos, resumoDiff } from "../workspace/diff";
import { ROTULO_ESTADO, type VersaoSnapshot } from "../workspace/fluxo";

interface Props {
  versoes: VersaoSnapshot[];
  estadoAtual: "rascunho" | "revisao" | "final";
  textoAtual: string;
}

/** Comparação lado a lado original × sugerido (Sprint 4). */
export function ComparacaoView({ versoes, estadoAtual, textoAtual }: Props) {
  const referencia = useMemo(() => {
    // Comparar contra o último snapshot de um estado anterior ao atual.
    const ordem = ["rascunho", "revisao", "final"];
    const iAtual = ordem.indexOf(estadoAtual);
    for (let i = iAtual - 1; i >= 0; i--) {
      const v = [...versoes].reverse().find((x) => x.estado === ordem[i]);
      if (v) return v;
    }
    return undefined;
  }, [versoes, estadoAtual]);

  if (!referencia) {
    return (
      <div className="empty-card" aria-live="polite">
        <h3>Sem versão anterior para comparar</h3>
        <p>Avance no fluxo para registrar uma versão e poder comparar lado a lado.</p>
      </div>
    );
  }

  const linhas = compararManuscritos(referencia.bruto, textoAtual);
  const { mudados } = resumoDiff(linhas);

  /**
   * Heurística 8 (Nielsen) — design estético e minimalista: a comparação existe
   * para mostrar o que mudou, então os parágrafos idênticos começam ocultos;
   * o alternador "Ver tudo" atende quem quer reler o documento inteiro.
   */
  const [mostrarIguais, setMostrarIguais] = useState(false);
  const visiveis = mostrarIguais ? linhas : linhas.filter((l) => l.mudou);

  return (
    <div className="comparacao-wrap">
      <div className="comparacao-cabecalho" role="status" aria-live="polite">
        <span>
          Comparando <strong>{ROTULO_ESTADO[referencia.estado]}</strong> × <strong>{ROTULO_ESTADO[estadoAtual]}</strong> — {mudados} parágrafo(s) alterado(s)
        </span>
        <span className="comparacao-quando">versão de {referencia.quando}</span>
      </div>
      {/* H6: legenda explica a numeração e destaca o que mudou. */}
      <p className="resumo-legenda">
        A numeração ¶ identifica cada parágrafo comparado; fundo amarelo indica parágrafo alterado.
      </p>
      <div className="comparacao-grid">
        {visiveis.map((l) => (
          <div key={l.paragrafo} className={`comparacao-par ${l.mudou ? "mudou" : "igual"}`}>
            <span className="comparacao-num">¶{l.paragrafo}</span>
            <div className="comparacao-col">
              <span className="diff-rotulo diff-antes">{ROTULO_ESTADO[referencia.estado]}</span>
              <p>{l.original}</p>
            </div>
            <div className="comparacao-col">
              <span className="diff-rotulo diff-depois">{ROTULO_ESTADO[estadoAtual]}</span>
              <p>{l.revisado}</p>
            </div>
          </div>
        ))}
      </div>
      {linhas.length > mudados && (
        <div className="comparacao-ocultos">
          <button className="btn" type="button" onClick={() => setMostrarIguais((v) => !v)}>
            {mostrarIguais
              ? "Ocultar parágrafos sem alteração"
              : `Ver os ${linhas.length - mudados} parágrafo(s) sem alteração`}
          </button>
          {!mostrarIguais && <span>Somente os {mudados} parágrafo(s) alterado(s) estão listados.</span>}
        </div>
      )}
    </div>
  );
}
