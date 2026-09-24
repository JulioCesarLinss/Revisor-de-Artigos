import { useState } from "react";
import type { SugestaoIA } from "../ai/types";
import type { Manuscrito } from "../document/types";
import { tituloDaRegra } from "./rotulos";

interface Props {
  sugestao: SugestaoIA;
  manuscrito: Manuscrito;
  onAceitar: (textoFinal: string) => void;
  onIgnorar: () => void;
  /** Presente quando a sugestão está sendo buscada da IA (Heurística 1). */
  sugerindo?: boolean;
}

/** Painel da sugestão IA: aceitar / editar / ignorar (Sprint 3 + H1 + H5). */
export function PainelSugestao({ sugestao, manuscrito, onAceitar, onIgnorar, sugerindo = false }: Props) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(sugestao.textoSugerido);

  const original = manuscrito.paragrafos.find((p) => p.index === sugestao.paragrafo)?.texto ?? "";

  /**
   * Heurística 5 (Nielsen) — prevenção de erros: impedir aceitar um parágrafo
   * vazio (destruiria o conteúdo do manuscrito) e avisar que sair da edição
   * sem aceitar descarta o que foi digitado.
   */
  const vazio = texto.trim().length === 0;
  const editado = texto !== sugestao.textoSugerido;

  const iniciarEdicao = () => {
    setTexto(sugestao.textoSugerido);
    setEditando(true);
  };

  const cancelarEdicao = () => {
    // Descartar a edição volta ao estado inicial da sugestão (sem conteúdo perdido).
    setTexto(sugestao.textoSugerido);
    setEditando(false);
  };

  return (
    <article className="problema-card sugestao-card" aria-busy={sugerindo || undefined}>
      <div className="problema-topo">
        {/* H6: título legível da regra em vez de código cru (quando existir). */}
        <span className="chip-regra">{tituloDaRegra(sugestao.regraId) ?? sugestao.regraId ?? "Geral"}</span>
        <span className="chip-ia">Sugestão IA</span>
        {sugerindo && <span className="chip-ia" role="status">carregando…</span>}
        {sugestao.paragrafo > 0 && <span className="problema-ref">Parágrafo {sugestao.paragrafo}</span>}
      </div>

      <div className="sugestao-diff">
        <div>
          <span className="diff-rotulo diff-antes">Atual</span>
          <p>{original}</p>
        </div>
        <div>
          <span className="diff-rotulo diff-depois">Sugerido</span>
          {editando ? (
            <label className="sugestao-editor-wrap">
              <span className="sr-only">Versão sugerida (editável)</span>
              <textarea
                className="sugestao-editor"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                autoFocus
              />
              {vazio && (
                <span className="sugestao-aviso" role="alert">
                  O parágrafo não pode ficar vazio.
                </span>
              )}
            </label>
          ) : (
            <p>{texto}</p>
          )}
        </div>
      </div>

      <p className="sugestao-explicacao">
        <strong>Por quê:</strong> {sugestao.explicacao}
      </p>
      <p className="sugestao-nota">
        A IA sugere; a decisão editorial e a conformidade normativa continuam com você e com as regras.
      </p>

      <div className="problema-acoes">
        {sugerindo ? (
          <p className="sugestao-nota" role="status" aria-live="polite">
            <span className="status-spinner status-spinner-sm" aria-hidden="true" /> Buscando sugestão da IA…
          </p>
        ) : editando ? (
          <>
            {editado && (
              <span className="sugestao-nota" role="note">
                Sair da edição sem aceitar descarta as alterações.
              </span>
            )}
            <button className="btn" type="button" onClick={cancelarEdicao}>
              Cancelar edição
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => onAceitar(texto)}
              disabled={vazio}
              title={vazio ? "O parágrafo não pode ficar vazio" : "Substitui o parágrafo no manuscrito"}
            >
              Aceitar versão editada
            </button>
          </>
        ) : (
          <>
            <button className="btn" type="button" onClick={onIgnorar}>
              Ignorar
            </button>
            <button className="btn" type="button" onClick={iniciarEdicao}>
              Editar antes
            </button>
            <button className="btn btn-primary" type="button" onClick={() => onAceitar(texto)}>
              Aceitar sugestão
            </button>
          </>
        )}
      </div>
    </article>
  );
}
