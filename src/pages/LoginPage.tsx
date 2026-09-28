import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { iniciarSessao } from "../sessao";

type Aba = "login" | "cadastro";

/** Selos de integridade da coluna institucional (mesma mensagem do mockup). */
const SELOS = [
  { titulo: "Criptografia ponta a ponta", texto: "Seus inéditos protegidos" },
  { titulo: "100% LGPD acadêmica", texto: "Sem treino de modelos públicos" },
];

const PERFIS = [
  { valor: "graduacao", rotulo: "Graduação / TCC e Monografia" },
  { valor: "pos", rotulo: "Mestrado / Doutorado / Pós-Graduação" },
  { valor: "docente", rotulo: "Docente / Orientador Acadêmico" },
  { valor: "revisor", rotulo: "Comitê Editorial / Revisor de Periódico" },
];

/**
 * Tela /login — RF01 (login/cadastro), guiada pelo mockup de referência e pelo
 * design system Academic Modernist. Sem autenticação real: qualquer envio
 * válido navega para /upload.
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

  const entrar = (e: FormEvent) => {
    e.preventDefault();
    iniciarSessao(lembrar); // "Lembrar de mim" persiste no dispositivo
    navegar("/upload");
  };

  const cadastrar = (e: FormEvent) => {
    e.preventDefault();
    iniciarSessao(false);
    navegar("/upload");
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

          <div className="login-hero-card">
            <span className="login-hero-card-num">+450</span>
            <div>
              <strong>Universidades conectadas</strong>
              <p>
                Preparado para a comunidade acadêmica federada (CAFe / RNP) e para acesso individual com e-mail
                institucional.
              </p>
            </div>
          </div>

          <div className="login-selos">
            {SELOS.map((s) => (
              <div key={s.titulo} className="login-selo">
                <strong>{s.titulo}</strong>
                <span>{s.texto}</span>
              </div>
            ))}
          </div>
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

          <p className="login-contexto">
            {aba === "login"
              ? "Utilize seu e-mail institucional para sincronização com seu repositório de pesquisas."
              : "Preencha seus dados para receber revisões precisas de normas e formatações ABNT."}
          </p>

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
                <div className="login-campo-topo">
                  <label htmlFor="login-senha">Senha de acesso</label>
                  <a className="login-link" href="#esqueci" onClick={(e) => e.preventDefault()}>
                    Esqueci minha senha
                  </a>
                </div>
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
                <span className="login-sessao">
                  <span className="login-sessao-dot" aria-hidden="true" /> Sessão protegida
                </span>
              </div>

              <button className="btn-login btn-login-primario" type="submit">
                Entrar no NormaReview
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
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={senhaCadastro}
                    onChange={(e) => setSenhaCadastro(e.target.value)}
                  />
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

              <button className="btn-login btn-login-secundario" type="submit">
                Cadastrar gratuitamente
              </button>
            </form>
          )}

          <div className="login-divisor" role="separator">
            <span>Ou acesse via</span>
          </div>

          <div className="login-federados">
            <button type="button" className="login-federado" title="Autenticação federada CAFe / RNP (em breve)">
              <span className="login-federado-icone" aria-hidden="true">
                CAFe
              </span>
              <span className="login-federado-texto">
                <strong>Acesso CAFe / RNP</strong>
                <small>Comunidade acadêmica federada</small>
              </span>
            </button>
            <button type="button" className="login-federado" title="Entrar com Google (em breve)">
              <span className="login-federado-icone" aria-hidden="true">
                G
              </span>
              <span className="login-federado-texto">
                <strong>Entrar com Google</strong>
                <small>Sincronização com Workspace</small>
              </span>
            </button>
          </div>

          <div className="login-privacidade">
            <strong>
              Compromisso ético e sigilo de autoria <span className="login-lgpd-chip">LGPD ok</span>
            </strong>
            <p>
              Ambiente seguro com criptografia e conformidade LGPD. Seus dados e manuscritos{" "}
              <strong>nunca</strong> são compartilhados ou usados para treinamento de modelos públicos de IA.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
