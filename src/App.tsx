import { useState } from "react";
import { Navigate, Route, Routes, Link, useLocation, useNavigate } from "react-router-dom";
import { PainelAjuda } from "./ui/PainelAjuda";
import { encerrarSessao } from "./sessao";
import { sair as sairFirebase, useAutorizacao } from "./firebase/auth";
import LoginPage from "./pages/LoginPage";
import RevisarPage from "./pages/RevisarPage";
import PerfilPage from "./pages/PerfilPage";
import HistoricoPage from "./pages/HistoricoPage";
import LaudoPage from "./pages/LaudoPage";
import { limparWorkspace } from "./workspace/armazenamento";

const CADEIA = [
  { para: "/revisar", rotulo: "Revisar" },
  { para: "/historico", rotulo: "Histórico" },
  { para: "/laudo", rotulo: "Laudo" },
  { para: "/perfil", rotulo: "Perfil" },
];

/** Portão do sistema: sem sessão, qualquer rota protegida volta para /login. */
function RequireAuth({ pronto, autenticado, children }: { pronto: boolean; autenticado: boolean; children: React.ReactNode }) {
  // Com Firebase, aguarda a primeira verificação de sessão antes de decidir.
  if (!pronto) return null;
  if (!autenticado) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const navegar = useNavigate();
  const [ajudaAberta, setAjudaAberta] = useState(false);
  // Estado de sessão unificado: Firebase Auth quando configurado, senão local.
  const { pronto, autenticado } = useAutorizacao();

  // Sair encerra a sessão (Firebase + local), descarta o workspace e volta ao login.
  const sair = () => {
    void sairFirebase();
    encerrarSessao();
    limparWorkspace();
    navegar("/login", { replace: true });
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
          {autenticado && (
            <nav className="app-nav" aria-label="Navegação do sistema">
              {CADEIA.map((e) => (
                <Link
                  key={e.para}
                  to={e.para}
                  className={location.pathname === e.para ? "nav-item atual" : "nav-item"}
                  aria-current={location.pathname === e.para ? "page" : undefined}
                  title={`Ir para ${e.rotulo}`}
                >
                  {e.rotulo}
                </Link>
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
            <RequireAuth pronto={pronto} autenticado={autenticado}>
              <Navigate to="/revisar" replace />
            </RequireAuth>
          }
        />
        <Route
          path="/revisar"
          element={
            <RequireAuth pronto={pronto} autenticado={autenticado}>
              <RevisarPage />
            </RequireAuth>
          }
        />
        <Route
          path="/historico"
          element={
            <RequireAuth pronto={pronto} autenticado={autenticado}>
              <HistoricoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/laudo"
          element={
            <RequireAuth pronto={pronto} autenticado={autenticado}>
              <LaudoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/perfil"
          element={
            <RequireAuth pronto={pronto} autenticado={autenticado}>
              <PerfilPage />
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <RequireAuth pronto={pronto} autenticado={autenticado}>
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
