import { ORDEM_FLUXO, ROTULO_ESTADO, type EstadoFluxo } from "../workspace/fluxo";

interface Props {
  estado: EstadoFluxo;
  podeAvancar: boolean;
  onAvancar: () => void;
  onVoltar: () => void;
}

/** Condução do processo: rascunho → revisão → versão final (Sprint 4). */
export function BarraFluxo({ estado, podeAvancar, onAvancar, onVoltar }: Props) {
  const indiceAtual = ORDEM_FLUXO.indexOf(estado);
  const seguinte = indiceAtual < ORDEM_FLUXO.length - 1 ? ORDEM_FLUXO[indiceAtual + 1] : null;

  return (
    <div className="fluxo-barra" role="navigation" aria-label="Etapas da revisão guiada">
      {ORDEM_FLUXO.map((e, i) => (
        <span key={e} className={`fluxo-etapa ${i <= indiceAtual ? "ativa" : ""} ${e === estado ? "atual" : ""}`}>
          <span className="fluxo-num">{i + 1}</span> {ROTULO_ESTADO[e]}
        </span>
      ))}

      <span className="fluxo-acoes">
        {indiceAtual > 0 && (
          <button className="btn" type="button" onClick={onVoltar}>
            Voltar etapa
          </button>
        )}
        {seguinte && (
          <button className="btn btn-primary" type="button" onClick={onAvancar} disabled={!podeAvancar}>
            Avançar para {ROTULO_ESTADO[seguinte]}
          </button>
        )}
        {!seguinte && <span className="fluxo-fim">Revisão concluída ✓</span>}
      </span>
    </div>
  );
}
