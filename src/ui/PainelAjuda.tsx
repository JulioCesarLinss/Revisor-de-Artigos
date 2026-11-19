import { useEffect } from "react";

interface Props {
  onFechar: () => void;
}

/**
 * O que cada nível de aviso pede do autor, com exemplos tirados do catálogo
 * de regras (src/rules/catalogo.ts). Nenhuma regra usa "Crítico" hoje: o
 * nível só volta a aparecer aqui quando alguma regra passar a usá-lo.
 */
const SEVERIDADES = [
  {
    cor: "var(--amber)",
    nome: "Advertência",
    texto: "provável erro de norma — aspas sem fechar, citação sem vírgula antes do ano, referência sem ano. Vale corrigir.",
  },
  {
    cor: "var(--cobalt-dark)",
    nome: "Observação",
    texto: "ajuste de acabamento — espaço duplo, espaço antes da vírgula, parágrafo longo, citação longa sem página. Revise quando puder.",
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
            <h3>Como revisar, passo a passo</h3>
            <ol>
              <li>
                <strong>Coloque o texto</strong>: cole, digite ou clique em <strong>Anexar</strong> (.docx, .txt ou
                .md). Títulos em CAIXA-ALTA, como INTRODUÇÃO, dividem o texto em seções.
              </li>
              <li>
                <strong>Clique em Analisar</strong> (<kbd className="atalho-tecla">Ctrl+↵</kbd>). Os avisos aparecem
                à direita e, a partir daí, se atualizam sozinhos enquanto você corrige.
              </li>
              <li>
                <strong>Localizar no manuscrito</strong> marca em amarelo cada erro do parágrafo. Ao clicar numa
                marca ou corrigir aquele trecho, só ela some; as outras continuam.
              </li>
              <li>
                <strong>Corrija</strong> à mão ou com <strong>Aplicar correção</strong>, quando o aviso oferecer.
                O aviso resolvido sai da lista.
              </li>
              <li>
                <strong>Exporte</strong>: <strong>Baixar .docx</strong> gera um Word com formatação ABNT básica
                (Times New Roman 12, espaçamento 1,5, margens de 3 e 2 cm); <strong>Copiar texto</strong> leva o
                texto para colar onde quiser.
              </li>
            </ol>
          </div>

          <div className="ajuda-secao">
            <h3>Editando o texto</h3>
            <ul>
              <li>
                <kbd className="atalho-tecla">Enter</kbd> desce uma linha; dois <kbd className="atalho-tecla">Enter</kbd>{" "}
                começam um parágrafo novo.
              </li>
              <li>
                <strong>N</strong>, <strong>I</strong> e <strong>S</strong> (negrito, itálico e sublinhado): selecione
                o trecho e clique, ou ligue o botão antes de digitar. A formatação vai junto para o .docx.
              </li>
              <li>
                <strong>Desfazer</strong> volta a última alteração, inclusive de formatação.
              </li>
            </ul>
          </div>

          <div className="ajuda-secao">
            <h3>Seus artigos</h3>
            <p>
              Na aba <strong>Artigos</strong> ficam até 3 artigos, cada um como uma folha. Clique na folha para abrir,
              no lápis para renomear e no × para excluir. A folha com + começa um artigo novo. Tudo é salvo
              sozinho, enquanto você escreve.
            </p>
          </div>

          <div className="ajuda-secao">
            <h3>O que significa cada aviso</h3>
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
            <h3>Inteligência artificial (opcional)</h3>
            <p>
              <strong>Diagnóstico com Gemini</strong>: com a conta conectada, envia o texto ao Google e traz
              sugestões de clareza, coerência e escrita. <strong>Assistente com a sua chave</strong>: informe uma
              chave da OpenAI (ou compatível) no painel à direita ou no Perfil para ver o botão{" "}
              <strong>Sugerir com IA</strong> nos avisos. A IA só sugere — quem decide o que segue a norma são as
              regras ABNT e você. O app funciona por completo sem ela.
            </p>
          </div>

          <div className="ajuda-secao">
            <h3>Atalhos de teclado</h3>
            <ul className="ajuda-lista-atalhos">
              <li>
                <kbd className="atalho-tecla">Ctrl+↵</kbd> analisar o texto
              </li>
              <li>
                <kbd className="atalho-tecla">Ctrl+B</kbd> <kbd className="atalho-tecla">Ctrl+I</kbd>{" "}
                <kbd className="atalho-tecla">Ctrl+U</kbd> negrito, itálico e sublinhado
              </li>
              <li>
                <kbd className="atalho-tecla">Esc</kbd> fechar esta ajuda
              </li>
            </ul>
          </div>

          <div className="ajuda-secao">
            <h3>Normas usadas</h3>
            <ul>
              <li>NBR 14724 — apresentação de trabalhos acadêmicos</li>
              <li>NBR 10520 — citações</li>
              <li>NBR 6023 — referências</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
