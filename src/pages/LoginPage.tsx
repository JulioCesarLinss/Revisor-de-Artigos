import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { iniciarSessao } from "../sessao";
import { PERFIS } from "../perfil/perfil";
import { REGRAS_SENHA, faltandoRegras } from "../auth/senha";
import { cadastrar as cadastrarFirebase, entrar as entrarFirebase } from "../firebase/auth";
import { configurado as firebaseConfigurado } from "../firebase/config";

type Aba = "login" | "cadastro";

/** Ícones de traço da tela (herdam a cor do texto). */
const ICONES = {
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  cadeado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  pessoa: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  olho: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  olhoFechado: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </>
  ),
  lupa: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  documento: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  brilho: (
    <>
      <path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z" />
      <path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
};

function Icone({ nome, className }: { nome: keyof typeof ICONES; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONES[nome]}
    </svg>
  );
}

const RECURSOS: { icone: keyof typeof ICONES; titulo: string; texto: string }[] = [
  { icone: "lupa", titulo: "Revisão inteligente", texto: "Encontre erros e melhore seu texto" },
  { icone: "documento", titulo: "Formatação ABNT", texto: "Deixe seu trabalho no padrão correto" },
  { icone: "brilho", titulo: "Assistência com IA", texto: "Receba sugestões personalizadas" },
];

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
        {/* Coluna institucional: o que o produto faz, em segundos */}
        <section className="login-hero" aria-label="Sobre o NormaReview AI">
          <h2 className="login-hero-titulo">
            <span className="login-hero-titulo-base">Mais rigor acadêmico,</span>
            <span className="login-hero-titulo-destaque">com a ajuda da IA.</span>
          </h2>
          <p className="login-hero-texto">
            Aprimore seus textos acadêmicos com IA!
            <br />
            Revise, organize e formate dentro das normas ABNT.
            <br />
            Torne sua escrita mais clara, objetiva e profissional.
          </p>
          <ul className="login-recursos">
            {RECURSOS.map((r) => (
              <li key={r.titulo} className="login-recurso">
                <Icone nome={r.icone} className="login-recurso-icone" />
                <h3>{r.titulo}</h3>
                <p>{r.texto}</p>
              </li>
            ))}
          </ul>
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
                <div className="login-entrada">
                  <Icone nome="email" className="login-entrada-icone" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="exemplo@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <p className="login-campo-dica">Preferencialmente o domínio institucional (.edu, .br etc.)</p>
              </div>

              <div className="login-campo">
                <label htmlFor="login-senha">Senha de acesso</label>
                <div className="login-entrada login-senha-wrap">
                  <Icone nome="cadeado" className="login-entrada-icone" />
                  <input
                    id="login-senha"
                    type={mostrarSenha ? "text" : "password"}
                    required
                    placeholder="Insira sua senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <button
                    type="button"
                    className="login-senha-toggle"
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={mostrarSenha}
                    title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    <Icone nome={mostrarSenha ? "olhoFechado" : "olho"} />
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
                {processando ? "Entrando…" : "Entrar na conta"}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={cadastrar}>
              <div className="login-campo">
                <label htmlFor="reg-nome">Nome completo do autor(a) ou revisor(a)</label>
                <div className="login-entrada">
                  <Icone nome="pessoa" className="login-entrada-icone" />
                  <input
                    id="reg-nome"
                    type="text"
                    required
                    placeholder="ex: Dr. Marcelo da Silva Junior"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <p className="login-campo-dica">Usado na padronização ABNT de folhas de rosto e referências.</p>
              </div>

              <div className="login-campo">
                <label htmlFor="reg-email">E-mail institucional ou pessoal</label>
                <div className="login-entrada">
                  <Icone nome="email" className="login-entrada-icone" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    placeholder="exemplo@email.com"
                    value={emailCadastro}
                    onChange={(e) => setEmailCadastro(e.target.value)}
                  />
                </div>
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
