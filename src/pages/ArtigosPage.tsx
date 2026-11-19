import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { carregarWorkspace } from "../workspace/armazenamento";
import {
  abrirArtigo,
  artigoAtivo,
  ativarNoDispositivo,
  carregarBiblioteca,
  criarArtigo,
  estaVazio,
  LIMITE_ARTIGOS,
  LIMITE_NOME,
  MOTIVO_LIMITE,
  porRecencia,
  removerArtigo,
  renomearArtigo,
  tituloDoArtigo,
  type Biblioteca,
} from "../workspace/artigos";
import { useAutorizacao } from "../firebase/auth";
import { apagarArtigoNuvem, salvarArtigoNuvem, salvarIndiceNuvem } from "../firebase/persistencia";

/** Aviso quando a ação valeu no dispositivo mas a cópia da conta não acompanhou. */
const AVISO_NUVEM =
  "Não foi possível atualizar a cópia salva na sua conta. Verifique a conexão e repita a ação.";

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Quantos caracteres do começo do texto cabem na miniatura da folha. */
const TRECHO_MINIATURA = 700;

/**
 * Tela /artigos — os artigos guardados como no "Recentes" do Word: cada um é
 * uma folha em miniatura com o começo do texto e, embaixo, o título. A
 * primeira folha, em branco, cria um artigo novo.
 */
