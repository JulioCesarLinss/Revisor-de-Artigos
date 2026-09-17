import { useCallback, useState } from "react";
import { statusIA, sugerirReescrita } from "./ai/assistente";
import type { ConfiguracaoIA, SugestaoIA } from "./ai/types";
import { aplicarCorrecao } from "./document/acoes";
import { aplicarSugestao } from "./document/aplicarSugestao";
import { iniciarRevisao, type AnaliseRevisao } from "./review/orquestrar";
import type { Problema } from "./rules/types";
import { PainelHistorico } from "./ui/PainelHistorico";
import { PainelSecoes } from "./ui/PainelSecoes";
import { PainelSugestao } from "./ui/PainelSugestao";
import { ProblemaCard } from "./ui/ProblemaCard";
import { RevisarView } from "./ui/RevisarView";
import { Resumo } from "./ui/Resumo";
import { BarraFluxo } from "./ui/BarraFluxo";
import { ComparacaoView } from "./ui/ComparacaoView";
import { registrar, type RegistroAlteracao } from "./workspace/historico";
import {
  estadoInicial,
  proximoEstado,
  registrarVersao,
  ROTULO_ESTADO,
  type EstadoFluxo,
  type VersaoSnapshot,
} from "./workspace/fluxo";

const TEXTO_EXEMPLO = `INTRODUÇÃO

A inteligência artificial vem transformando a produção científica em diversas áreas do conhecimento .

Neste trabalho , discutimos os limites éticos dessa transformação com base na literatura recente  da área.

Este parágrafo exemplifica um problema comum em manuscritos acadêmicos: o autor abre uma citação direta "sem realizar o fechamento adequado das aspas, o que compromete a leitura e a conformidade normativa do texto.

Segundo a literatura , a citabilidade depende de clareza e de rastreabilidade das fontes (Silva 2021).

METODOLOGIA

Realizamos uma revisão narrativa da produção recente  sobre o tema, priorizando trabalhos com evidência empírica.

CONSIDERAÇÕES FINAIS

O trabalho encerra sem ponto final no fim`;

export default function App() {
  const [bruto, setBruto] = useState("");
  const [analise, setAnalise] = useState<AnaliseRevisao | null>(null);
  const [revisandoParagrafo, setRevisandoParagrafo] = useState<number | null>(null);

  // Sprint 3 — assistência IA (opcional; DC-03)
  const [configIA, setConfigIA] = useState<ConfiguracaoIA | null>(null);
  const [chaveInput, setChaveInput] = useState("");
  const [sugestaoAtiva, setSugestaoAtiva] = useState<SugestaoIA | null>(null);
  const [carregandoSugestao, setCarregandoSugestao] = useState<string | null>(null);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [historico, setHistorico] = useState<RegistroAlteracao[]>([]);

  // Sprint 4 — fluxo de revisão guiada
  const [estadoFluxo, setEstadoFluxo] = useState<EstadoFluxo>(estadoInicial);
  const [versoes, setVersoes] = useState<VersaoSnapshot[]>([]);
  const [feedbacks, setFeedbacks] = useState<Record<number, boolean>>({});
  const [mostrandoComparacao, setMostrandoComparacao] = useState(false);

  const estadoIA = statusIA(configIA);

  const analisar = useCallback(() => {
    setAnalise(iniciarRevisao(bruto));
    setRevisandoParagrafo(null);
  }, [bruto]);

  const avancarFluxo = useCallback(() => {
    const seguinte = proximoEstado(estadoFluxo);
    if (!seguinte) return;
    const analiseAtual = analise ?? iniciarRevisao(bruto);
    setVersoes((v) => registrarVersao(v, { estado: estadoFluxo, bruto, totalProblemas: analiseAtual.resumo.total }));
    setEstadoFluxo(seguinte);
    setMostrandoComparacao(true);
  }, [estadoFluxo, analise, bruto]);

  const voltarFluxo = useCallback(() => {
    const ordem: EstadoFluxo[] = ["rascunho", "revisao", "final"];
    const i = ordem.indexOf(estadoFluxo);
    if (i > 0) {
      setEstadoFluxo(ordem[i - 1]);
      setMostrandoComparacao(false);
    }
  }, [estadoFluxo]);

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
  }, []);

  const pedirSugestao = useCallback(
    async (problema: Problema) => {
      if (!configIA || !analise) return;
      const par = analise.manuscrito.paragrafos.find((p) => p.index === problema.paragrafo);
      if (!par) return;

      setCarregandoSugestao(problema.id);
      setErroIA(null);
      const resultado = await sugerirReescrita(configIA, par.texto, problema.paragrafo, {
        regraId: problema.regraId,
        mensagem: problema.mensagem,
        referencia: problema.referencia,
      });
      setCarregandoSugestao(null);

      if (resultado.ok) {
        setSugestaoAtiva(resultado.sugestao);
      } else {
        setErroIA(resultado.motivo);
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
      setSugestaoAtiva(null);
    },
    [sugestaoAtiva],
  );

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <h1>
              NormaReview <span>AI</span>
            </h1>
            <p>Regras normativas como base confiável; IA como assistente opcional.</p>
          </div>
          <div className="norm-chips" aria-label="Normas de referência do projeto">
            <span className="norm-chip">NBR 14724</span>
            <span className="norm-chip">NBR 10520</span>
            <span className="norm-chip">NBR 6023</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="canvas-col" aria-label="Manuscrito em revisão">
          <BarraFluxo
            estado={estadoFluxo}
            podeAvancar={bruto.trim().length > 0}
            onAvancar={avancarFluxo}
            onVoltar={voltarFluxo}
          />

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
              <button className="btn" type="button" onClick={() => editar(TEXTO_EXEMPLO)} disabled={revisandoParagrafo !== null}>
                Carregar exemplo
              </button>
              <button
                className="btn btn-accent"
                type="button"
                onClick={analisar}
                disabled={bruto.trim().length === 0 || revisandoParagrafo !== null}
              >
                Analisar
              </button>
            </span>
          </div>

          <div className="canvas-page">
            {revisandoParagrafo !== null && analise ? (
              <RevisarView manuscrito={analise.manuscrito} alvo={revisandoParagrafo} onVoltar={() => setRevisandoParagrafo(null)} />
            ) : (
              <>
                <label htmlFor="manuscrito" style={{ position: "absolute", left: -9999 }}>
                  Texto do manuscrito
                </label>
                <textarea
                  id="manuscrito"
                  className="manuscript-input"
                  placeholder="Cole aqui o texto do artigo acadêmico. Parágrafos separados por linha em branco; títulos em CAIXA-ALTA criam o relatório por seção."
                  value={bruto}
                  onChange={(e) => editar(e.target.value)}
                  spellCheck={false}
                />
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
                    setConfigIA({ apiKey: chaveInput.trim() });
                    setChaveInput("");
                  }}
                >
                  Ativar assistente
                </button>
              </div>
            )}
            {erroIA && <p className="ia-erro" role="alert">{erroIA}</p>}
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

      <footer className="app-footer">
        <span>© 2026 NormaReview AI · Sprint 4 — Fluxo de Revisão Guiada</span>
        <span className="sep" />
        <span>Rascunho → revisão → versão final, com comparação lado a lado, histórico versionado e feedback.</span>
      </footer>
    </>
  );
}
