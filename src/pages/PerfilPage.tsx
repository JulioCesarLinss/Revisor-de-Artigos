import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { encerrarSessao, tipoSessao } from "../sessao";
import {
  carregarConfigIA,
  carregarPerfil,
  iniciaisDoNome,
  PERFIS,
  removerConfigIA,
  rotuloDoPerfil,
  salvarConfigIA,
  salvarPerfil,
} from "../perfil/perfil";
import type { ConfiguracaoIA } from "../ai/types";

/**
 * Tela /perfil — dados do autor/revisor, configuração do assistente IA
 * (BYO-key, DC-03) e controle da sessão. Persistência local no dispositivo.
 */
export default function PerfilPage() {
  const navegar = useNavigate();

  // Heurística 1 (Nielsen): toda ação dá retorno imediato e legível.
  const [status, setStatus] = useState<string | null>(null);

  const salvo = carregarPerfil();
  const [nome, setNome] = useState(salvo?.nome ?? "");
  const [email, setEmail] = useState(salvo?.email ?? "");
  const [instituicao, setInstituicao] = useState(salvo?.instituicao ?? "");
  const [perfil, setPerfil] = useState(salvo?.perfil ?? "graduacao");

  // Assistente IA — a chave salva aqui é reutilizada pela tela Revisar.
  const [configIA, setConfigIA] = useState<ConfiguracaoIA | null>(() => carregarConfigIA());
  const [chaveInput, setChaveInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState(configIA?.baseUrl ?? "");
  const [modeloInput, setModeloInput] = useState(configIA?.modelo ?? "");

  const salvar = (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length === 0 || email.trim().length === 0) {
      setStatus("Preencha ao menos nome e e-mail para salvar.");
      return;
    }
    salvarPerfil({ nome, email, instituicao, perfil });
    setStatus("Perfil salvo neste dispositivo.");
  };

  const salvarChave = () => {
    const chave = chaveInput.trim();
    if (chave.length === 0) return;
    const config: ConfiguracaoIA = {
      apiKey: chave,
      baseUrl: baseUrlInput.trim() || undefined,
      modelo: modeloInput.trim() || undefined,
    };
    salvarConfigIA(config);
    setConfigIA(config);
    setChaveInput("");
    setStatus("Assistente IA configurado — a chave fica só neste dispositivo.");
  };

  const desativarChave = () => {
    removerConfigIA();
    setConfigIA(null);
    setStatus("Assistente IA desativado. O fluxo normativo continua completo.");
  };

  const sair = () => {
    encerrarSessao();
    navegar("/login", { replace: true });
  };

  const rotuloSessao = tipoSessao();

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

      <p className="status-sistema" role="status" aria-live="polite">
        {status ?? "Alterações ficam salvas apenas neste dispositivo (sem backend)."}
      </p>

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
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: marcelo.silva@ufrj.br"
            />
          </label>

          <label className="perfil-campo">
            <span>Instituição (opcional)</span>
            <input
              type="text"
              value={instituicao}
              onChange={(e) => setInstituicao(e.target.value)}
              placeholder="ex: UFRJ — Programa de Pós em Bioética"
            />
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
          {/* Assistente IA */}
          <section className="perfil-card" aria-label="Assistente IA">
            <h3>Assistente IA (opcional)</h3>
            {configIA ? (
              <>
                <p className="ia-status ia-pronta">
                  Configurado{configIA.modelo ? ` — modelo ${configIA.modelo}` : ""}. Sugestões aparecem como
                  <em> assistência</em>, nunca como decisão normativa.
                </p>
                <button className="btn perfil-btn-perigo" type="button" onClick={desativarChave}>
                  Remover chave
                </button>
              </>
            ) : (
              <>
                <p className="ia-status">
                  Sem IA o fluxo continua completo: regras, relatório e correções. A chave é sua (BYO-key) e fica
                  apenas neste dispositivo.
                </p>
                <label className="perfil-campo">
                  <span>Chave da API (OpenAI ou compatível)</span>
                  <input
                    type="password"
                    value={chaveInput}
                    onChange={(e) => setChaveInput(e.target.value)}
                    placeholder="sk-…"
                  />
                </label>
                <div className="perfil-duas-colunas">
                  <label className="perfil-campo">
                    <span>Endpoint (opcional)</span>
                    <input
                      type="text"
                      value={baseUrlInput}
                      onChange={(e) => setBaseUrlInput(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                    />
                  </label>
                  <label className="perfil-campo">
                    <span>Modelo (opcional)</span>
                    <input
                      type="text"
                      value={modeloInput}
                      onChange={(e) => setModeloInput(e.target.value)}
                      placeholder="gpt-4o-mini"
                    />
                  </label>
                </div>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={chaveInput.trim().length === 0}
                  onClick={salvarChave}
                >
                  Salvar chave
                </button>
              </>
            )}
          </section>

          {/* Sessão */}
          <section className="perfil-card" aria-label="Sessão">
            <h3>Sessão</h3>
            <p className="ia-status">
              {rotuloSessao === "lembrada"
                ? "Sessão lembrada neste dispositivo (persiste entre visitas)."
                : rotuloSessao === "aba"
                  ? "Sessão válida apenas nesta aba."
                  : "Sessão local simulada, sem backend de autenticação."}
            </p>
            <button className="btn perfil-btn-perigo" type="button" onClick={sair}>
              Sair da conta
            </button>
          </section>
        </div>
      </div>

      <div className="perfil-navegacao">
        <Link className="btn" to="/laudo">
          ← Laudo
        </Link>
        <Link className="btn" to="/revisar">
          Revisar →
        </Link>
      </div>
    </main>
  );
}
