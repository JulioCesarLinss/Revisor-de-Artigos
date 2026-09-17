import { useEffect } from "react";
import type { Manuscrito } from "../document/types";

interface Props {
  manuscrito: Manuscrito;
  /** Parágrafo alvo da navegação (1-based). */
  alvo: number;
  onVoltar: () => void;
}

/**
 * Navegação até o trecho problema (Sprint 2): o manuscrito é exibido por
 * parágrafos, com o alvo realçado e a rolagem posicionada nele. A edição
 * continua disponível clicando em "Voltar à edição".
 */
export function RevisarView({ manuscrito, alvo, onVoltar }: Props) {
  useEffect(() => {
    document.getElementById(`par-${alvo}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [alvo]);

  useEffect(() => {
    const sair = (e: KeyboardEvent) => {
      if (e.key === "Escape") onVoltar();
    };
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [onVoltar]);

  return (
    <div className="revisar-wrap">
      <div className="revisar-barra">
        <span className="revisar-info">
          Modo revisar — parágrafo <strong>{alvo}</strong> realçado
        </span>
        <button className="btn" type="button" onClick={onVoltar}>
          Voltar à edição (Esc)
        </button>
      </div>
      <div className="manuscrito-revisao">
        {manuscrito.paragrafos.map((p) => (
          <p key={p.index} id={`par-${p.index}`} className={p.index === alvo ? "par-alvo" : undefined}>
            {p.texto}
          </p>
        ))}
      </div>
    </div>
  );
}
