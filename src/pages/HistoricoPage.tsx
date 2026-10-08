import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROTULO_ESTADO } from "../workspace/fluxo";
import { ROTULO_ORIGEM } from "../workspace/historico";
import {
  carregarWorkspace,
  contarPorOrigem,
  limparHistoricoWorkspace,
  type EstadoWorkspace,
} from "../workspace/armazenamento";
import { tituloDaRegra } from "../ui/rotulos";

type Filtro = "todas" | "manual" | "ia";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "manual", rotulo: "Correções manuais" },
  { valor: "ia", rotulo: "Sugestões de IA" },
];

/** Troca o código da regra pelo título legível, sem esconder o rastro (H6). */
function descrever(descricao: string): string {
  return descricao.replace(/\(([A-Z]\d{3})\)/, (_, id: string) => `(${tituloDaRegra(id) ?? id})`);
}

/** Tela /historico — versões do fluxo guiado e alterações com rastro (DC-13). */
export default function HistoricoPage() {
  const navegar = useNavigate();
  const [workspace, setWorkspace] = useState<EstadoWorkspace | null>(() => carregarWorkspace());
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [status, setStatus] = useState<string | null>(null);

  const contagem = contarPorOrigem(workspace?.historico ?? []);
  const versoes = workspace?.versoes ?? [];
  const alteracoes = (workspace?.historico ?? [])
    .filter((h) => filtro === "todas" || h.origem === filtro)
    .slice()
    .reverse();

  /** Localizar o parágrafo no editor: /revisar restaura, analisa e salta (Esc volta). */
  const localizar = (alvo: number) => navegar("/revisar", { state: { alvo } });

  const limpar = () => {
    const ok = window.confirm(
      "Limpar o histórico de alterações e versões? O manuscrito atual será mantido.",
    );
    if (!ok) return;
    setWorkspace(limparHistoricoWorkspace());
    setStatus("Histórico limpo — o manuscrito atual foi mantido.");
  };

  const vazio = !workspace || (contagem.total === 0 && versoes.length === 0);

  return (
    <main className="historico-main" id="conteudo">
      <div className="historico-cabecalho">
        <div>
          <h2>Histórico de revisões</h2>
          <p>
            Versões do fluxo guiado e cada alteração com origem distinguível — correção manual ou sugestão de IA
            aceita (DC-13).
          </p>
        </div>
        <div className="historico-acoes">
          {!vazio && (
            <button className="btn historico-btn-perigo" type="button" onClick={limpar}>
              Limpar histórico
            </button>
          )}
          <Link className="btn btn-primary" to="/revisar">
            Abrir o editor
          </Link>
        </div>
      </div>

      <p className="status-sistema" role="status" aria-live="polite">
        {status ??
          (workspace
            ? `Estado atual do fluxo: ${ROTULO_ESTADO[workspace.estadoFluxo]} · ${contagem.total} alteração(ões) · ${versoes.length} versão(ões).`
            : "Nenhum dado salvo neste dispositivo.")}
      </p>

      {vazio ? (
        <div className="empty-card historico-vazio">
          <h3>Nenhuma revisão registrada ainda</h3>
          <p>
            Abra o editor, carregue um exemplo ou cole seu manuscrito e clique em <strong>Analisar</strong>. Cada
            correção rápida e cada sugestão de IA aceita aparecerão aqui com rastro, além das versões registradas
            ao avançar no fluxo.
          </p>
          <Link className="btn btn-primary" to="/revisar">
            Ir para Revisar →
          </Link>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="historico-stats">
            <div className="historico-stat">
              <strong>{ROTULO_ESTADO[workspace!.estadoFluxo]}</strong>
              <span>Estado do fluxo</span>
            </div>
            <div className="historico-stat">
              <strong>{contagem.total}</strong>
              <span>Alterações ({contagem.manual} manuais · {contagem.ia} IA)</span>
            </div>
            <div className="historico-stat">
              <strong>{versoes.length}</strong>
              <span>Versões registradas</span>
            </div>
          </div>

          {/* Linha do tempo de versões */}
          <section className="historico-secao" aria-label="Versões do fluxo">
            <h3>Versões do fluxo</h3>
            {versoes.length === 0 ? (
              <p className="historico-nota">
                Nenhuma versão registrada — avance no fluxo (Rascunho → Revisão → Versão final) para criar snapshots
                comparáveis.
              </p>
            ) : (
              <ol className="historico-timeline">
                {[...versoes].reverse().map((v, i) => (
                  <li key={v.id}>
                    <span className="historico-timeline-marca" aria-hidden="true" />
                    <span className="historico-timeline-estado">
                      {ROTULO_ESTADO[v.estado]}
                      {i === 0 && versoes.length > 1 && (
                        <span className="historico-timeline-atual">mais recente</span>
                      )}
                    </span>
                    <span className="historico-timeline-dados">
                      {v.totalProblemas} problema(s) na análise
                    </span>
                    <span className="historico-quando">{v.quando}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Alterações com filtro */}
          <section className="historico-secao" aria-label="Alterações registradas">
            <div className="historico-secao-topo">
              <h3>Alterações registradas</h3>
              <div className="historico-filtros" role="group" aria-label="Filtrar por origem">
                {FILTROS.map((f) => (
                  <button
                    key={f.valor}
                    type="button"
                    className={`historico-filtro ${filtro === f.valor ? "ativo" : ""}`}
                    aria-pressed={filtro === f.valor}
                    onClick={() => setFiltro(f.valor)}
                  >
                    {f.rotulo}
                  </button>
                ))}
              </div>
            </div>

            {alteracoes.length === 0 ? (
              <p className="historico-nota">Nenhuma alteração com esta origem.</p>
            ) : (
              <ul className="historico-lista historico-lista-pagina">
                {alteracoes.map((h) => {
                  const fb = workspace!.feedbacks[h.id];
                  return (
                    <li key={h.id}>
                      <span className={`historico-origem origem-${h.origem}`}>{ROTULO_ORIGEM[h.origem]}</span>
                      <span className="historico-desc">
                        ¶{h.paragrafo} — {descrever(h.descricao)}
                      </span>
                      <span className="historico-quando">{h.quando}</span>
                      <span
                        className={
                          fb === undefined
                            ? "historico-feedback"
                            : `historico-feedback registrado ${fb ? "positivo" : "negativo"}`
                        }
                      >
                        {fb === undefined ? "sem feedback" : fb ? "👍 ajudou" : "👎 não ajudou"}
                      </span>
                      <button
                        className="btn historico-localizar"
                        type="button"
                        onClick={() => localizar(h.paragrafo)}
                        title="Ir para o parágrafo no editor (analisa e abre o modo revisar)"
                      >
                        Localizar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <div className="historico-navegacao">
        <Link className="btn" to="/revisar">
          ← Revisar
        </Link>
        <Link className="btn" to="/laudo">
          Laudo →
        </Link>
      </div>
    </main>
  );
}
