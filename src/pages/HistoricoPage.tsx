import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROTULO_ESTADO } from "../workspace/fluxo";
import { ROTULO_ORIGEM } from "../workspace/historico";
import {
  carregarWorkspace,
  contarPorOrigem,
  limparHistoricoWorkspace,
  limparWorkspace,
  restaurarOriginalWorkspace,
  type EstadoWorkspace,
} from "../workspace/armazenamento";
import { tituloDaRegra } from "../ui/rotulos";
import { useAutorizacao } from "../firebase/auth";
import { apagarWorkspaceNuvem, salvarWorkspaceNuvem } from "../firebase/persistencia";

/** Aviso quando a ação valeu no dispositivo mas a cópia da conta não acompanhou. */
const AVISO_NUVEM =
  "Não foi possível atualizar a cópia salva na sua conta. Verifique a conexão e repita a ação.";

type Filtro = "todas" | "manual" | "ia";

/** Ações que exigem confirmação dentro do app (especifica a pergunta). */
type Confirmacao = "limpar" | "voltarOriginal" | "descartar" | null;

const PERGUNTA_CONFIRMACAO: Record<Exclude<Confirmacao, null>, string> = {
  limpar: "Limpar o histórico de alterações e versões? O manuscrito atual será mantido.",
  voltarOriginal: "Restaurar o texto original do arquivo? O histórico e as versões serão apagados.",
  descartar: "Apagar o manuscrito, o histórico e as versões? Esta ação não pode ser desfeita.",
};

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
  // Logado: as ações também atualizam a cópia do Firestore (senão o /revisar
  // traria de volta o que foi apagado aqui).
  const { uid } = useAutorizacao();
  const [workspace, setWorkspace] = useState<EstadoWorkspace | null>(() => carregarWorkspace());
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [status, setStatus] = useState<string | null>(null);

  /** Confirmação em painel no app (sem pop-up do navegador). */
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);

  const contagem = contarPorOrigem(workspace?.historico ?? []);
  const versoes = workspace?.versoes ?? [];
  const alteracoes = (workspace?.historico ?? [])
    .filter((h) => filtro === "todas" || h.origem === filtro)
    .slice()
    .reverse();

  /** Localizar o parágrafo no editor: /revisar restaura, analisa e destaca o parágrafo. */
  const localizar = (alvo: number) => navegar("/revisar", { state: { alvo } });

  /** Aplica no dispositivo na hora; a nuvem vem depois e só muda o status se falhar. */
  const sincronizar = async (acaoNuvem: (uid: string) => Promise<boolean>, mensagemOk: string) => {
    setStatus(mensagemOk);
    if (!uid) return; // sem login: só o dispositivo
    if (!(await acaoNuvem(uid))) setStatus(`${mensagemOk} ${AVISO_NUVEM}`);
  };

  const limpar = () => {
    const limpo = limparHistoricoWorkspace();
    setWorkspace(limpo);
    setConfirmacao(null);
    const mensagem = "Histórico limpo — o manuscrito atual foi mantido e a etapa voltou a Rascunho.";
    if (limpo) void sincronizar((u) => salvarWorkspaceNuvem(u, limpo), mensagem);
    else setStatus(mensagem);
  };

  const temOriginal = !!workspace?.textoOriginal;

  const voltarAoOriginal = () => {
    const restaurado = restaurarOriginalWorkspace();
    setWorkspace(restaurado);
    setConfirmacao(null);
    if (restaurado) {
      void sincronizar(
        (u) => salvarWorkspaceNuvem(u, restaurado),
        "Texto original restaurado — o rastro recomeçou do zero (etapa Rascunho).",
      );
    } else {
      setStatus(null);
    }
  };

  const descartarTudo = () => {
    limparWorkspace();
    setWorkspace(null);
    setConfirmacao(null);
    void sincronizar(
      apagarWorkspaceNuvem,
      uid ? "Manuscrito, histórico e versões apagados." : "Manuscrito, histórico e versões apagados deste dispositivo.",
    );
  };

  const confirmar = () => {
    if (confirmacao === "limpar") limpar();
    else if (confirmacao === "voltarOriginal") voltarAoOriginal();
    else if (confirmacao === "descartar") descartarTudo();
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
          <button
            className="btn"
            type="button"
            disabled={!temOriginal}
            title={temOriginal ? "Restaura o texto original do arquivo enviado" : "Nenhum arquivo original carregado"}
            onClick={temOriginal ? () => setConfirmacao("voltarOriginal") : undefined}
          >
            Voltar ao original
          </button>
          <button
            className="btn historico-btn-perigo"
            type="button"
            disabled={!workspace}
            title={workspace ? "Apaga manuscrito, histórico e versões deste dispositivo" : "Nada para descartar"}
            onClick={workspace ? () => setConfirmacao("descartar") : undefined}
          >
            Descartar tudo
          </button>
          {!vazio && (
            <button className="btn historico-btn-perigo" type="button" onClick={() => setConfirmacao("limpar")}>
              Limpar histórico
            </button>
          )}
          <Link className="btn btn-primary" to="/revisar">
            Abrir o editor
          </Link>
        </div>
      </div>

      {confirmacao && (
        <div className="problema-confirmacao historico-confirmacao-panel" role="group" aria-label="Confirmar ação">
          <span>{PERGUNTA_CONFIRMACAO[confirmacao]}</span>
          <button className="btn btn-primary" type="button" onClick={confirmar}>
            Confirmar
          </button>
          <button className="btn" type="button" onClick={() => setConfirmacao(null)}>
            Cancelar
          </button>
        </div>
      )}

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
            Abra o editor, anexe ou cole seu manuscrito e clique em <strong>Analisar</strong>. Cada
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
                        title="Ir para o parágrafo no editor (fica destacado até você clicar nele)"
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

    </main>
  );
}
