import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { statusIA, sugerirReescrita } from "../ai/assistente";
import { diagnosticarComGemini, geminiConfigurado } from "../ai/geminiCliente";
import type { ParagrafoNumerado, ResultadoDiagnostico } from "../ai/gemini";
import { carregarConfigIA, salvarConfigIA } from "../perfil/perfil";
import type { ConfiguracaoIA, SugestaoIA } from "../ai/types";
import { aplicarCorrecao } from "../document/acoes";
import { aplicarSugestao } from "../document/aplicarSugestao";
import { lerArquivo, type ResultadoUpload } from "../document/arquivo";
import { iniciarRevisao, type AnaliseRevisao } from "../review/orquestrar";
import type { Problema } from "../rules/types";
import { PainelGemini } from "../ui/PainelGemini";
import { PainelHistorico } from "../ui/PainelHistorico";
import { ManuscritoPaginado } from "../ui/ManuscritoPaginado";
import { PainelSecoes } from "../ui/PainelSecoes";
import { PainelSugestao } from "../ui/PainelSugestao";
import { ProblemaCard } from "../ui/ProblemaCard";
import { Resumo } from "../ui/Resumo";
import { BarraFluxo } from "../ui/BarraFluxo";
import { ComparacaoView } from "../ui/ComparacaoView";
import { registrar, type RegistroAlteracao } from "../workspace/historico";
import { posicoesParagrafos } from "../workspace/paragrafos";
import {
  estadoInicial,
  proximoEstado,
  registrarVersao,
  ROTULO_ESTADO,
  type EstadoFluxo,
  type VersaoSnapshot,
} from "../workspace/fluxo";
import { carregarWorkspace, salvarWorkspace } from "../workspace/armazenamento";
import { useAutorizacao } from "../firebase/auth";
import { carregarWorkspaceNuvem, salvarWorkspaceNuvem } from "../firebase/persistencia";

/** Espera após a última tecla antes de reanalisar (as regras são instantâneas). */
const ATRASO_REANALISE_MS = 500;

/** Parágrafo destacado no editor; `total` invalida o destaque se parágrafos surgirem/sumirem. */
interface Destaque {
  paragrafo: number;
  total: number;
}

