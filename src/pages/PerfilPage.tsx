import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
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
import { NOME_SERVICO, servicoDaChave } from "../ai/assistente";
import { InfoChaveIA } from "../ui/InfoChaveIA";
import { useAutorizacao } from "../firebase/auth";
import { configurado as firebaseConfigurado } from "../firebase/config";
import { carregarPerfilNuvem, salvarPerfilNuvem } from "../firebase/persistencia";

/**
 * Tela /perfil — dados do autor/revisor e configuração do assistente IA
 * (BYO-key, DC-03, só na aba aberta). É o único lugar onde a chave é
 * informada; a tela Revisar só leva até aqui. Sair fica no cabeçalho.
 */
export default function PerfilPage() {
  const location = useLocation();

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

  // Assistente IA — a chave salva aqui é reutilizada pela tela Revisar.
  const [configIA, setConfigIA] = useState<ConfiguracaoIA | null>(() => carregarConfigIA());
  const [chaveInput, setChaveInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState(configIA?.baseUrl ?? "");
  const [modeloInput, setModeloInput] = useState(configIA?.modelo ?? "");

  // Vindo do "Ativar assistente de IA" da tela Revisar: leva direto ao campo da chave.
  const campoChave = useRef<HTMLInputElement | null>(null);
  const quadroIA = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!(location.state as { focoChave?: boolean } | null)?.focoChave) return;
    quadroIA.current?.scrollIntoView({ block: "center" });
    campoChave.current?.focus();
  }, [location.state]);

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
    setStatus("Assistente IA configurado — a chave vale até você fechar esta aba ou sair da conta.");
  };

  const desativarChave = () => {
    removerConfigIA();
    setConfigIA(null);
    setStatus("Assistente IA desativado. O fluxo normativo continua completo.");
  };

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
          {/* Assistente IA */}
          <section className="perfil-card" aria-label="Assistente IA" ref={quadroIA}>
            <InfoChaveIA titulo="Assistente de IA (opcional)" nivel="h3" />
            {configIA ? (
              <>
                <p className="ia-status ia-pronta">
                  Configurado com {NOME_SERVICO[servicoDaChave(configIA.apiKey)]}
                  {configIA.modelo ? ` — modelo ${configIA.modelo}` : ""}. Sugestões aparecem como
                  <em> assistência</em>, nunca como decisão normativa.
                </p>
                <button className="btn perfil-btn-perigo" type="button" onClick={desativarChave}>
                  Remover chave
                </button>
              </>
            ) : (
              <>
                <p className="ia-status">
                  Sem IA o fluxo continua completo: regras, relatório e correções. A chave não fica guardada: vale
                  até você fechar esta aba ou sair da conta.
                </p>
                <label className="perfil-campo">
                  <span>Chave da API (Gemini ou OpenAI)</span>
                  <input
                    type="password"
                    ref={campoChave}
                    value={chaveInput}
                    onChange={(e) => setChaveInput(e.target.value)}
                    placeholder="AIza… (Gemini) ou sk-… (OpenAI)"
                  />
                </label>
                <div className="perfil-duas-colunas">
                  <label className="perfil-campo">
                    <span>Endpoint (opcional)</span>
                    <input
                      type="text"
                      value={baseUrlInput}
                      onChange={(e) => setBaseUrlInput(e.target.value)}
                      placeholder="Automático pela chave"
                    />
                  </label>
                  <label className="perfil-campo">
                    <span>Modelo (opcional)</span>
                    <input
                      type="text"
                      value={modeloInput}
                      onChange={(e) => setModeloInput(e.target.value)}
                      placeholder="Automático pela chave"
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

        </div>
      </div>
    </main>
  );
}
