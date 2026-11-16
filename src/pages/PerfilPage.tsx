import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { encerrarSessao } from "../sessao";
import {
  carregarPerfil,
  iniciaisDoNome,
  PERFIS,
  rotuloDoPerfil,
  salvarPerfil,
} from "../perfil/perfil";
import { sair as sairFirebase, useAutorizacao } from "../firebase/auth";
import { configurado as firebaseConfigurado } from "../firebase/config";
import { carregarPerfilNuvem, salvarPerfilNuvem } from "../firebase/persistencia";

/**
 * Tela /perfil — dados do autor/revisor e controle da sessão. Persistência
 * local no dispositivo.
 */
export default function PerfilPage() {
  const navegar = useNavigate();

  // Heurística 1 (Nielsen): toda ação dá retorno imediato e legível.
  const [status, setStatus] = useState<string | null>(null);

  // uid e conta do Firebase (quando configurado) — chave da nuvem e preenchimento.
  const { uid, user } = useAutorizacao();

  const salvo = carregarPerfil();
  const [nome, setNome] = useState(salvo?.nome ?? "");
  const [email, setEmail] = useState(salvo?.email ?? "");
  const [perfil, setPerfil] = useState(salvo?.perfil ?? "graduacao");

  // Sem perfil salvo (local ou nuvem), preenche com a conta logada; no modo
  // sem Firebase (user = null) nome e e-mail ficam vazios para digitação.
  useEffect(() => {
    if (carregarPerfil()) return; // perfil salvo tem prioridade sobre a conta
    setNome((atual) => atual || user?.displayName || "");
    setEmail((atual) => atual || user?.email || "");
  }, [uid, user]);

  // Com Firebase, pré-carrega o perfil salvo na nuvem (sobrescreve o local vazio).
  useEffect(() => {
    if (!firebaseConfigurado || !uid) return;
    let cancelado = false;
    void carregarPerfilNuvem(uid).then((nuvem) => {
      if (cancelado || !nuvem) return;
      if (!carregarPerfil()) {
        setNome(nuvem.nome);
        setEmail(nuvem.email);
      }
      setPerfil(nuvem.perfil);
    });
    return () => {
      cancelado = true;
    };
  }, [uid]);

  const salvar = (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length === 0 || email.trim().length === 0) {
      setStatus("Preencha ao menos nome e e-mail para salvar.");
      return;
    }
    salvarPerfil({ nome, email, perfil });
    // Com Firebase, espelha o perfil na nuvem (uid → usuarios/{uid}/dados/perfil).
    if (firebaseConfigurado && uid) {
      void salvarPerfilNuvem(uid, { nome, email, perfil });
      setStatus("Perfil salvo na nuvem e neste dispositivo.");
    } else {
      setStatus("Perfil salvo neste dispositivo.");
    }
  };

  const sair = () => {
    void sairFirebase(); // Firebase Auth, quando configurado
    encerrarSessao();
    navegar("/login", { replace: true });
  };

  const emailConta = (user?.email ?? email).trim();

  return (
    <main className="perfil-main" id="conteudo">
      <div className="perfil-cabecalho">
        <span className="perfil-avatar" aria-hidden="true">
          {iniciaisDoNome(nome)}
        </span>
        <div>
          <h2>{nome.trim() || "Seu perfil"}</h2>
          <p>{email.trim() || "Complete os dados para personalizar o fluxo de revisão."}</p>
          <span className="perfil-chip">{rotuloDoPerfil(perfil)}</span>
        </div>
      </div>

      {status && (
        <p className="status-sistema" role="status" aria-live="polite">
          {status}
        </p>
      )}

      <div className="perfil-grid">
        {/* Dados do autor/revisor */}
        <form className="perfil-card" onSubmit={salvar}>
          <h3>Dados de identificação</h3>
          <p className="perfil-card-dica">
            Usados na padronização ABNT de folhas de rosto e referências.
          </p>

          <label className="perfil-campo">
            <span>Nome completo</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex: Dr. Marcelo da Silva Junior"
            />
          </label>

          <label className="perfil-campo">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              readOnly
              placeholder="ex: marcelo.silva@ufrj.br"
            />
            <small className="perfil-card-dica">vem da sua conta</small>
          </label>

          <label className="perfil-campo">
            <span>Perfil de utilização principal</span>
            <select value={perfil} onChange={(e) => setPerfil(e.target.value)}>
              {PERFIS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </label>

          <button className="btn btn-primary" type="submit">
            Salvar perfil
          </button>
        </form>

        <div className="perfil-coluna">
          {/* Sessão */}
          <section className="perfil-card" aria-label="Sessão">
            <h3>Sessão</h3>
            <p className="ia-status">
              {emailConta ? `Você está conectado como ${emailConta}.` : "Você está conectado."}
            </p>
            <button className="btn perfil-btn-perigo" type="button" onClick={sair}>
              Sair da conta
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