/** Tela /revisar — editor de revisão interativa (conteúdo original do App). */
export default function RevisarPage() {
  // uid do Firebase (quando configurado) — chave da persistência na nuvem.
  const { uid } = useAutorizacao();
  // Workspace restaurado do dispositivo (uma única leitura, no primeiro render):
  // o rascunho/versões sobrevivem à troca de rotas e alimentam /historico.
  const [salvo] = useState(carregarWorkspace);
  const location = useLocation();

  // Upload de arquivo (aba Revisar): seletor + arrastar-e-soltar na folha.
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);

  const [bruto, setBruto] = useState(salvo?.bruto ?? "");
  // Texto restaurado já chega analisado (as regras rodam no navegador, na hora).
  const [analise, setAnalise] = useState<AnaliseRevisao | null>(() =>
    salvo && salvo.bruto.trim().length > 0 ? iniciarRevisao(salvo.bruto) : null,
  );

  // Destaque no editor: "Localizar" (avisos, seções, Gemini, ou o /historico
  // via navegação) marca o parágrafo; clicar dentro dele apaga a marca.
  const posicoes = useMemo(() => posicoesParagrafos(bruto), [bruto]);
  const [destaque, setDestaque] = useState<Destaque | null>(() => {
    const alvo = (location.state as { alvo?: number } | null)?.alvo;
    return typeof alvo === "number" && alvo > 0 ? { paragrafo: alvo, total: posicoes.length } : null;
  });
  const focar = useCallback(
    (paragrafo: number) => {
      if (paragrafo <= 0) return;
      setMostrandoComparacao(false); // o editor precisa estar visível
      setDestaque({ paragrafo, total: posicoes.length });
    },
    [posicoes.length],
  );
  /** Trecho a destacar; some se o número de parágrafos mudou desde o clique. */
  const trechoDestacado =
    destaque && destaque.total === posicoes.length ? (posicoes[destaque.paragrafo - 1] ?? null) : null;

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

  // Texto original do arquivo enviado — base para "Voltar ao original" no /historico.
  const [textoOriginal, setTextoOriginal] = useState<string | null>(salvo?.textoOriginal ?? null);

  // Heurística 1 (Nielsen) — visibilidade do status do sistema
  const [ocupadoCom, setOcupadoCom] = useState<string | null>(null);
  const [statusSistema, setStatusSistema] = useState<string | null>(null);

  // Sprint 4 — fluxo de revisão guiada (restaurado do storage quando houver)
  const [estadoFluxo, setEstadoFluxo] = useState<EstadoFluxo>(salvo?.estadoFluxo ?? estadoInicial());
  const [versoes, setVersoes] = useState<VersaoSnapshot[]>(salvo?.versoes ?? []);
  const [feedbacks, setFeedbacks] = useState<Record<number, boolean>>(salvo?.feedbacks ?? {});
  const [mostrandoComparacao, setMostrandoComparacao] = useState(false);

  const estadoIA = statusIA(configIA);
  // Gemini: a chave vive só no servidor (api/gemini) — aqui consultamos se ele
  // está ativo (null = ainda sem resposta da consulta).
  const [geminiAtivo, setGeminiAtivo] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    void geminiConfigurado().then((ativo) => {
      if (vivo) setGeminiAtivo(ativo);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Ocupado quando há análise/versão em processamento ou sugestão IA pendente.
  const processando = ocupadoCom !== null || carregandoSugestao !== null;

  // Diagnóstico com Gemini (DC-03): só pelo botão próprio do painel — o texto
  // sai para o Google apenas quando o usuário pede. A análise local roda antes,
  // então uma falha da IA não atrasa o fluxo.
  const [diagnostico, setDiagnostico] = useState<ResultadoDiagnostico | null>(null);
  const [analisandoGemini, setAnalisandoGemini] = useState(false);
  // Texto que gerou o diagnóstico atual: se o manuscrito mudar, o painel avisa.
  const [textoDiagnosticado, setTextoDiagnosticado] = useState<string | null>(null);
  const geminiOcupado = useRef(false);

  const pedirDiagnostico = useCallback(async (paragrafos: ParagrafoNumerado[], texto: string) => {
    if (geminiAtivo === false || geminiOcupado.current) return; // uma consulta por vez
    geminiOcupado.current = true;
    setDiagnostico(null);
    setAnalisandoGemini(true);
    try {
      const diagnosticado = await diagnosticarComGemini(paragrafos);
      setDiagnostico(diagnosticado);
      setTextoDiagnosticado(texto);
      if (diagnosticado.ok) {
        setStatusSistema(`Diagnóstico do Gemini — ${diagnosticado.diagnosticos.length} apontamento(s).`);
      }
    } finally {
      geminiOcupado.current = false;
      setAnalisandoGemini(false);
    }
  }, [geminiAtivo]);

  /**
   * Botão do painel do Gemini: reanalisa pelas regras na hora, para a
   * numeração dos parágrafos enviada bater com o texto atual (e o
   * "Localizar" levar ao lugar certo), e então pede o diagnóstico.
   */
  const pedirGemini = useCallback(() => {
    const resultado = iniciarRevisao(bruto);
    setAnalise(resultado);
    void pedirDiagnostico(resultado.manuscrito.paragrafos, bruto);
  }, [bruto, pedirDiagnostico]);

  // Os avisos acompanham o texto: pouco depois da última alteração (tecla,
  // correção rápida, sugestão aceita, upload), a análise é refeita e os avisos
  // já resolvidos somem. Se a análise já é deste texto, nada a fazer.
  useEffect(() => {
    if ((analise?.manuscrito.bruto ?? "") === bruto) return;
    const t = setTimeout(() => {
      setAnalise(bruto.trim().length > 0 ? iniciarRevisao(bruto) : null);
    }, ATRASO_REANALISE_MS);
    return () => clearTimeout(t);
  }, [bruto, analise]);

  // Persiste o workspace a cada mudança: /historico lê daqui e o rascunho
  // sobrevive à navegação entre rotas.
  useEffect(() => {
    salvarWorkspace({ bruto, textoOriginal, historico, versoes, estadoFluxo, feedbacks });
  }, [bruto, textoOriginal, historico, versoes, estadoFluxo, feedbacks]);

  // Sem manuscrito, o fluxo guiado volta ao início (a barra de etapas mostra
  // "Rascunho" e o selo de exportação nem aparece) — inclusive na próxima visita.
  useEffect(() => {
    if (bruto.trim().length === 0 && estadoFluxo !== "rascunho") setEstadoFluxo("rascunho");
  }, [bruto, estadoFluxo]);

  // Com Firebase, carrega da nuvem quando o dispositivo local está vazio
  // (primeiro acesso deste dispositivo à conta).
  const nuvemCarregada = useRef(false);
  useEffect(() => {
    if (!uid || nuvemCarregada.current) return;
    nuvemCarregada.current = true;
    void carregarWorkspaceNuvem(uid).then((nuvem) => {
      if (!nuvem || bruto.trim().length > 0) return; // só preenche vazio
      setBruto(nuvem.bruto);
      setTextoOriginal(nuvem.textoOriginal ?? null);
      setHistorico(nuvem.historico ?? []);
      setVersoes(nuvem.versoes ?? []);
      setEstadoFluxo(nuvem.estadoFluxo ?? estadoInicial());
      setFeedbacks(nuvem.feedbacks ?? {});
    });
  }, [uid, bruto]);

  // Com Firebase, espelha o workspace na nuvem com debounce (evita gravar a
  // cada tecla). O localStorage continua sendo a fonte imediata/offline.
  useEffect(() => {
    if (!uid) return;
    const estado = { bruto, textoOriginal, historico, versoes, estadoFluxo, feedbacks };
    const t = setTimeout(() => {
      void salvarWorkspaceNuvem(uid, estado);
    }, 1200);
    return () => clearTimeout(t);
  }, [uid, bruto, textoOriginal, historico, versoes, estadoFluxo, feedbacks]);

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
   * Heurística 7 (Nielsen) — flexibilidade e eficiência de uso: acelerador de
   * teclado para avançar no fluxo (a análise já é automática), ignorado
   * enquanto o app está ocupado.
   */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.key !== "Enter") return;
      if (processando) return;
      e.preventDefault();
      if (bruto.trim().length > 0 && estadoFluxo !== "final") avancarFluxo();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [avancarFluxo, bruto, estadoFluxo, processando]);

  const darFeedback = useCallback((historicoId: number, ajudou: boolean) => {
    setFeedbacks((f) => ({ ...f, [historicoId]: ajudou }));
  }, []);

  const editar = useCallback((novo: string) => {
    setBruto(novo);
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
    setTextoOriginal(resultado.texto); // guarda o original do upload p/ "Voltar ao original"
    setDestaque(null); // o texto novo invalida um destaque antigo
    setDiagnostico(null); // o diagnóstico anterior pertencia ao texto anterior
    setTextoDiagnosticado(null);
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
        {(carregandoSugestao !== null || ocupadoCom !== null || analisandoGemini || statusSistema) && (
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
            ) : analisandoGemini ? (
              <>
                <span className="status-spinner" aria-hidden="true" />
                Diagnóstico do Gemini em andamento…
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
          {/* Folhas A4 editáveis; o parágrafo localizado aparece destacado. */}
          <ManuscritoPaginado
            valor={bruto}
            onChange={editar}
            destaque={trechoDestacado}
            onLimparDestaque={() => setDestaque(null)}
          />
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

        {/* Diagnóstico do Gemini — só quando o usuário pede, no botão do painel. */}
        <PainelGemini
          configurado={geminiAtivo !== false}
          carregando={analisandoGemini}
          resultado={diagnostico}
          podePedir={bruto.trim().length > 0 && !processando && !analisandoGemini}
          desatualizado={diagnostico !== null && textoDiagnosticado !== null && textoDiagnosticado !== bruto}
          onPedir={pedirGemini}
          onFocar={focar}
        />

        {analise && <PainelSecoes secoes={analise.secoes} onFocarSecao={(indices) => {
          const primeiro = indices[0];
          if (primeiro) focar(primeiro);
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

        {/* Contador que acompanha as correções: cai a cada aviso resolvido. */}
        {analise && analise.problemas.length > 0 && (
          <p className="avisos-restantes" role="status" aria-live="polite">
            <strong>{analise.problemas.length}</strong>{" "}
            {analise.problemas.length === 1 ? "aviso restante" : "avisos restantes"}
          </p>
        )}

        {/* Parágrafos marcados como título: o botão "Aplicar correção" não
            aparece — a correção determinística poderia estragar o título. */}
        {analise?.problemas.map((p) => (
          <ProblemaCard
            key={p.id}
            problema={p}
            onCorrigir={corrigir}
            onLocalizar={() => focar(p.paragrafo)}
            onSugerir={estadoIA === "pronta" ? () => pedirSugestao(p) : undefined}
            sugerindo={carregandoSugestao === p.id}
            listarAcao={!analise.manuscrito.paragrafos.find((x) => x.index === p.paragrafo)?.ehTitulo}
          />
        ))}

        <PainelHistorico historico={historico} feedbacks={feedbacks} onFeedback={darFeedback} />
      </aside>
    </main>
  );
}
