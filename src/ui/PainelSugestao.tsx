import { useState } from "react";
import type { SugestaoIA } from "../ai/types";
import type { Manuscrito } from "../document/types";

interface Props {
  sugestao: SugestaoIA;
  manuscrito: Manuscrito;
  onAceitar: (textoFinal: string) => void;
  onIgnorar: () => void;
}

/** Painel da sugestão IA: aceitar / editar / ignorar (Sprint 3). */
export function PainelSugestao({ sugestao, manuscrito, onAceitar, onIgnorar }: Props) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(sugestao.textoSugerido);

  const original = manuscrito.paragrafos.find((p) => p.index === sugestao.paragrafo)?.texto ?? "";

  return (
    <article className="problema-card sugestao-card">
      <div className="problema-topo">
        <span className="chip-regra">{sugestao.regraId ?? "Geral"}</span>
        <span className="chip-ia">Sugestão IA</span>
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
            <textarea
              className="sugestao-editor"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              autoFocus
            />
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
        {editando ? (
          <>
            <button className="btn" type="button" onClick={() => setEditando(false)}>
              Cancelar edição
            </button>
            <button className="btn btn-primary" type="button" onClick={() => onAceitar(texto)}>
              Aceitar versão editada
            </button>
          </>
        ) : (
          <>
            <button className="btn" type="button" onClick={onIgnorar}>
              Ignorar
            </button>
            <button className="btn" type="button" onClick={() => setEditando(true)}>
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
