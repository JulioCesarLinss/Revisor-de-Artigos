import { Link } from "react-router-dom";

interface Props {
  titulo: string;
  rotaAnterior: { para: string; rotulo: string };
  rotaSeguinte: { para: string; rotulo: string };
}

/** Placeholder simples com o título e a cadeia do fluxo, para as rotas ainda não implementadas. */
export default function PlaceholderPage({ titulo, rotaAnterior, rotaSeguinte }: Props) {
  return (
    <main className="placeholder-main" id="conteudo">
      <div className="placeholder-card">
        <p className="placeholder-aviso">Tela em construção</p>
        <h2>{titulo}</h2>
        <p className="placeholder-texto">
          Esta etapa do fluxo será implementada no próximo ciclo de integração.
        </p>
        <div className="placeholder-navegacao">
          <Link className="btn" to={rotaAnterior.para}>
            ← {rotaAnterior.rotulo}
          </Link>
          <Link className="btn btn-primary" to={rotaSeguinte.para}>
            {rotaSeguinte.rotulo} →
          </Link>
        </div>
      </div>      <p className="placeholder-cadeia">
        Fluxo: Login → Upload → Revisar → Histórico → Laudo → Perfil
      </p>
    </main>
  );
}
