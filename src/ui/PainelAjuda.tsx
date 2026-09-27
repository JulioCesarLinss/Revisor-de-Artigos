import { useEffect } from "react";

interface Props {
  onFechar: () => void;
}

/** Documenta o que cada severidade pede do autor (mesma classificação do motor). */
const SEVERIDADES = [
  {
    cor: "var(--crimson)",
    nome: "Crítico",
    texto: "violação clara da norma (ex.: citação longa sem página). Corrija antes de entregar.",
  },
  {
    cor: "var(--amber)",
    nome: "Advertência",
    texto: "provável desvio (ex.: parágrafo muito longo). Avalie e corrija quando fizer sentido.",
  },
  {
    cor: "var(--cobalt-dark)",
    nome: "Observação",
    texto: "ponto de atenção menor (ex.: espaço duplo). Revisão fina, sem urgência.",
  },
];

/**
 * Heurística 10 (Nielsen) — ajuda e documentação: centro de ajuda com guia de
 * uso por tarefa, atalhos de teclado, significado das severidades, o papel da
 * IA e as normas de referência — sempre acessível pelo botão "Ajuda" do
 * cabeçalho, em vez de exigir memorização ou treino.
 */
export function PainelAjuda({ onFechar }: Props) {
  useEffect(() => {
    const sair = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [onFechar]);

  return (
    <div className="ajuda-overlay" onClick={onFechar}>
      <section
        className="ajuda-painel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ajuda-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ajuda-cabecalho">
          <h2 id="ajuda-titulo">Como usar o NormaReview AI</h2>
          <button className="btn" type="button" onClick={onFechar} title="Fechar a ajuda (Esc)">
            Fechar
          </button>
        </div>

        <div className="ajuda-corpo">
          <div className="ajuda-secao">
            <h3>Fluxo de revisão</h3>
            <ol>
              <li>
                <strong>Cole o manuscrito</strong> no canvas central (parágrafos separados por linha em branco;
                títulos em CAIXA-ALTA criam seções no relatório).
              </li>
              <li>
                <strong>Clique em Analisar</strong> (ou use <kbd className="atalho-tecla">Ctrl+↵</kbd>) para verificar o texto contra o catálogo de regras.
              </li>
              <li>
                <strong>Corrija os problemas</strong>: "Aplicar correção" resolve automaticamente; "Localizar no
                manuscrito" leva ao trecho para edição manual.
              </li>
              <li>
                <strong>Avance no fluxo</strong> (Rascunho → Revisão → Final) para registrar versões e comparar
                lado a lado; o histórico registra cada alteração.
              </li>
            </ol>
          </div>

          <div className="ajuda-secao">
            <h3>Atalhos de teclado</h3>
            <ul className="ajuda-lista-atalhos">
              <li>
                <kbd className="atalho-tecla">Ctrl+↵</kbd> analisar o manuscrito
              </li>
              <li>
                <kbd className="atalho-tecla">Ctrl+Shift+↵</kbd> avançar etapa do fluxo
              </li>
              <li>
                <kbd className="atalho-tecla">Esc</kbd> sair do modo revisar / fechar painéis
              </li>
            </ul>
          </div>

          <div className="ajuda-secao">
            <h3>O que significa cada severidade</h3>
            <ul className="ajuda-lista-sev">
              {SEVERIDADES.map((s) => (
                <li key={s.nome}>
                  <span className="secao-dot" style={{ background: s.cor }} role="img" aria-label={s.nome} />
                  <strong>{s.nome}</strong> — {s.texto}
                </li>
              ))}
            </ul>
          </div>

          <div className="ajuda-secao">
            <h3>O papel da IA</h3>
            <p>
              O assistente IA é <strong>opcional</strong> (chave da API no painel à direita) e funciona apenas como{" "}
              <em>assistência</em>: sugere reescritas que você aceita, edita ou ignora. A decisão normativa
              permanece com o catálogo de regras e com você — o app funciona integralmente sem IA.
            </p>
          </div>

          <div className="ajuda-secao">
            <h3>Normas de referência</h3>
            <ul>
              <li>NBR 14724 — formatação de trabalhos acadêmicos</li>
              <li>NBR 10520 — citações em documentos</li>
              <li>NBR 6023 — referências bibliográficas</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
