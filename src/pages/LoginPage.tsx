import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { iniciarSessao } from "../sessao";
import { PERFIS } from "../perfil/perfil";
import { REGRAS_SENHA, faltandoRegras } from "../auth/senha";
import { cadastrar as cadastrarFirebase, entrar as entrarFirebase } from "../firebase/auth";
import { configurado as firebaseConfigurado } from "../firebase/config";

type Aba = "login" | "cadastro";

/**
 * Tela /login — RF01 (login/cadastro), guiada pelo mockup de referência e pelo
 * design system Academic Modernist. Autentica via Firebase quando configurado;
 * sem Firebase, usa a sessão local simulada.
 */
export default function LoginPage() {
  const navegar = useNavigate();
  const [aba, setAba] = useState<Aba>("login");

  // Formulário de acesso
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrar, setLembrar] = useState(false);

  // Formulário de cadastro
  const [nome, setNome] = useState("");
  const [emailCadastro, setEmailCadastro] = useState("");
  const [senhaCadastro, setSenhaCadastro] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [perfil, setPerfil] = useState("graduacao");

  // Erro de autenticação legível (H9) e estado de processamento.
  const [erroAuth, setErroAuth] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setErroAuth(null);
    // Sem Firebase configurado: mantém a sessão local simulada (nada quebra).
    if (!firebaseConfigurado) {
      iniciarSessao(lembrar);
      navegar("/revisar");
      return;
    }
    setProcessando(true);
    const r = await entrarFirebase(email, senha);
    setProcessando(false);
    if (r.ok) {
      iniciarSessao(lembrar);
      navegar("/revisar");
    } else {
      setErroAuth(r.motivo);
    }
  };

  const cadastrar = async (e: FormEvent) => {
    e.preventDefault();
    setErroAuth(null);
    // Regras de senha valem antes de qualquer coisa (inclusive no modo local):
    // o checklist embaixo do campo mostra o que ainda falta.
    const pendentes = faltandoRegras(senhaCadastro);
    if (pendentes.length > 0) {
      setErroAuth(`A senha ainda não atende às regras: ${pendentes.join(", ")}.`);
      return;
    }
    if (!firebaseConfigurado) {
      iniciarSessao(false);
      navegar("/revisar");
      return;
    }
    if (senhaCadastro !== confirmarSenha) {
      setErroAuth("As senhas não conferem.");
      return;
    }
    setProcessando(true);
    const r = await cadastrarFirebase(emailCadastro, senhaCadastro, nome);
    setProcessando(false);
    if (r.ok) {
      iniciarSessao(false);
      navegar("/revisar");
    } else {
      setErroAuth(r.motivo);
    }
  };

  return (
    <main className="login-main" id="conteudo">
      <div className="login-grid">
        {/* Coluna institucional — visual storytelling do mockup */}
        <section className="login-hero" aria-label="Sobre o NormaReview AI">
          <p className="login-hero-chip">Padrão ABNT NBR · Validação rápida</p>
          <h2 className="login-hero-titulo">
            Rigor acadêmico, <span>velocidade de IA.</span>
          </h2>
          <p className="login-hero-texto">
            Acesse a plataforma de formatação, checagem cruzada de citações e conformidade técnica para teses,
            dissertações e artigos científicos.
          </p>
        </section>

        {/* Card de autenticação com abas Entrar / Criar conta */}
        <section className="login-card" aria-label="Acesso à plataforma">
          <div className="login-abas" role="tablist" aria-label="Entrar ou criar conta">
            <button
              type="button"
              role="tab"
              aria-selected={aba === "login"}
              className={`login-aba ${aba === "login" ? "ativa" : ""}`}
              onClick={() => setAba("login")}
            >
              Entrar na conta
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === "cadastro"}
              className={`login-aba ${aba === "cadastro" ? "ativa" : ""}`}
              onClick={() => setAba("cadastro")}
            >
              Criar conta
            </button>
          </div>

          {aba === "cadastro" && (
            <p className="login-contexto">
              Preencha seus dados para receber revisões precisas de normas e formatações ABNT.
            </p>
          )}

          {aba === "login" ? (
            <form className="login-form" onSubmit={entrar}>
              <div className="login-campo">
                <label htmlFor="login-email">E-mail institucional ou pessoal</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="ex: marcelo.silva@ufrj.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="login-campo-dica">Preferencialmente o domínio institucional (.edu, .br etc.)</p>
              </div>

              <div className="login-campo">
                <label htmlFor="login-senha">Senha de acesso</label>
                <div className="login-senha-wrap">
                  <input
                    id="login-senha"
                    type={mostrarSenha ? "text" : "password"}
                    required
                    placeholder="Digite sua senha cadastrada"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <button
                    type="button"
                    className="login-senha-toggle"
                    onClick={() => setMostrarSenha((v) => !v)}
                    title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? "ocultar" : "mostrar"}
                  </button>
                </div>
              </div>

              <div className="login-linha-lembre">
                <label className="login-lembrar">
                  <input
                    type="checkbox"
                    checked={lembrar}
                    onChange={(e) => setLembrar(e.target.checked)}
                  />
                  Lembrar de mim neste dispositivo
                </label>
              </div>

              {erroAuth && (
                <p className="upload-erro" role="alert">
                  <strong>Não foi possível entrar</strong>
                  <span>{erroAuth}</span>
                </p>
              )}

              <button className="btn-login btn-login-primario" type="submit" disabled={processando}>
                {processando ? "Entrando…" : "Entrar no NormaReview"}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={cadastrar}>
              <div className="login-campo">
                <label htmlFor="reg-nome">Nome completo do autor(a) ou revisor(a)</label>
                <input
                  id="reg-nome"
                  type="text"
                  required
                  placeholder="ex: Dr. Marcelo da Silva Junior"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
                <p className="login-campo-dica">Usado na padronização ABNT de folhas de rosto e referências.</p>
              </div>

              <div className="login-campo">
                <label htmlFor="reg-email">E-mail institucional ou pessoal</label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  placeholder="ex: ana.costa@usp.br"
                  value={emailCadastro}
                  onChange={(e) => setEmailCadastro(e.target.value)}
                />
              </div>

              <div className="login-grid-senhas">
                <div className="login-campo">
                  <label htmlFor="reg-senha">Criar senha</label>
                  <input
                    id="reg-senha"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={senhaCadastro}
                    onChange={(e) => setSenhaCadastro(e.target.value)}
                    aria-describedby="regras-senha"
                  />
                  {/* Checklist das regras: acende item a item enquanto digita. */}
                  <ul className="login-regras" id="regras-senha">
                    {REGRAS_SENHA.map((regra) => (
                      <li
                        key={regra.rotulo}
                        className={`login-regra ${regra.atende(senhaCadastro) ? "ok" : ""}`}
                      >
                        {regra.rotulo}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="login-campo">
                  <label htmlFor="reg-confirmar">Confirmar senha</label>
                  <input
                    id="reg-confirmar"
                    type="password"
                    required
                    placeholder="Repita a senha"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                  />
                </div>
              </div>

              <div className="login-campo">
                <label htmlFor="reg-perfil">Perfil de utilização principal</label>
                <select
                  id="reg-perfil"
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value)}
                >
                  {PERFIS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              {erroAuth && (
                <p className="upload-erro" role="alert">
                  <strong>Não foi possível criar a conta</strong>
                  <span>{erroAuth}</span>
                </p>
              )}

              <button className="btn-login btn-login-secundario" type="submit" disabled={processando}>
                {processando ? "Criando conta…" : "Cadastrar gratuitamente"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
