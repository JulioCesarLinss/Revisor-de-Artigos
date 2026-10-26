import type { ResultadoDiagnostico } from "../ai/gemini";

interface Props {
  /** Verdadeiro quando o Gemini está disponível (chave no servidor). */
  configurado: boolean;
  /** Verdadeiro enquanto o Gemini responde. */
  carregando: boolean;
  /** Resultado da última consulta; null = ainda não pedida. */
  resultado: ResultadoDiagnostico | null;
  /** Repete a consulta com o manuscrito atual. */
  onTentar: () => void;
  /** Navega até o parágrafo apontado no manuscrito. */
  onFocar: (paragrafo: number) => void;
}

const ROTULO_SEVERIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;
/** Reaproveita os badges da análise normativa (mesmas cores e formas). */
const CLASSE_SEVERIDADE = { alta: "critico", media: "advertencia", baixa: "observacao" } as const;

/**
 * Diagnóstico do manuscrito pedido ao Gemini ao clicar em "Analisar".
 * Segunda opinião sobre o texto inteiro: sempre abaixo da análise normativa
 * local, nunca no lugar dela (DC-02), e nunca quebrando o fluxo (DC-03).
 */
export function PainelGemini({ configurado, carregando, resultado, onTentar, onFocar }: Props) {
  const falha = resultado !== null && !resultado.ok;
  const sucesso = resultado !== null && resultado.ok;

  return (
    <div className="resumo-card">
      <h2>Diagnóstico com Gemini</h2>
      {/* H6: legenda explica o que é e de onde vem, sem exigir memorização. */}
      <p className="resumo-legenda">
        Segunda opinião sobre o texto inteiro: o Gemini lê o manuscrito e aponta problemas com sugestão de correção.
        A análise normativa acima continua sendo a referência.
      </p>

      {carregando && (
        <p className="ia-status" role="status" aria-live="polite">
          <span className="status-spinner status-spinner-sm" aria-hidden="true" /> Gemini analisando o manuscrito…
        </p>
      )}

      {!carregando && !configurado && (
        <p className="ia-status">
          Sem Gemini o fluxo continua completo: regras, relatório e correções. Configure a chave do Gemini
          (<code>GEMINI_API_KEY</code> no servidor, <code>VITE_GEMINI_API_KEY</code> no desenvolvimento local) para
          receber diagnósticos com IA.
        </p>
      )}

      {!carregando && configurado && resultado === null && (
        <p className="ia-status">
          Clique em <strong>Analisar</strong> para pedir um diagnóstico do manuscrito ao Gemini.
        </p>
      )}

      {/* H9: o quê (erro) → por quê (motivo) → como recuperar (tentar de novo). */}
      {!carregando && falha && (
        <div className="ia-erro" role="alert">
          <strong className="ia-erro-titulo">Não foi possível consultar o Gemini</strong>
          <span>{resultado!.motivo}</span>
          <span className="ia-erro-acoes">
            <button className="btn" type="button" onClick={onTentar}>
              Tentar novamente
            </button>
          </span>
        </div>
      )}

      {!carregando && sucesso && (
        <>
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
                  {d.paragrafo > 0 && (
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
