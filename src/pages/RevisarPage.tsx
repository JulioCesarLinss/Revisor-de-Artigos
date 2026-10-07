import { useCallback, useEffect, useState } from "react";
import { statusIA, sugerirReescrita } from "../ai/assistente";
import { carregarConfigIA, salvarConfigIA } from "../perfil/perfil";
import type { ConfiguracaoIA, SugestaoIA } from "../ai/types";
import { aplicarCorrecao } from "../document/acoes";
import { aplicarSugestao } from "../document/aplicarSugestao";
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

const TEXTO_EXEMPLO = `INTRODUÇÃO

A inteligência artificial vem transformando a produção científica em diversas áreas do conhecimento .

Neste trabalho , discutimos os limites éticos dessa transformação com base na literatura recente  da área.

Este parágrafo exemplifica um problema comum em manuscritos acadêmicos: o autor abre uma citação direta "sem realizar o fechamento adequado das aspas, o que compromete a leitura e a conformidade normativa do texto.

Segundo a literatura , a citabilidade depende de clareza e de rastreabilidade das fontes (Silva 2021).

METODOLOGIA

Realizamos uma revisão narrativa da produção recente  sobre o tema, priorizando trabalhos com evidência empírica.

CONSIDERAÇÕES FINAIS

O trabalho encerra sem ponto final no fim`;

/** Tela /revisar — editor de revisão interativa (conteúdo original do App). */
export default function RevisarPage() {
  const [bruto, setBruto] = useState("");
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
  const [historico, setHistorico] = useState<RegistroAlteracao[]>([]);

  // Heurística 1 (Nielsen) — visibilidade do status do sistema
  const [ocupadoCom, setOcupadoCom] = useState<string | null>(null);
  const [statusSistema, setStatusSistema] = useState<string | null>(null);

  // Sprint 4 — fluxo de revisão guiada
  const [estadoFluxo, setEstadoFluxo] = useState<EstadoFluxo>(estadoInicial);
  const [versoes, setVersoes] = useState<VersaoSnapshot[]>([]);
  const [feedbacks, setFeedbacks] = useState<Record<number, boolean>>({});
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
    }, 0);
  }, [bruto]);

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
            (statusSistema ?? "Pronto — cole o manuscrito e clique em Analisar.")
          )}
        </p>

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
            {/* H7: os aceleradores ficam documentados junto dos botões que acionam. */}
            <button className="btn" type="button" onClick={() => editar(TEXTO_EXEMPLO)} disabled={revisandoParagrafo !== null || processando} title="Substitui o conteúdo atual pelo texto de demonstração com problemas típicos">
              Carregar exemplo
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

        {/* H7: os atalhos de eficiência ficam documentados e sempre à vista. */}
        <p className="atalhos-dica">
          Aceleradores de teclado: <kbd className="atalho-tecla">Ctrl+↵</kbd> analisar · <kbd className="atalho-tecla">Ctrl+Shift+↵</kbd> avançar etapa · <kbd className="atalho-tecla">Esc</kbd> sair do modo revisar.
        </p>

        <div className="canvas-page">
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

        {!analise && (
          <div className="empty-card">
            <h3>Nenhuma análise ainda</h3>
            <p>
              Cole o texto e clique em <strong>Analisar</strong>. Problemas normativos aparecem com referência e, se
              você ativar o assistente IA, cada problema pode gerar uma sugestão de reescrita.
            </p>
          </div>
        )}

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