export default function ArtigosPage() {
  const navegar = useNavigate();
  const { uid } = useAutorizacao();
  const [biblioteca, setBiblioteca] = useState<Biblioteca>(() => carregarBiblioteca());
  const [status, setStatus] = useState<string | null>(null);
  /** Artigo à espera da confirmação de exclusão (confirmação no app, sem pop-up). */
  const [excluindo, setExcluindo] = useState<{ id: string; titulo: string } | null>(null);
  /** Artigo com o nome em edição (o lápis troca o título por um campo). */
  const [renomeando, setRenomeando] = useState<{ id: string; valor: string } | null>(null);

  const cheia = biblioteca.artigos.length >= LIMITE_ARTIGOS;

  /** Grava a lista (dispositivo e nuvem) com o artigo escolhido aberto e vai para o editor. */
  const abrirNoEditor = (b: Biblioteca) => {
    ativarNoDispositivo(b);
    if (uid) void salvarIndiceNuvem(uid, b);
    navegar("/revisar");
  };

  const abrir = (id: string) => abrirNoEditor(abrirArtigo(carregarBiblioteca(), id));

  /** Folha em branco: um artigo novo; se o aberto ainda está vazio, usa ele mesmo. */
  const novo = () => {
    const atual = carregarBiblioteca();
    if (estaVazio(artigoAtivo(atual).estado)) return abrirNoEditor(atual);
    const b = criarArtigo(atual);
    if (!b) {
      setStatus(MOTIVO_LIMITE);
      return;
    }
    abrirNoEditor(b);
  };

  const excluir = async (id: string, titulo: string) => {
    const b = removerArtigo(carregarBiblioteca(), id);
    ativarNoDispositivo(b);
    setBiblioteca(b);
    setExcluindo(null);
    const mensagem = `Artigo "${titulo}" excluído.`;
    setStatus(mensagem);
    if (!uid) return;
    const ok = (await apagarArtigoNuvem(uid, id)) && (await salvarIndiceNuvem(uid, b));
    if (!ok) setStatus(`${mensagem} ${AVISO_NUVEM}`);
  };

  /** Grava o nome digitado; vazio volta ao nome automático. */
  const salvarNome = async () => {
    if (!renomeando) return;
    const b = renomearArtigo(carregarBiblioteca(), renomeando.id, renomeando.valor);
    ativarNoDispositivo(b);
    setBiblioteca(b);
    setRenomeando(null);
    const artigo = b.artigos.find((a) => a.id === renomeando.id);
    if (!artigo) return;
    const mensagem = artigo.estado.nome
      ? `Artigo renomeado para "${artigo.estado.nome}".`
      : `Nome removido — o artigo voltou a se chamar "${tituloDoArtigo(artigo.estado)}".`;
    setStatus(mensagem);
    if (uid && !(await salvarArtigoNuvem(uid, artigo.id, artigo.estado))) setStatus(`${mensagem} ${AVISO_NUVEM}`);
  };

  // O aberto no editor pode ter mudado depois da última troca: a cópia do editor vale.
  const aberto = carregarWorkspace();

  return (
    <main className="artigos-main" id="conteudo">
      <div className="artigos-cabecalho">
        <h2>Artigos</h2>
        <p>
          Até {LIMITE_ARTIGOS} artigos guardados — clique em um para abrir no editor.{" "}
          <span className="artigos-contagem">
            {biblioteca.artigos.length} de {LIMITE_ARTIGOS}
          </span>
        </p>
      </div>

      {excluindo && (
        <div className="problema-confirmacao historico-confirmacao-panel" role="group" aria-label="Confirmar ação">
          <span>Excluir o artigo "{excluindo.titulo}"? O texto e o histórico dele serão apagados.</span>
          <button className="btn btn-primary" type="button" onClick={() => void excluir(excluindo.id, excluindo.titulo)}>
            Confirmar
          </button>
          <button className="btn" type="button" onClick={() => setExcluindo(null)}>
            Cancelar
          </button>
        </div>
      )}

      {status && (
        <p className="status-sistema" role="status" aria-live="polite">
          {status}
        </p>
      )}

      <ul className="folhas-recentes" aria-label="Meus artigos">
        <li className="recente">
          <button
            type="button"
            className="recente-folha recente-folha-nova"
            onClick={novo}
            aria-label="Novo artigo"
            aria-disabled={cheia || undefined}
            title={cheia ? MOTIVO_LIMITE : "Começa um artigo em branco; os outros continuam salvos"}
          >
            <span className="recente-mais" aria-hidden="true">
              +
            </span>
          </button>
          <span className="recente-titulo">Novo artigo</span>
          <span className="recente-data">{cheia ? "Limite de 3 atingido" : "Página em branco"}</span>
        </li>

        {porRecencia(biblioteca).map((a) => {
          const ehAberto = a.id === biblioteca.ativo;
          const estado = ehAberto && aberto ? aberto : a.estado;
          const titulo = tituloDoArtigo(estado);
          return (
            <li key={a.id} className={ehAberto ? "recente aberto" : "recente"}>
              <button
                type="button"
                className="recente-folha"
                onClick={() => abrir(a.id)}
                aria-label={`Abrir o artigo ${titulo}`}
              >
                <span className="recente-texto" aria-hidden="true">
                  {estaVazio(estado) ? "" : estado.bruto.slice(0, TRECHO_MINIATURA)}
                </span>
                {ehAberto && <span className="recente-chip">Aberto</span>}
              </button>
              <button
                type="button"
                className="recente-excluir"
                aria-label={`Excluir o artigo ${titulo}`}
                title="Excluir este artigo"
                onClick={() => setExcluindo({ id: a.id, titulo })}
              >
                ×
              </button>
              {renomeando?.id === a.id ? (
                <input
                  className="recente-nome-campo"
                  aria-label={`Novo nome do artigo ${titulo}`}
                  value={renomeando.valor}
                  maxLength={LIMITE_NOME}
                  placeholder="Nome automático"
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setRenomeando({ id: a.id, valor: e.target.value })}
                  onKeyDown={(e) => {
                    // Enter salva pelo blur (uma gravação só); Esc marca o campo para não salvar.
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.currentTarget.dataset.cancelado = "1";
                      setRenomeando(null);
                    }
                  }}
                  onBlur={(e) => {
                    if (e.currentTarget.dataset.cancelado) return;
                    void salvarNome();
                  }}
                />
              ) : (
                <span className="recente-nome">
                  <span className="recente-titulo" title={titulo}>
                    {titulo}
                  </span>
                  <button
                    type="button"
                    className="recente-renomear"
                    aria-label={`Renomear o artigo ${titulo}`}
                    title="Renomear (deixe vazio para voltar ao nome automático)"
                    onClick={() => setRenomeando({ id: a.id, valor: estado.nome ?? titulo })}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                    </svg>
                  </button>
                </span>
              )}
              <span className="recente-data">
                {a.atualizadoEm > 0 ? DATA_HORA.format(a.atualizadoEm) : "Sem data"}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
