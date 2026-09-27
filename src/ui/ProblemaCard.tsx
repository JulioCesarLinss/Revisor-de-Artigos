import { useState } from "react";
import type { Problema } from "../rules/types";
import { tituloDaRegra } from "./rotulos";

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

  /**
   * Heurística 5 (Nielsen) — prevenção de erros: a correção determinística
   * substitui o parágrafo sem desfazer, então a aplicação exige confirmação.
   */
  const [confirmar, setConfirmar] = useState(false);

  return (
    <article className="problema-card">
      <div className="problema-topo">
        {/* H6: o código vira reconhecimento ao lado do título legível da regra. */}
        <span className="chip-regra" title={tituloDaRegra(problema.regraId) ?? problema.regraId}>
          {tituloDaRegra(problema.regraId) ?? problema.regraId}
        </span>
        {/* H8: o chip "Regra normativa" repetido em todo card era ruído visual —
            origem já é implícita (painel da análise normativa) e severidade fica. */}
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
              Localizar no manuscrito
            </button>
          )}
          {onSugerir && (
            <button
              className="btn btn-ia"
              type="button"
              onClick={onSugerir}
              disabled={sugerindo}
              aria-busy={sugerindo || undefined}
            >
              {sugerindo ? (
                <>
                  <span className="status-spinner status-spinner-sm" aria-hidden="true" />
                  Pedindo sugestão…
                </>
              ) : (
                "Sugerir com IA"
              )}
            </button>
          )}
          {problema.acao && !confirmar && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setConfirmar(true)}
              title="Abre a confirmação antes de alterar o manuscrito"
            >
              Aplicar correção
            </button>
          )}
          {problema.acao && confirmar && (
            <span className="problema-confirmacao" role="group" aria-label={`Confirmar correção em ${local}`}>
              <span>Corrigir {local.toLowerCase()}?</span>
              {/* H7: foco direto no Confirmar — Enter confirma; Tab alcança Cancelar. */}
              <button
                className="btn btn-primary"
                type="button"
                autoFocus
                onClick={() => {
                  onCorrigir(problema);
                  setConfirmar(false);
                }}
              >
                Confirmar
              </button>
              <button className="btn" type="button" onClick={() => setConfirmar(false)}>
                Cancelar
              </button>
            </span>
          )}
        </div>
      )}
    </article>
  );
}
