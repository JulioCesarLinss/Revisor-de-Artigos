import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface Props {
  titulo: string;
  rotaAnterior: { para: string; rotulo: string };
  rotaSeguinte: { para: string; rotulo: string };
  /** Conteúdo real da tela quando já implementado; ausente = em construção. */
  children?: ReactNode;
}

/** Moldura para telas de fluxo ainda sem conteúdo real (com espaço para conteúdo parcial). */
export default function PlaceholderPage({ titulo, rotaAnterior, rotaSeguinte, children }: Props) {
  return (
    <main className="placeholder-main" id="conteudo">
      <div className="placeholder-card">
        {!children && <p className="placeholder-aviso">Tela em construção</p>}
        <h2>{titulo}</h2>
        {children ?? (
          <p className="placeholder-texto">
            Esta etapa do fluxo será implementada no próximo ciclo de integração.
          </p>
        )}
        <div className="placeholder-navegacao">
          <Link className="btn" to={rotaAnterior.para}>
            ← {rotaAnterior.rotulo}
          </Link>
          <Link className="btn btn-primary" to={rotaSeguinte.para}>
            {rotaSeguinte.rotulo} →
          </Link>
        </div>
      </div>
      <p className="placeholder-cadeia">Fluxo: Login → Revisar → Histórico → Laudo → Perfil</p>
    </main>
  );
}
