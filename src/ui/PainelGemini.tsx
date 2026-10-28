import type { ResultadoDiagnostico } from "../ai/gemini";

interface Props {
  /** Verdadeiro quando o Gemini está disponível (chave no servidor). */
  configurado: boolean;
  /** Verdadeiro enquanto o Gemini responde. */
  carregando: boolean;
  /** Resultado da última consulta; null = ainda não pedida. */
  resultado: ResultadoDiagnostico | null;
  /** Verdadeiro quando há texto e o app não está ocupado. */
  podePedir: boolean;
  /** O manuscrito mudou depois do diagnóstico exibido. */
  desatualizado: boolean;
  /** Reanalisa pelas regras e pede o diagnóstico com o manuscrito atual. */
  onPedir: () => void;
  /** Navega até o parágrafo apontado no manuscrito. */
  onFocar: (paragrafo: number) => void;
}

const ROTULO_SEVERIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;
/** Reaproveita os badges da análise normativa (mesmas cores e formas). */
const CLASSE_SEVERIDADE = { alta: "critico", media: "advertencia", baixa: "observacao" } as const;

/**
 * Diagnóstico do manuscrito com o Gemini, pedido no botão próprio do painel.
 * Segunda opinião sobre o texto inteiro: sempre abaixo da análise normativa
 * local, nunca no lugar dela (DC-02), e nunca quebrando o fluxo (DC-03).
 * O texto só sai para o Google quando o usuário clica — e o aviso diz isso.
 */
export function PainelGemini({ configurado, carregando, resultado, podePedir, desatualizado, onPedir, onFocar }: Props) {
  const falha = resultado !== null && !resultado.ok;
  const sucesso = resultado !== null && resultado.ok;

  return (
    <div className="resumo-card">
      <h2>Diagnóstico com Gemini</h2>
      {/* H6: legenda explica o que é e de onde vem, sem exigir memorização. */}
      <p className="resumo-legenda">
        Obtenha uma análise complementar do seu manuscrito, com sugestões de melhoria na clareza, coerência, estrutura
        e qualidade da escrita acadêmica.
      </p>

      {!configurado ? (
        <p className="ia-status">
          O diagnóstico com Gemini não está disponível no momento. O restante da revisão funciona normalmente.
        </p>
      ) : (
        <>
          <h3 className="gemini-subtitulo">Como funciona</h3>
          <p className="ia-status">
            O texto do artigo será enviado ao Google Gemini para uma avaliação complementar. Você receberá sugestões
            de melhoria e poderá compará-las com os apontamentos da revisão normativa.
          </p>
          <div className="gemini-acoes">
            <button
              className="btn btn-primary"
              type="button"
              onClick={onPedir}
              disabled={!podePedir || carregando}
              aria-busy={carregando || undefined}
              title={podePedir ? "Envia o manuscrito ao Gemini e mostra os apontamentos aqui" : "Cole ou digite o texto do manuscrito (e saia do modo revisar) para pedir o diagnóstico"}
            >
              {resultado === null ? "Pedir diagnóstico ao Gemini" : "Pedir novo diagnóstico"}
            </button>
          </div>
        </>
      )}

      {carregando && (
        <p className="ia-status" role="status" aria-live="polite">
          <span className="status-spinner status-spinner-sm" aria-hidden="true" /> Gemini analisando o manuscrito…
        </p>
      )}

      {/* H9: o quê (erro) → por quê (motivo). A recuperação é o botão acima. */}
      {!carregando && falha && (
        <div className="ia-erro" role="alert">
          <strong className="ia-erro-titulo">Não foi possível consultar o Gemini</strong>
          <span>{resultado!.motivo}</span>
        </div>
      )}

      {!carregando && sucesso && (
        <>
          {desatualizado && (
            <p className="gemini-aviso">O texto mudou depois deste diagnóstico. Peça um novo para atualizar.</p>
          )}
          {resultado!.resumo && <p className="gemini-resumo">{resultado!.resumo}</p>}
          {resultado!.truncado && (
            <p className="gemini-aviso">
              Diagnóstico feito sobre o início do texto: o manuscrito excede o limite de envio ao Gemini.
            </p>
          )}

          {resultado!.diagnosticos.length === 0 ? (
            <p className="ia-status">O Gemini não apontou problemas neste texto.</p>
          ) : (
            <ul className="gemini-lista" role="list" aria-label="Diagnósticos do Gemini">
              {resultado!.diagnosticos.map((d, i) => (
                <li key={`${d.paragrafo}-${i}`} className="gemini-item">
                  <span className="gemini-topo">
                    {/* O chip visual é o mesmo da análise normativa. */}
                    <span className="chip-regra">{d.categoria}</span>
                    <span className={`badge-sev ${CLASSE_SEVERIDADE[d.severidade]}`}>
                      {ROTULO_SEVERIDADE[d.severidade]}
                    </span>
                  </span>
                  <p className="gemini-desc">
                    {d.paragrafo > 0 ? (
                      <>
                        <strong>Parágrafo {d.paragrafo}:</strong>{" "}
                      </>
                    ) : (
                      <>
                        <strong>Documento inteiro:</strong>{" "}
                      </>
                    )}
                    {d.descricao}
                  </p>
                  {d.sugestao && (
                    <p className="gemini-sugestao">
                      <strong>Sugestão:</strong> {d.sugestao}
                    </p>
                  )}
                  {d.paragrafo > 0 && !desatualizado && (
                    <div className="problema-acoes">
                      <button className="btn" type="button" onClick={() => onFocar(d.paragrafo)}>
                        Localizar no manuscrito
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
