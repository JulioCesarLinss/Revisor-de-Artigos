import { ehDoArtigo, ROTULO_NIVEL, type DiagnosticoGemini, type ResultadoDiagnostico } from "../ai/gemini";

/** Estado do "Conferir" de um apontamento sobre o artigo. */
export type Conferencia =
  | { estado: "conferindo" }
  | { estado: "resolvido"; explicacao: string }
  | { estado: "pendente"; explicacao: string }
  | { estado: "erro"; motivo: string };

interface Props {
  /** Resultado da análise (sucesso ou falha). */
  resultado: ResultadoDiagnostico;
  /** Título do quadro de erro, ex.: "Não foi possível consultar o Gemini". */
  tituloErro: string;
  /** Nome acessível da lista de apontamentos. */
  rotuloLista: string;
  /** Falso quando a IA não está disponível para conferir (o botão some). */
  podeConferir: boolean;
  /** Navega até o trecho apontado no manuscrito. */
  onFocar: (diagnostico: DiagnosticoGemini) => void;
  /** "Já resolvi": tira da lista o apontamento (pelo id). */
  onResolver: (id: number) => void;
  /** "Conferir": pergunta à IA se o apontamento foi resolvido no texto atual. */
  onConferir: (diagnostico: DiagnosticoGemini) => void;
  /** Resultado do "Conferir" de cada apontamento, pelo id. */
  conferencias: Record<number, Conferencia>;
  /** Descarta a análise exibida (o manuscrito não é tocado). */
  onExcluir: () => void;
  rotuloExcluir: string;
}

const ROTULO_SEVERIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;
/** Reaproveita os badges da análise normativa (mesmas cores e formas). */
const CLASSE_SEVERIDADE = { alta: "critico", media: "advertencia", baixa: "observacao" } as const;

/**
 * Resultado de uma análise com IA: avaliação geral do manuscrito, resumo e
 * apontamentos com Localizar / Conferir / Já resolvi. O mesmo visual no
 * Diagnóstico com Gemini (chave da plataforma) e no Assistente opcional
 * (chave do usuário).
 */
export function ResultadoAnaliseIA({
  resultado,
  tituloErro,
  rotuloLista,
  podeConferir,
  onFocar,
  onResolver,
  onConferir,
  conferencias,
  onExcluir,
  rotuloExcluir,
}: Props) {
  return (
    <>
      {/* H9: o quê (erro) → por quê (motivo). A recuperação é o botão de pedir de novo. */}
      {!resultado.ok && (
        <div className="ia-erro" role="alert">
          <strong className="ia-erro-titulo">{tituloErro}</strong>
          <span>{resultado.motivo}</span>
        </div>
      )}

      {resultado.ok && (
        <>
          {/* Opinião da IA sobre o texto como artigo — não é aprovação normativa (DC-02). */}
          {resultado.avaliacao && (
            <div className={`gemini-avaliacao nivel-${resultado.avaliacao.nivel}`}>
              <p className="gemini-avaliacao-rotulo">Avaliação geral do manuscrito</p>
              <p className="gemini-avaliacao-nivel">{ROTULO_NIVEL[resultado.avaliacao.nivel]}</p>
              {resultado.avaliacao.faltando.length > 0 && (
                <p className="gemini-avaliacao-falta">Elementos ausentes: {resultado.avaliacao.faltando.join(", ")}</p>
              )}
            </div>
          )}
          {resultado.resumo && <p className="gemini-resumo">{resultado.resumo}</p>}
          {resultado.truncado && (
            <p className="gemini-aviso">
              Análise feita sobre o início do texto: o manuscrito excede o limite de envio ao Gemini.
            </p>
          )}

          {resultado.diagnosticos.length === 0 ? (
            <p className="ia-status">Nenhum apontamento pendente. Peça uma nova análise para conferir o texto atual.</p>
          ) : (
            <ul className="gemini-lista" role="list" aria-label={rotuloLista}>
              {resultado.diagnosticos.map((d, i) => {
                const doArtigo = ehDoArtigo(d);
                const conferencia = d.id !== undefined ? conferencias[d.id] : undefined;
                const conferindo = conferencia?.estado === "conferindo";
                return (
                  <li key={d.id ?? `${d.paragrafo}-${i}`} className="gemini-item">
                    <span className="gemini-topo">
                      {/* O chip visual é o mesmo da análise normativa. */}
                      <span className="chip-regra">{d.categoria}</span>
                      <span className={`badge-sev ${CLASSE_SEVERIDADE[d.severidade]}`}>
                        {ROTULO_SEVERIDADE[d.severidade]}
                      </span>
                    </span>
                    <p className="gemini-desc">
                      <strong>{d.paragrafo > 0 ? `Parágrafo ${d.paragrafo}:` : "Documento inteiro:"}</strong>{" "}
                      {d.descricao}
                    </p>
                    {d.sugestao && (
                      <p className="gemini-sugestao">
                        <strong>Sugestão:</strong> {d.sugestao}
                      </p>
                    )}
                    {/* Resultado do "Conferir": o que a IA achou do texto revisado. */}
                    {conferencia && conferencia.estado !== "conferindo" && (
                      <p className={`gemini-conferencia ${conferencia.estado}`} role="status">
                        {conferencia.estado === "resolvido" && (
                          <>
                            <strong>Corrigido.</strong> {conferencia.explicacao}
                          </>
                        )}
                        {conferencia.estado === "pendente" && (
                          <>
                            <strong>Ainda não resolvido.</strong> {conferencia.explicacao}
                          </>
                        )}
                        {conferencia.estado === "erro" && (
                          <>
                            <strong>Não foi possível conferir.</strong> {conferencia.motivo}
                          </>
                        )}
                      </p>
                    )}
                    <div className="problema-acoes">
                      {/* Erros de linguagem saem sozinhos ao corrigir; os do artigo, só aqui. */}
                      {doArtigo && podeConferir && d.id !== undefined && (
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => onConferir(d)}
                          disabled={conferindo || conferencia?.estado === "resolvido"}
                          aria-busy={conferindo || undefined}
                          title="Envia o texto atual à IA para conferir só este apontamento"
                        >
                          {conferindo ? "Conferindo…" : "Conferir"}
                        </button>
                      )}
                      {/* Funciona mesmo depois de editar o texto: a posição acompanha a edição. */}
                      {d.paragrafo > 0 && (
                        <button className="btn" type="button" onClick={() => onFocar(d)}>
                          Localizar no manuscrito
                        </button>
                      )}
                      {doArtigo && d.id !== undefined && (
                        <button
                          className="btn"
                          type="button"
                          onClick={() => onResolver(d.id!)}
                          title="Tira este apontamento da lista; o manuscrito não muda"
                        >
                          Já resolvi
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* O resultado fica até o usuário pedir um novo, trocar de arquivo ou excluir. */}
      <div className="gemini-acoes">
        <button
          className="btn"
          type="button"
          onClick={onExcluir}
          title="Remove esta análise da tela; o manuscrito e a análise normativa continuam"
        >
          {rotuloExcluir}
        </button>
      </div>
    </>
  );
}
