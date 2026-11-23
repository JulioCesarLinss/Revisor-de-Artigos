import { useEffect } from "react";

interface Props {
  onFechar: () => void;
}

/**
 * Níveis de aviso exibidos no resumo da análise, com exemplos do catálogo de
 * regras (src/rules/catalogo.ts). "Crítico" hoje só recebe os apontamentos
 * de gravidade alta do diagnóstico com Gemini; nenhuma regra o utiliza.
 */
const SEVERIDADES = [
  {
    cor: "var(--crimson)",
    nome: "Crítico",
    texto:
      "apontamento de gravidade alta do diagnóstico com Gemini, como seção essencial ausente ou contradição nos dados. As regras normativas não utilizam este nível atualmente.",
  },
  {
    cor: "var(--amber)",
    nome: "Advertência",
    texto:
      "provável não conformidade com a norma: aspas não fechadas, citação sem vírgula antes do ano, referência sem ano. Recomenda-se a correção.",
  },
  {
    cor: "var(--cobalt-dark)",
    nome: "Observação",
    texto:
      "ajuste de acabamento: espaço duplo, espaço antes da pontuação, parágrafo extenso, citação longa sem indicação de página.",
  },
];

/**
 * Heurística 10 (Nielsen) — ajuda e documentação: guia de utilização com o
 * fluxo de revisão, edição, artigos, classificação dos avisos, recursos de IA,
 * histórico, atalhos e normas de referência — sempre acessível pelo botão
 * "Ajuda" do cabeçalho, em vez de exigir memorização ou treino.
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
          <h2 id="ajuda-titulo">Guia de utilização do NormaReview AI</h2>
          <button className="btn" type="button" onClick={onFechar} title="Fechar a ajuda (Esc)">
            Fechar
          </button>
        </div>

        <div className="ajuda-corpo">
          <div className="ajuda-secao">
            <h3>Fluxo de revisão</h3>
            <ol>
              <li>
                <strong>Inserção do manuscrito</strong>: digite, cole ou importe o texto pelo botão{" "}
                <strong>Anexar</strong> (formatos .docx, .txt e .md). Títulos em caixa-alta, como INTRODUÇÃO,
                delimitam as seções do documento.
              </li>
              <li>
                <strong>Análise normativa</strong>: o botão <strong>Analisar</strong> (
                <kbd className="atalho-tecla">Ctrl+↵</kbd>) aplica o catálogo de regras e lista os avisos no painel
                lateral. A partir da primeira análise, os avisos são reavaliados automaticamente a cada alteração do
                texto.
              </li>
              <li>
                <strong>Localização</strong>: <strong>Localizar no manuscrito</strong> destaca em amarelo as
                ocorrências do parágrafo. Cada destaque é removido individualmente ao ser clicado ou editado.
              </li>
              <li>
                <strong>Correção</strong>: diretamente no editor ou por <strong>Aplicar correção</strong>, quando a
                regra dispõe de correção automática. O aviso resolvido sai da lista e é registrado no Histórico.
              </li>
              <li>
                <strong>Exportação</strong>: <strong>Baixar .docx</strong> gera um documento Word em formato A4, com
                Times New Roman 12, entrelinha 1,5 e margens de 3 cm (superior e esquerda) e 2 cm (inferior e
                direita); <strong>Copiar texto</strong> transfere o conteúdo para a área de transferência.
              </li>
            </ol>
          </div>

          <div className="ajuda-secao">
            <h3>Edição do texto</h3>
            <ul>
              <li>
                <kbd className="atalho-tecla">Enter</kbd> insere uma quebra de linha; dois{" "}
                <kbd className="atalho-tecla">Enter</kbd> consecutivos (linha em branco) iniciam um novo parágrafo.
                Esse é o critério usado pela análise para numerar os parágrafos.
              </li>
              <li>
                <strong>N</strong>, <strong>I</strong> e <strong>S</strong> aplicam negrito, itálico e sublinhado ao
                trecho selecionado ou, sem seleção, ao texto digitado em seguida. A formatação é preservada na
                exportação para .docx.
              </li>
              <li>
                <strong>Desfazer</strong> reverte a última alteração de texto ou de formatação.
              </li>
            </ul>
          </div>

          <div className="ajuda-secao">
            <h3>Gerenciamento de artigos</h3>
            <p>
              A aba <strong>Artigos</strong> comporta até três manuscritos. Cada artigo pode ser aberto, renomeado
              (ícone de lápis) ou excluído (×); a folha com o sinal + cria um novo artigo. O conteúdo é salvo
              automaticamente no dispositivo e, com a conta conectada, também na nuvem.
            </p>
          </div>

          <div className="ajuda-secao">
            <h3>Classificação dos avisos</h3>
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
            <h3>Recursos de inteligência artificial (opcionais)</h3>
            <ul>
              <li>
                <strong>Diagnóstico com Gemini</strong>: avalia o manuscrito como artigo científico — estrutura,
                completude, coerência e linguagem — e emite uma avaliação geral. Apontamentos de linguagem são
                removidos quando o trecho é corrigido; apontamentos sobre o artigo permanecem até a verificação por{" "}
                <strong>Conferir</strong> ou a marcação manual por <strong>Já resolvi</strong>.
              </li>
              <li>
                <strong>Assistente de IA</strong>: utiliza uma chave de API própria, informada na aba{" "}
                <strong>Perfil</strong>, como alternativa à IA da plataforma. Com chave do Gemini, o botão{" "}
                <strong>Gerar análise com IA</strong> produz a mesma análise do diagnóstico, com os mesmos recursos de
                acompanhamento; com chave do Gemini ou da OpenAI, o botão <strong>Sugerir com IA</strong> de cada
                aviso propõe uma reescrita do parágrafo. A chave permanece apenas na sessão do navegador e é
                descartada ao fechar a aba ou sair da conta. Quando as duas análises existem, o resumo considera
                apenas a mais recente.
              </li>
              <li>
                Os recursos de IA têm caráter consultivo: a conformidade normativa é determinada pelo motor de regras
                e pela revisão do autor. A ferramenta funciona integralmente sem eles.
              </li>
            </ul>
          </div>

          <div className="ajuda-secao">
            <h3>Histórico de revisões</h3>
            <p>
              Registra as alterações do artigo aberto, classificadas como correção automática, correção manual ou
              sugestão da IA aceita. <strong>Limpar histórico</strong> apaga apenas os registros, mantendo o texto;{" "}
              <strong>Voltar ao original</strong> restaura o texto do arquivo importado e reinicia o histórico.
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
            <h3>Normas de referência</h3>
            <ul>
              <li>ABNT NBR 14724 — Trabalhos acadêmicos: apresentação</li>
              <li>ABNT NBR 10520 — Citações em documentos: apresentação</li>
              <li>ABNT NBR 6023 — Referências: elaboração</li>
              <li>ABNT NBR 6022 — Artigo em publicação periódica científica (base do diagnóstico com Gemini)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
