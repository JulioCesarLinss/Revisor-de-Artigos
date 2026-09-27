import { useState } from "react";
import { ORDEM_FLUXO, ROTULO_ESTADO, type EstadoFluxo } from "../workspace/fluxo";

interface Props {
  estado: EstadoFluxo;
  podeAvancar: boolean;
  onAvancar: () => void;
  onVoltar: () => void;
  /** Verdadeiro quando uma etapa está sendo registrada (Heurística 1). */
  processando?: boolean;
  /** H9: quando o avanço está bloqueado, explica por quê e como destravar. */
  motivoBloqueio?: string;
}

/**
 * Heurística 2 (Nielsen) — correspondência com o mundo real: cada etapa usa o
 * vocabulário do trabalho acadêmico e "concluir" diz explicitamente o que
 * acontece com o documento (versão final registrada, pronta para exportar).
 */
const DESCRICAO_ETAPA: Record<EstadoFluxo, string> = {
  rascunho: "Texto em preparação — a análise normativa aponta o que corrigir.",
  revisao: "Correções aplicadas com o relatório de problemas à vista.",
  final: "Versão concluída para entrega, exportação ou envio ao orientador.",
};

/** Condução do processo: rascunho → revisão → versão final (Sprint 4 + H1 + H2). */
export function BarraFluxo(
  { estado, podeAvancar, onAvancar, onVoltar, processando = false, motivoBloqueio }: Props,
) {
  const indiceAtual = ORDEM_FLUXO.indexOf(estado);
  const seguinte = indiceAtual < ORDEM_FLUXO.length - 1 ? ORDEM_FLUXO[indiceAtual + 1] : null;

  /**
   * Heurística 5 (Nielsen) — prevenção de erros: "Voltar etapa" não registra
   * snapshot da etapa atual, então confirmar evita voltar sem querer.
   */
  const [confirmarVoltar, setConfirmarVoltar] = useState(false);

  return (
    <div className="fluxo-barra" role="navigation" aria-label="Etapas da revisão guiada">
      {ORDEM_FLUXO.map((e, i) => (
        <span
          key={e}
          className={`fluxo-etapa ${i <= indiceAtual ? "ativa" : ""} ${e === estado ? "atual" : ""}`}
          title={DESCRICAO_ETAPA[e]}
        >
          <span className="fluxo-num">{i + 1}</span> {ROTULO_ESTADO[e]}
          <span className="sr-only"> — {DESCRICAO_ETAPA[e]}</span>
        </span>
      ))}

      <span className="fluxo-acoes">
        {indiceAtual > 0 && !confirmarVoltar && (
          <button
            className="btn"
            type="button"
            onClick={() => setConfirmarVoltar(true)}
            disabled={processando}
            title="Abre a confirmação antes de voltar de etapa"
          >
            Voltar etapa
          </button>
        )}
        {indiceAtual > 0 && confirmarVoltar && (
          <span className="problema-confirmacao" role="group" aria-label="Confirmar voltar de etapa">
            <span>Descartar esta etapa sem registrar versão?</span>
            <button
              className="btn"
              type="button"
              autoFocus
              onClick={() => {
                onVoltar();
                setConfirmarVoltar(false);
              }}
            >
              Sim, voltar
            </button>
            <button className="btn btn-primary" type="button" onClick={() => setConfirmarVoltar(false)}>
              Ficar
            </button>
          </span>
        )}
        {seguinte && (
          <button
            className="btn btn-primary"
            type="button"
            onClick={onAvancar}
            disabled={!podeAvancar}
            aria-busy={processando || undefined}
            title={
              motivoBloqueio
                ? `${motivoBloqueio} (atalho: Ctrl+Shift+Enter)`
                : `Registra a versão atual e avança para "${ROTULO_ESTADO[seguinte]}" (atalho: Ctrl+Shift+Enter)`
            }
          >
            {processando ? (
              <>
                <span className="status-spinner status-spinner-sm" aria-hidden="true" /> Registrando versão…
              </>
            ) : (
              /* H7: o atalho fica documentado no próprio botão, sem memorização. */
              <>
                Avançar para {ROTULO_ESTADO[seguinte]}{" "}
                <kbd className="atalho-tecla" aria-hidden="true">
                  Ctrl+Shift+↵
                </kbd>
              </>
            )}
          </button>
        )}
        {!seguinte && (
          <span
            className="fluxo-fim"
            title="Revisão concluída: a versão final foi registrada e o texto pode ser copiado ou exportado."
          >
            <span aria-hidden="true">✓</span> Documento pronto para exportação
            <span className="sr-only">
              . Revisão concluída: a versão final foi registrada e o texto pode ser copiado ou exportado.
            </span>
          </span>
        )}
      </span>
    </div>
  );
}
