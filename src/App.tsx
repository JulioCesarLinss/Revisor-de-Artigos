import { useState } from "react";
import { Navigate, Route, Routes, Link, useLocation } from "react-router-dom";
import { PainelAjuda } from "./ui/PainelAjuda";
import LoginPage from "./pages/LoginPage";
import RevisarPage from "./pages/RevisarPage";
import PlaceholderPage from "./pages/PlaceholderPage";

const CADEIA = [
  { para: "/login", rotulo: "Login" },
  { para: "/upload", rotulo: "Upload" },
  { para: "/revisar", rotulo: "Revisar" },
  { para: "/historico", rotulo: "Histórico" },
  { para: "/laudo", rotulo: "Laudo" },
  { para: "/perfil", rotulo: "Perfil" },
];

/** Layout compartilhado: cabeçalho e rodapé presentes em todas as rotas. */
export default function App() {
  const location = useLocation();
  const [ajudaAberta, setAjudaAberta] = useState(false);

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/revisar" className="brand" title="Ir para a revisão">
            <h1>
              NormaReview <span>AI</span>
            </h1>
            <p>Regras normativas como base confiável; IA como assistente opcional.</p>
          </Link>
          <div className="norm-chips" aria-label="Normas de referência e navegação">
            <span className="norm-chip">NBR 14724</span>
            <span className="norm-chip">NBR 10520</span>
            <span className="norm-chip">NBR 6023</span>
            {CADEIA.map((e) => (
              <Link
                key={e.para}
                to={e.para}
                className={location.pathname === e.para ? "norm-chip nav-chip atual" : "norm-chip nav-chip"}
                aria-current={location.pathname === e.para ? "page" : undefined}
                title={`Ir para ${e.rotulo}`}
              >
                {e.rotulo}
              </Link>
            ))}
            {/* H10: ponto de entrada sempre visível para a ajuda e documentação. */}
            <button
              className="btn norm-chip-acao"
              type="button"
              onClick={() => setAjudaAberta(true)}
              title="Abrir o guia de uso, atalhos de teclado e significado das severidades"
            >
              Ajuda
            </button>
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/upload"
          element={
            <PlaceholderPage
              titulo="Upload de artigos"
              rotaAnterior={{ para: "/login", rotulo: "Login" }}
              rotaSeguinte={{ para: "/revisar", rotulo: "Revisar" }}
            />
          }
        />
        <Route path="/revisar" element={<RevisarPage />} />
        <Route
          path="/historico"
          element={
            <PlaceholderPage
              titulo="Histórico de versões"
              rotaAnterior={{ para: "/revisar", rotulo: "Revisar" }}
              rotaSeguinte={{ para: "/laudo", rotulo: "Laudo" }}
            />
          }
        />
        <Route
          path="/laudo"
          element={
            <PlaceholderPage
              titulo="Laudo ABNT"
              rotaAnterior={{ para: "/historico", rotulo: "Histórico" }}
              rotaSeguinte={{ para: "/perfil", rotulo: "Perfil" }}
            />
          }
        />
        <Route
          path="/perfil"
          element={
            <PlaceholderPage
              titulo="Perfil e configurações"
              rotaAnterior={{ para: "/laudo", rotulo: "Laudo" }}
              rotaSeguinte={{ para: "/revisar", rotulo: "Revisar" }}
            />
          }
        />
        <Route path="/" element={<Navigate to="/revisar" replace />} />
        <Route path="*" element={<Navigate to="/revisar" replace />} />
      </Routes>

      {/* H10: a ajuda sobreposta exige reconhecimento imediato e saída clara. */}
      {ajudaAberta && <PainelAjuda onFechar={() => setAjudaAberta(false)} />}

      {/* H8: o rodapé repete o que a barra de fluxo e o histórico já dizem;
          uma linha mínima de identidade basta. */}
      <footer className="app-footer">
        <span>© 2026 NormaReview AI · Fluxo de revisão guiada</span>
      </footer>
    </>
  );
}
