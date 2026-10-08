import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { statusIA, sugerirReescrita } from "../ai/assistente";
import { carregarConfigIA, salvarConfigIA } from "../perfil/perfil";
import type { ConfiguracaoIA, SugestaoIA } from "../ai/types";
import { aplicarCorrecao } from "../document/acoes";
import { aplicarSugestao } from "../document/aplicarSugestao";
import { lerArquivo, type ResultadoUpload } from "../document/arquivo";
import { iniciarRevisao, type AnaliseRevisao } from "../review/orquestrar";
import type { Problema } from "../rules/types";
import { PainelHistorico } from "../ui/PainelHistorico";
import { ManuscritoPaginado } from "../ui/ManuscritoPaginado";
import { PainelSecoes } from "../ui/PainelSecoes";
import { PainelSugestao } from "../ui/PainelSugestao";
import { ProblemaCard } from "../ui/ProblemaCard";
import { RevisarView } from "../ui/RevisarView";
import { Resumo } from "../ui/Resumo";
import { BarraFluxo } from "../ui/BarraFluxo";
import { ComparacaoView } from "../ui/ComparacaoView";
import { tituloDaRegra } from "../ui/rotulos";
import { registrar, type RegistroAlteracao } from "../workspace/historico";
import {
  estadoInicial,
  proximoEstado,
  registrarVersao,
  ROTULO_ESTADO,
  type EstadoFluxo,
  type VersaoSnapshot,
} from "../workspace/fluxo";
import { carregarWorkspace, salvarWorkspace } from "../workspace/armazenamento";

