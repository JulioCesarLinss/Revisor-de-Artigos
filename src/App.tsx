import { Fragment, useState } from "react";
import { Navigate, Route, Routes, Link, useLocation } from "react-router-dom";
import { PainelAjuda } from "./ui/PainelAjuda";
import { encerrarSessao, sessaoAtiva } from "./sessao";
import LoginPage from "./pages/LoginPage";
import RevisarPage from "./pages/RevisarPage";
import PlaceholderPage from "./pages/PlaceholderPage";

const CADEIA = [
  { para: "/upload", rotulo: "Upload" },
  { para: "/revisar", rotulo: "Revisar" },
  { para: "/historico", rotulo: "Histórico" },
  { para: "/laudo", rotulo: "Laudo" },
  { para: "/perfil", rotulo: "Perfil" },
];

/** Portão do sistema: sem sessão, qualquer rota protegida volta para /login. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!sessaoAtiva()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const autenticado = sessaoAtiva();

  const sair = () => {
    encerrarSessao();
    window.location.assign("/login");
  };

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
          {autenticado ? (
            <nav className="app-nav" aria-label="Navegação do sistema">
              {CADEIA.map((e, i) => (
                <Fragment key={e.para}>
                  {/* H8: barra dupla separa visualmente cada item da navegação. */}
                  {i > 0 && (
                    <span className="nav-sep" aria-hidden="true">
                      //
                    </span>
                  )}
                  <Link
                    to={e.para}
                    className={location.pathname === e.para ? "nav-item atual" : "nav-item"}
                    aria-current={location.pathname === e.para ? "page" : undefined}
                    title={`Ir para ${e.rotulo}`}
                  >
                    {e.rotulo}
                  </Link>
                </Fragment>
              ))}
              <button className="nav-item nav-item-acao" type="button" onClick={sair} title="Encerrar a sessão">
                Sair
              </button>
              {/* H10: ponto de entrada sempre visível para a ajuda e documentação. */}
              <button
                className="btn norm-chip-acao"
                type="button"
                onClick={() => setAjudaAberta(true)}
                title="Abrir o guia de uso, atalhos de teclado e significado das severidades"
              >
                Ajuda
              </button>
            </nav>
          ) : (
            <div className="norm-chips" aria-label="Estado do acesso">
              <span className="norm-chip">Acesso restrito — faça login</span>
            </div>
          )}
        </div>
      </header>

      <Routes>
        <Route
          path="/login"
          element={autenticado ? <Navigate to="/revisar" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Navigate to="/revisar" replace />
            </RequireAuth>
          }
        />
        <Route
          path="/upload"
          element={
            <RequireAuth>
              <PlaceholderPage
                titulo="Upload de artigos"
                rotaAnterior={{ para: "/revisar", rotulo: "Revisar" }}
                rotaSeguinte={{ para: "/revisar", rotulo: "Revisar" }}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/revisar"
          element={
            <RequireAuth>
              <RevisarPage />
            </RequireAuth>
          }
        />
        <Route
          path="/historico"
          element={
            <RequireAuth>
              <PlaceholderPage
                titulo="Histórico de versões"
                rotaAnterior={{ para: "/revisar", rotulo: "Revisar" }}
                rotaSeguinte={{ para: "/laudo", rotulo: "Laudo" }}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/laudo"
          element={
            <RequireAuth>
              <PlaceholderPage
                titulo="Laudo ABNT"
                rotaAnterior={{ para: "/historico", rotulo: "Histórico" }}
                rotaSeguinte={{ para: "/perfil", rotulo: "Perfil" }}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/perfil"
          element={
            <RequireAuth>
              <PlaceholderPage
                titulo="Perfil e configurações"
                rotaAnterior={{ para: "/laudo", rotulo: "Laudo" }}
                rotaSeguinte={{ para: "/revisar", rotulo: "Revisar" }}
              />
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <RequireAuth>
              <Navigate to="/revisar" replace />
            </RequireAuth>
          }
        />
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
