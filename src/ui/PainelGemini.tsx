import { useState } from "react";
import { ROTULO_NIVEL, type DiagnosticoGemini, type ResultadoDiagnostico } from "../ai/gemini";

interface Props {
  /** Verdadeiro quando o Gemini está disponível (chave no servidor). */
  configurado: boolean;
  /** Verdadeiro enquanto o Gemini responde. */
  carregando: boolean;
  /** Resultado da última consulta; null = ainda não pedida. */
  resultado: ResultadoDiagnostico | null;
  /** Verdadeiro quando há texto e o app não está ocupado. */
  podePedir: boolean;
  /** Reanalisa pelas regras e pede o diagnóstico com o manuscrito atual. */
  onPedir: () => void;
  /** Navega até o trecho apontado no manuscrito. */
  onFocar: (diagnostico: DiagnosticoGemini) => void;
  /** Descarta o diagnóstico exibido (o manuscrito não é tocado). */
  onExcluir: () => void;
  /** "Já resolvi": tira da lista o apontamento nesta posição. */
  onResolver: (indice: number) => void;
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
export function PainelGemini({
  configurado,
  carregando,
  resultado,
  podePedir,
  onPedir,
  onFocar,
  onExcluir,
  onResolver,
}: Props) {
  const falha = resultado !== null && !resultado.ok;
  const sucesso = resultado !== null && resultado.ok;
  const [instrucoesAbertas, setInstrucoesAbertas] = useState(true);

  return (
    <div className="resumo-card">
      <h2 className="gemini-titulo">
        <button
          type="button"
          className="gemini-alternar"
          onClick={() => setInstrucoesAbertas((aberto) => !aberto)}
          aria-expanded={instrucoesAbertas}
          aria-controls="gemini-instrucoes"
          title={instrucoesAbertas ? "Esconder as instruções" : "Mostrar as instruções"}
        >
          <span>Diagnóstico com Gemini</span>
          <span className={`gemini-seta${instrucoesAbertas ? " aberta" : ""}`} aria-hidden="true">
            ▾
          </span>
        </button>
      </h2>
      <div id="gemini-instrucoes" hidden={!instrucoesAbertas}>
        {/* H6: legenda explica o que é e de onde vem, sem exigir memorização. */}
        <p className="resumo-legenda">
          Obtenha uma avaliação do seu texto como artigo: se a estrutura está completa, se falta informação, se o
          argumento faz sentido e o que melhorar na escrita. O que você corrigir sai da lista.
        </p>
        {configurado && (
          <>
            <h3 className="gemini-subtitulo">Como funciona</h3>
            <p className="ia-status">
              O texto do artigo será enviado ao Google Gemini para uma avaliação complementar. Você receberá sugestões
              de melhoria e poderá compará-las com os apontamentos da revisão normativa.
            </p>
          </>
        )}
      </div>

      {!configurado ? (
        <p className="ia-status">
          O diagnóstico com Gemini não está disponível no momento. O restante da revisão funciona normalmente.
        </p>
      ) : (
        <>
          <div className="gemini-acoes">
            <button
              className="btn btn-primary"
              type="button"
              onClick={onPedir}
              disabled={!podePedir || carregando}
              aria-busy={carregando || undefined}
              title={podePedir ? "Envia o manuscrito ao Gemini e mostra os apontamentos aqui" : "Cole, digite ou anexe o manuscrito para pedir o diagnóstico"}
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
          {/* Opinião da IA sobre o texto como artigo — não é aprovação normativa (DC-02). */}
          {resultado!.avaliacao && (
            <div className={`gemini-avaliacao nivel-${resultado!.avaliacao.nivel}`}>
              <p className="gemini-avaliacao-nivel">
                Avaliação do artigo: <strong>{ROTULO_NIVEL[resultado!.avaliacao.nivel]}</strong>
              </p>
              {resultado!.avaliacao.faltando.length > 0 && (
                <p className="gemini-avaliacao-falta">
                  <strong>Falta:</strong> {resultado!.avaliacao.faltando.join(", ")}
                </p>
              )}
            </div>
          )}
          {resultado!.resumo && <p className="gemini-resumo">{resultado!.resumo}</p>}
          {resultado!.truncado && (
            <p className="gemini-aviso">
              Diagnóstico feito sobre o início do texto: o manuscrito excede o limite de envio ao Gemini.
            </p>
          )}

          {resultado!.diagnosticos.length === 0 ? (
            <p className="ia-status">Nenhum apontamento pendente. Peça um novo diagnóstico para conferir o texto atual.</p>
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
                  <div className="problema-acoes">
                    {/* Funciona mesmo depois de editar o texto: a posição acompanha a edição. */}
                    {d.paragrafo > 0 && (
                      <button className="btn" type="button" onClick={() => onFocar(d)}>
                        Localizar no manuscrito
                      </button>
                    )}
                    <button
                      className="btn"
                      type="button"
                      onClick={() => onResolver(i)}
                      title="Tira este apontamento da lista; o manuscrito não muda"
                    >
                      Já resolvi
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {/* O resultado fica até o usuário pedir um novo, trocar de arquivo ou excluir. */}
      {!carregando && resultado !== null && (
        <div className="gemini-acoes">
          <button
            className="btn"
            type="button"
            onClick={onExcluir}
            title="Remove este diagnóstico da tela; o manuscrito e a análise normativa continuam"
          >
            Excluir diagnóstico
          </button>
        </div>
      )}
    </div>
  );
}