/** Tela /revisar — editor de revisão interativa (conteúdo original do App). */
export default function RevisarPage() {
  // Workspace restaurado do dispositivo (uma única leitura, no primeiro render):
  // o rascunho/versões sobrevivem à troca de rotas e alimentam /historico.
  const [salvo] = useState(carregarWorkspace);
  const location = useLocation();

  /** Alvo vindo do /historico ("Localizar"): aplicado após a 1ª análise. */
  const alvoPendente = useRef<number | null>(
    (location.state as { alvo?: number } | null)?.alvo ?? null,
  );

  // Upload de arquivo (aba Revisar): seletor + arrastar-e-soltar na folha.
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);

  const [bruto, setBruto] = useState(salvo?.bruto ?? "");
  const [analise, setAnalise] = useState<AnaliseRevisao | null>(null);
  const [revisandoParagrafo, setRevisandoParagrafo] = useState<number | null>(null);

  // Sprint 3 — assistência IA (opcional; DC-03). A chave salva em /perfil
  // é carregada aqui, para não precisar ser digitada duas vezes.
  const [configIA, setConfigIA] = useState<ConfiguracaoIA | null>(() => carregarConfigIA());
  const [chaveInput, setChaveInput] = useState("");
  const [sugestaoAtiva, setSugestaoAtiva] = useState<SugestaoIA | null>(null);
  const [carregandoSugestao, setCarregandoSugestao] = useState<string | null>(null);
  const [erroIA, setErroIA] = useState<string | null>(null);

  /**
   * Heurística 9 (Nielsen) — reconhecer, diagnosticar e recuperar erros:
   * guarda o problema que originou o último pedido, para que o relatório de
   * erro mostre o que falhou e ofereça a recuperação ("Tentar novamente").
   */
  const [ultimoPedido, setUltimoPedido] = useState<Problema | null>(null);
  const [historico, setHistorico] = useState<RegistroAlteracao[]>(salvo?.historico ?? []);

  // Heurística 1 (Nielsen) — visibilidade do status do sistema
  const [ocupadoCom, setOcupadoCom] = useState<string | null>(null);
  const [statusSistema, setStatusSistema] = useState<string | null>(null);

  // Sprint 4 — fluxo de revisão guiada (restaurado do storage quando houver)
  const [estadoFluxo, setEstadoFluxo] = useState<EstadoFluxo>(salvo?.estadoFluxo ?? estadoInicial());
  const [versoes, setVersoes] = useState<VersaoSnapshot[]>(salvo?.versoes ?? []);
  const [feedbacks, setFeedbacks] = useState<Record<number, boolean>>(salvo?.feedbacks ?? {});
  const [mostrandoComparacao, setMostrandoComparacao] = useState(false);

  const estadoIA = statusIA(configIA);

  // Ocupado quando há análise/versão em processamento ou sugestão IA pendente.
  const processando = ocupadoCom !== null || carregandoSugestao !== null;

  const analisar = useCallback(() => {
    setOcupadoCom("Analisando manuscrito…");
    setRevisandoParagrafo(null);
    setTimeout(() => {
      const resultado = iniciarRevisao(bruto);
      setAnalise(resultado);
      setOcupadoCom(null);
      setStatusSistema(`Análise concluída — ${resultado.resumo.total} problema(s) encontrado(s).`);
      // "Localizar" vindo do /historico: abre o modo revisar no parágrafo alvo.
      const alvo = alvoPendente.current;
      if (alvo !== null) {
        alvoPendente.current = null;
        if (alvo > 0 && alvo <= resultado.manuscrito.paragrafos.length) setRevisandoParagrafo(alvo);
      }
    }, 0);
  }, [bruto]);

  // Persiste o workspace a cada mudança: /historico lê daqui e o rascunho
  // sobrevive à navegação entre rotas.
  useEffect(() => {
    salvarWorkspace({ bruto, historico, versoes, estadoFluxo, feedbacks });
  }, [bruto, historico, versoes, estadoFluxo, feedbacks]);

  // Ao montar com texto restaurado, analisa uma vez (e aplica um alvo pendente).
  const iniciado = useRef(false);
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    if (bruto.trim().length > 0) analisar();
  }, [analisar, bruto]);

  const avancarFluxo = useCallback(() => {
    const seguinte = proximoEstado(estadoFluxo);
    if (!seguinte) return;
    setOcupadoCom("Registrando versão…");
    setTimeout(() => {
      const analiseAtual = analise ?? iniciarRevisao(bruto);
      setVersoes((v) => registrarVersao(v, { estado: estadoFluxo, bruto, totalProblemas: analiseAtual.resumo.total }));
      setEstadoFluxo(seguinte);
      setMostrandoComparacao(true);
      setOcupadoCom(null);
      setStatusSistema(`Versão "${ROTULO_ESTADO[estadoFluxo]}" registrada — comparando com "${ROTULO_ESTADO[seguinte]}".`);
    }, 0);
  }, [estadoFluxo, analise, bruto]);

  const voltarFluxo = useCallback(() => {
    const ordem: EstadoFluxo[] = ["rascunho", "revisao", "final"];
    const i = ordem.indexOf(estadoFluxo);
    if (i > 0) {
      setEstadoFluxo(ordem[i - 1]);
      setMostrandoComparacao(false);
    }
  }, [estadoFluxo]);

  /**
   * Heurística 7 (Nielsen) — flexibilidade e eficiência de uso: aceleradores de
   * teclado para as ações repetidas (analisar, avançar no fluxo), ignorados
   * enquanto o app está ocupado ou no modo "revisar" (evita conflito com Esc).
   */
  const podeAnalisar = bruto.trim().length > 0 && revisandoParagrafo === null && !processando;

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
      if (processando || revisandoParagrafo !== null) return;
      e.preventDefault();
      if (e.shiftKey) {
        if (bruto.trim().length > 0 && estadoFluxo !== "final") avancarFluxo();
      } else if (bruto.trim().length > 0) {
        analisar();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [analisar, avancarFluxo, bruto, estadoFluxo, processando, revisandoParagrafo]);

  const darFeedback = useCallback((historicoId: number, ajudou: boolean) => {
    setFeedbacks((f) => ({ ...f, [historicoId]: ajudou }));
  }, []);

  const editar = useCallback((novo: string) => {
    setBruto(novo);
    setRevisandoParagrafo(null);
  }, []);

  /** Lê o arquivo no cliente, carrega o texto como novo rascunho e analisa. */
  const receberArquivo = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setErroUpload(null);
    setArrastando(false);
    setOcupadoCom(`Lendo "${file.name}"…`);

    let resultado: ResultadoUpload;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      resultado = await lerArquivo({ nome: file.name, bytes });
    } catch {
      resultado = { ok: false, motivo: `Não foi possível ler "${file.name}" — o arquivo pode estar corrompido.` };
    }

    if (!resultado.ok) {
      // H9: o erro diz o quê, por quê e o que fazer (recuperação).
      setErroUpload(resultado.motivo);
      setOcupadoCom(null);
      setStatusSistema(null);
      return;
    }

    setBruto(resultado.texto);
    setRevisandoParagrafo(null);
    alvoPendente.current = null; // o texto novo invalida um alvo antigo
    setOcupadoCom("Analisando manuscrito…");
    setTimeout(() => {
      const analiseNova = iniciarRevisao(resultado.texto);
      setAnalise(analiseNova);
      setOcupadoCom(null);
      setStatusSistema(
        `Arquivo "${file.name}" carregado — ${analiseNova.resumo.total} problema(s) encontrado(s).`,
      );
    }, 0);
  }, []);

  const corrigir = useCallback((problema: Problema) => {
    if (!problema.acao) return;
    setBruto((atual) => {
      const corrigido = aplicarCorrecao(atual, problema.acao!, problema.paragrafo);
      setAnalise(iniciarRevisao(corrigido));
      return corrigido;
    });
    setHistorico((h) =>
      registrar(h, { origem: "manual", descricao: "correção rápida aplicada", paragrafo: problema.paragrafo }),
    );
    setStatusSistema(`Correção aplicada no parágrafo ${problema.paragrafo} — análise atualizada.`);
  }, []);

  const pedirSugestao = useCallback(
    async (problema: Problema) => {
      if (!configIA || !analise) return;
      const par = analise.manuscrito.paragrafos.find((p) => p.index === problema.paragrafo);
      if (!par) return;

      setCarregandoSugestao(problema.id);
      setErroIA(null);
      setUltimoPedido(problema); // H9: contexto do pedido para diagnóstico/recuperação
      const resultado = await sugerirReescrita(configIA, par.texto, problema.paragrafo, {
        regraId: problema.regraId,
        mensagem: problema.mensagem,
        referencia: problema.referencia,
      });
      setCarregandoSugestao(null);

      if (resultado.ok) {
        setSugestaoAtiva(resultado.sugestao);
        setStatusSistema("Sugestão recebida da IA — revise antes de aceitar.");
      } else {
        setErroIA(resultado.motivo);
        setStatusSistema(null);
      }
    },
    [configIA, analise],
  );

  const aceitarSugestao = useCallback(
    (textoFinal: string) => {
      if (!sugestaoAtiva) return;
      setBruto((atual) => {
        const novo = aplicarSugestao(atual, sugestaoAtiva, textoFinal);
        setAnalise(iniciarRevisao(novo));
        return novo;
      });
      setHistorico((h) =>
        registrar(h, {
          origem: "ia",
          descricao: sugestaoAtiva.regraId ? `sugestão aceita (${sugestaoAtiva.regraId})` : "sugestão aceita",
          paragrafo: sugestaoAtiva.paragrafo,
        }),
      );
      setStatusSistema(`Sugestão aceita no parágrafo ${sugestaoAtiva.paragrafo} — análise atualizada.`);
      setSugestaoAtiva(null);
    },
    [sugestaoAtiva],
  );

  /**
   * H9 — relatório de erro completo para a falha do assistente IA:
   * o quê (Ocorreu um erro) → por quê (motivo legível) → como recuperar.
   */
  const renderErroIA = () => (
    <div className="ia-erro" role="alert">
      <strong className="ia-erro-titulo">Ocorreu um erro ao pedir a sugestão</strong>
      <span>{erroIA}</span>
      <span className="ia-erro-acoes">
        {ultimoPedido && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              const problema = ultimoPedido;
              setErroIA(null);
              void pedirSugestao(problema);
            }}
          >
            Tentar novamente
          </button>
          )}
        <button className="btn" type="button" onClick={() => setErroIA(null)}>
          Fechar
        </button>
      </span>
    </div>
  );

  return (
    <main className="app-main" id="conteudo">
      <section className="canvas-col" aria-label="Manuscrito em revisão">
        <BarraFluxo
          estado={estadoFluxo}
          podeAvancar={bruto.trim().length > 0 && !processando}
          onAvancar={avancarFluxo}
          onVoltar={voltarFluxo}
          processando={processando}
          motivoBloqueio={
            /* H9: o botão bloqueado diz por quê e como destravar. */
            bruto.trim().length === 0
              ? "O manuscrito está vazio — cole o texto antes de registrar uma versão."
              : processando
                ? "Aguarde: uma operação está em andamento."
                : undefined
          }
        />

        {/* H1: a linha de status só existe quando há status a mostrar. */}
        {(carregandoSugestao !== null || ocupadoCom !== null || statusSistema) && (
          <p className="status-sistema" role="status" aria-live="polite">
            {carregandoSugestao !== null ? (
              <>
                <span className="status-spinner" aria-hidden="true" />
                Pedindo sugestão à IA…
              </>
            ) : ocupadoCom !== null ? (
              <>
                <span className="status-spinner" aria-hidden="true" />
                {ocupadoCom}
              </>
            ) : (
              statusSistema
            )}
          </p>
        )}

        {mostrandoComparacao && estadoFluxo !== "rascunho" ? (
          <div className="canvas-page">
            <ComparacaoView versoes={versoes} estadoAtual={estadoFluxo} textoAtual={bruto} />
            <div className="comparacao-acoes">
              <button className="btn" type="button" onClick={() => setMostrandoComparacao(false)}>
                Continuar {ROTULO_ESTADO[estadoFluxo]}
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="canvas-toolbar">
          <span className="stat">
            <strong>{analise?.manuscrito.paragrafos.length ?? 0}</strong> parágrafos
          </span>
          <span className="stat">
            <strong>{analise?.manuscrito.totalPalavras ?? 0}</strong> palavras
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {/* Anexar: pequeno botão ao lado de Analisar (substitui "Carregar exemplo"). */}
            <input
              ref={inputFileRef}
              type="file"
              accept=".docx,.txt,.md,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: "none" }}
              onChange={(e) => {
                void receberArquivo(e.target.files?.[0]);
                e.target.value = ""; // permite reenviar o mesmo arquivo
              }}
            />
            <button
              className="btn btn-anexar"
              type="button"
              disabled={processando}
              onClick={() => inputFileRef.current?.click()}
              title="Anexar manuscrito (.docx, .txt ou .md) — ou arraste o arquivo direto para a folha"
            >
              <svg
                className="btn-anexar-icone"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Anexar
            </button>
            <button
              className="btn btn-accent"
              type="button"
              onClick={analisar}
              disabled={!podeAnalisar}
              aria-busy={processando || undefined}
              title={
                /* H9: quando bloqueado, o botão explica por quê e como destravar. */
                revisandoParagrafo !== null
                  ? "Volte à edição (botão \"Voltar à edição\" ou tecla Esc) para analisar novamente"
                  : bruto.trim().length === 0
                    ? "Cole ou digite o texto do manuscrito para habilitar a análise"
                    : "Verifica o manuscrito contra o catálogo de regras normativas"
              }
            >
              Analisar <kbd className="atalho-tecla" aria-hidden="true">Ctrl+↵</kbd>
            </button>
          </span>
        </div>

        {/* Upload: erro legível com recuperação (H9). */}
        {erroUpload && (
          <div className="upload-erro" role="alert">
            <strong>Não foi possível carregar o arquivo</strong>
            <span>{erroUpload}</span>
            <button className="btn" type="button" onClick={() => setErroUpload(null)}>
              Fechar
            </button>
          </div>
        )}

        {/* Arrastar-e-soltar: só reage a arquivos, preserva o drag interno. */}
        <div
          className={`canvas-page ${arrastando ? "arrastando" : ""}`}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setArrastando(false);
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setArrastando(false);
            void receberArquivo(e.dataTransfer.files?.[0]);
          }}
        >
          {revisandoParagrafo !== null && analise ? (
            <RevisarView
              manuscrito={analise.manuscrito}
              alvo={revisandoParagrafo}
              motivo={
                /* H6: diz qual regra motivou o salto, sem exigir memorização. */
                analise.problemas.find((p) => p.paragrafo === revisandoParagrafo)
                  ? `problema: ${tituloDaRegra(analise.problemas.find((p) => p.paragrafo === revisandoParagrafo)!.regraId) ?? "verificação normativa"}`
                  : undefined
              }
              onVoltar={() => setRevisandoParagrafo(null)}
            />          ) : (
            <>
              {/* Rascunho paginado em folhas A4 (edição inline por parágrafo). */}
              <ManuscritoPaginado valor={bruto} onChange={editar} />
            </>
          )}
        </div>
        </>
        )}
      </section>

      <aside className="inspector" aria-label="Resultado da análise">
        <Resumo analise={analise} />

        {/* Sprint 3 — configuração da assistência IA (opcional) */}
        <div className="resumo-card">
          <h2>Assistente IA (opcional)</h2>
          {estadoIA === "pronta" ? (
            <p className="ia-status ia-pronta">
              Assistente configurado. Sugestões aparecem como <em>assistência</em>, nunca como decisão normativa.
            </p>
          ) : (
            <div className="ia-config">
              <p className="ia-status">
                Sem IA o fluxo continua completo: regras, relatório e correções. Configure uma chave para receber
                sugestões de reescrita.
              </p>
              <input
                type="password"
                className="ia-input"
                placeholder="Chave da API (OpenAI ou compatível)"
                value={chaveInput}
                onChange={(e) => setChaveInput(e.target.value)}
              />
              <button
                className="btn btn-primary"
                type="button"
                disabled={chaveInput.trim().length === 0}
                onClick={() => {
                  const config = { apiKey: chaveInput.trim() };
                  setConfigIA(config);
                  salvarConfigIA(config); // disponível também em /perfil
                  setChaveInput("");
                }}
              >
                Ativar assistente
              </button>
            </div>
          )}
          {erroIA && renderErroIA()}
        </div>

        {analise && <PainelSecoes secoes={analise.secoes} onFocarSecao={(indices) => {
          const primeiro = indices[0];
          if (primeiro) setRevisandoParagrafo(primeiro);
        }} />}

        {analise && analise.problemas.length === 0 && (
          <div className="empty-card">
            <h3>Nenhum problema encontrado</h3>
            <p>O texto passou por todas as verificações do catálogo.</p>
          </div>
        )}

        {sugestaoAtiva && analise && (
          <PainelSugestao
            sugestao={sugestaoAtiva}
            manuscrito={analise.manuscrito}
            onAceitar={aceitarSugestao}
            onIgnorar={() => setSugestaoAtiva(null)}
            sugerindo={carregandoSugestao !== null}
          />
        )}

        {analise?.problemas.map((p) => (
          <ProblemaCard
            key={p.id}
            problema={p}
            onCorrigir={corrigir}
            onLocalizar={() => p.paragrafo > 0 && setRevisandoParagrafo(p.paragrafo)}
            onSugerir={estadoIA === "pronta" ? () => pedirSugestao(p) : undefined}
            sugerindo={carregandoSugestao === p.id}
          />
        ))}

        <PainelHistorico historico={historico} feedbacks={feedbacks} onFeedback={darFeedback} />
      </aside>
    </main>
  );
}
