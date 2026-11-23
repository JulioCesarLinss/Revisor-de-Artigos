import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROTULO_ORIGEM } from "../workspace/historico";
import {
  carregarWorkspace,
  contarPorOrigem,
  limparHistoricoWorkspace,
  restaurarOriginalWorkspace,
  type EstadoWorkspace,
} from "../workspace/armazenamento";
import { carregarBiblioteca, tituloDoArtigo } from "../workspace/artigos";
import { tituloDaRegra } from "../ui/rotulos";
import { useAutorizacao } from "../firebase/auth";
import { salvarArtigoNuvem } from "../firebase/persistencia";

/** Aviso quando a ação valeu no dispositivo mas a cópia da conta não acompanhou. */
const AVISO_NUVEM =
  "Não foi possível atualizar a cópia salva na sua conta. Verifique a conexão e repita a ação.";

type Filtro = "todas" | "manual" | "ia";

/** Ações que exigem confirmação dentro do app (especifica a pergunta). */
type Confirmacao = "limpar" | "voltarOriginal" | null;

const PERGUNTA_CONFIRMACAO: Record<Exclude<Confirmacao, null>, string> = {
  limpar: "Limpar o histórico de alterações? O manuscrito atual será mantido.",
  voltarOriginal: "Restaurar o texto original do arquivo? O histórico de alterações será apagado.",
};

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "manual", rotulo: "Correções automáticas" },
  { valor: "ia", rotulo: "Sugestões da IA" },
];

/** Troca o código da regra pelo título legível, sem esconder o rastro (H6). */
function descrever(descricao: string): string {
  return descricao.replace(/\(([A-Z]\d{3})\)/, (_, id: string) => `(${tituloDaRegra(id) ?? id})`);
}

/** Tela /historico — alterações com rastro (DC-13). */
export default function HistoricoPage() {
  const navegar = useNavigate();
  // Logado: as ações também atualizam a cópia do Firestore (senão o /revisar
  // traria de volta o que foi apagado aqui).
  const { uid } = useAutorizacao();
  const [workspace, setWorkspace] = useState<EstadoWorkspace | null>(() => carregarWorkspace());
  // O artigo aberto no editor: as ações daqui gravam nele, também na nuvem.
  const [ativoId] = useState(() => carregarBiblioteca().ativo);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [status, setStatus] = useState<string | null>(null);

  /** Confirmação em painel no app (sem pop-up do navegador). */
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);

  const contagem = contarPorOrigem(workspace?.historico ?? []);
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
    const mensagem = "Histórico limpo — o manuscrito atual foi mantido.";
    if (limpo) void sincronizar((u) => salvarArtigoNuvem(u, ativoId, limpo), mensagem);
    else setStatus(mensagem);
  };

  const temOriginal = !!workspace?.textoOriginal;

  const voltarAoOriginal = () => {
    const restaurado = restaurarOriginalWorkspace();
    setWorkspace(restaurado);
    setConfirmacao(null);
    if (restaurado) {
      void sincronizar(
        (u) => salvarArtigoNuvem(u, ativoId, restaurado),
        "Texto original restaurado — o rastro recomeçou do zero.",
      );
    } else {
      setStatus(null);
    }
  };

  const confirmar = () => {
    if (confirmacao === "limpar") limpar();
    else if (confirmacao === "voltarOriginal") voltarAoOriginal();
  };

  const vazio = !workspace || contagem.total === 0;

  return (
    <main className="historico-main" id="conteudo">
      <div className="historico-cabecalho">
        <div>
          <h2>
            Histórico de revisões
            {workspace && <span className="historico-artigo"> — {tituloDoArtigo(workspace)}</span>}
          </h2>
          <p>Correções feitas neste artigo: as aplicadas com um clique e as sugestões da IA que você aceitou.</p>
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
        {/* Só mensagens de ação: o total já aparece no primeiro cartão. */}
        {status ?? (workspace ? "" : "Nenhum dado salvo neste dispositivo.")}
      </p>

      {vazio ? (
        <div className="empty-card historico-vazio">
          <h3>Nenhuma revisão registrada ainda</h3>
          <p>
            Abra o editor, anexe ou cole seu manuscrito e clique em <strong>Analisar</strong>. Cada
            correção rápida e cada sugestão de IA aceita aparecerão aqui com rastro.
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
              <strong>{contagem.total}</strong>
              <span>Alterações</span>
            </div>
            <div className="historico-stat">
              <strong>{contagem.manual}</strong>
              <span>Correções automáticas</span>
            </div>
            <div className="historico-stat">
              <strong>{contagem.ia}</strong>
              <span>Sugestões da IA aceitas</span>
            </div>
          </div>

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
                {alteracoes.map((h) => (
                  <li key={h.id}>
                    <span className={`historico-origem origem-${h.origem}`}>{ROTULO_ORIGEM[h.origem]}</span>
                    <span className="historico-desc">
                      Parágrafo {h.paragrafo} — {descrever(h.descricao)}
                    </span>
                    <span className="historico-quando">{h.quando}</span>
                    <button
                      className="btn historico-localizar"
                      type="button"
                      onClick={() => localizar(h.paragrafo)}
                      title="Ir para o parágrafo no editor (fica destacado até você clicar nele)"
                    >
                      Localizar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

    </main>
  );
}
