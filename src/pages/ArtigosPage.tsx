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
  MOTIVO_LIMITE,
  porRecencia,
  removerArtigo,
  tituloDoArtigo,
  type Biblioteca,
} from "../workspace/artigos";
import { useAutorizacao } from "../firebase/auth";
import { apagarArtigoNuvem, salvarIndiceNuvem } from "../firebase/persistencia";

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
              <span className="recente-titulo" title={titulo}>
                {titulo}
              </span>
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
