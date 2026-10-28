import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  encaminhamento,
  gerarLaudo,
  laudoComoTexto,
  rotuloGeradoEm,
  type Laudo,
} from "../laudo/gerar";
import { ROTULO_ESTADO } from "../workspace/fluxo";
import { carregarWorkspace, type EstadoWorkspace } from "../workspace/armazenamento";

const ROTULO_SEVERIDADE = {
  critico: "Crítico",
  advertencia: "Advertência",
  observacao: "Observação",
} as const;

function corSeveridade(s: NonNullable<Laudo["maiorSeveridade"]>): string {
  return s === "critico" ? "var(--crimson)" : s === "advertencia" ? "var(--amber)" : "var(--cobalt-dark)";
}

/** Tela /laudo — apuração normativa do manuscrito salvo no dispositivo. */
export default function LaudoPage() {
  const navegar = useNavigate();
  const [copiado, setCopiado] = useState<"sim" | "nao" | null>(null);

  /** O laudo apura o manuscrito persistido (mesma fonte de /revisar e /historico). */
  const workspace = useMemo<EstadoWorkspace | null>(() => carregarWorkspace(), []);
  const laudo = useMemo<Laudo | null>(() => {
    if (!workspace || workspace.bruto.trim().length === 0) return null;
    try {
      return gerarLaudo(workspace.bruto, workspace.estadoFluxo);
    } catch {
      return null; // dado corrompido nunca quebra a tela (H9)
    }
  }, [workspace]);

  const texto = useMemo(() => (laudo ? laudoComoTexto(laudo) : ""), [laudo]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado("sim");
    } catch {
      setCopiado("nao");
    }
    setTimeout(() => setCopiado(null), 2500);
  };

  const imprimir = () => window.print();

  if (!laudo) {
    return (
      <main className="laudo-main" id="conteudo">
        <div className="laudo-cabecalho">
          <div>
            <h2>Laudo ABNT</h2>
            <p>Apuração normativa do manuscrito salvo neste dispositivo — resumo, seções e encaminhamento.</p>
          </div>
        </div>
        <div className="empty-card laudo-vazio">
          <h3>Nenhum manuscrito para apurar</h3>
          <p>
            Abra o editor, cole ou anexe seu texto e clique em <strong>Analisar</strong>. O laudo sempre reflete o
            manuscrito salvo.
          </p>
          <Link className="btn btn-primary" to="/revisar">
            Ir para Revisar →
          </Link>
        </div>
      </main>
    );
  }

  const enc = encaminhamento(laudo);
  const r = laudo.resumo;

  return (
    <main className="laudo-main" id="conteudo">
      <div className="laudo-cabecalho">
        <div>
          <h2>Laudo ABNT</h2>
          <p>
            Apuração normativa do manuscrito • etapa {ROTULO_ESTADO[laudo.estadoFluxo]} do fluxo •{" "}
            {laudo.metricas.paragrafos} parágrafo(s) · {laudo.metricas.palavras} palavra(s)
          </p>
        </div>
        <div className="laudo-acoes">
          <button className="btn" type="button" onClick={copiar} title="Copia o laudo em formato de relatório de texto">
            {copiado === null ? "Copiar laudo" : copiado === "sim" ? "✓ Copiado" : "Sem autorização do navegador"}
          </button>
          <button className="btn" type="button" onClick={imprimir} title="Abre a janela de impressão / salvar em PDF">
            Imprimir / PDF
          </button>
          <button className="btn btn-primary" type="button" onClick={() => navegar("/revisar")} title="Volta ao editor para corrigir e reanalisar">
            Abrir no editor
          </button>
        </div>
      </div>

      <div className="laudo-folha">
        <header className="laudo-folha-topo">
          <span className="laudo-selo">NormaReview AI</span>
          <span className="laudo-folha-num">Doc. NR-2026-{laudo.geradoEm.getMonth() + 1}{laudo.geradoEm.getDate().toString().padStart(2, "0")}</span>
        </header>

        <div className={`laudo-veredito laudo-veredito-${laudo.maiorSeveridade ?? "conforme"}`}>
          <span className="laudo-veredito-chip">{enc.titulo}</span>
          <p>{enc.texto}</p>
        </div>

        <section className="laudo-bloco" aria-label="Resumo por severidade">
          <h3>Resumo por severidade</h3>
          <div className="laudo-stats">
            <div className="laudo-stat total">
              <strong>{r.total}</strong>
              <span>Total</span>
            </div>
            <div className="laudo-stat critico">
              <strong>{r.criticos}</strong>
              <span>Críticos</span>
            </div>
            <div className="laudo-stat advertencia">
              <strong>{r.advertencias}</strong>
              <span>Advertências</span>
            </div>
            <div className="laudo-stat observacao">
              <strong>{r.observacoes}</strong>
              <span>Observações</span>
            </div>
          </div>
        </section>

        <section className="laudo-bloco" aria-label="Métricas do documento">
          <h3>Métricas do documento</h3>
          <ul className="laudo-metricas">
            <li><strong>{laudo.metricas.paragrafos}</strong> parágrafo(s)</li>
            <li><strong>{laudo.metricas.palavras}</strong> palavra(s)</li>
            <li><strong>{laudo.metricas.caracteres}</strong> caractere(s)</li>
            <li><strong>{ROTULO_ESTADO[laudo.estadoFluxo]}</strong> — etapa do fluxo</li>
          </ul>
        </section>

        <section className="laudo-bloco" aria-label="Conformidade por seção">
          <h3>Conformidade por seção</h3>
          <table className="laudo-tabela">
            <thead>
              <tr>
                <th scope="col">Seção</th>
                <th scope="col" className="num">¶</th>
                <th scope="col" className="num">Prob.</th>
                <th scope="col" className="num">Crít.</th>
                <th scope="col" className="num">Advert.</th>
                <th scope="col" className="num">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {laudo.secoes.length === 0 ? (
                <tr>
                  <td colSpan={6}>Sem seções detectadas no manuscrito.</td>
                </tr>
              ) : (
                laudo.secoes.map((s) => (
                  <tr key={s.secao}>
                    <th scope="row">{s.secao}</th>
                    <td className="num">{s.totalParagrafos}</td>
                    <td className="num">{s.problemas}</td>
                    <td className="num">{s.criticos}</td>
                    <td className="num">{s.advertencias}</td>
                    <td className="num">{s.observacoes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="laudo-bloco" aria-label="Achados por parágrafo">
          <h3>Achados por parágrafo</h3>
          {laudo.achados.length === 0 ? (
            <p className="laudo-nota">Nenhum problema por parágrafo — o documento passou pelas verificações do catálogo.</p>
          ) : (
            <ol className="laudo-achados">
              {laudo.achados.map((p) => (
                <li key={p.id}>
                  <span className={`badge-sev ${p.severidade}`}>{ROTULO_SEVERIDADE[p.severidade]}</span>
                  <span className="laudo-achado-regra">
                    ¶{p.paragrafo} — {p.mensagem}
                  </span>
                  <span className="laudo-achado-ref">Ref.: {p.referencia}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="laudo-folha-rodape">
          <span>
            Emissão: {rotuloGeradoEm(laudo.geradoEm)} · Etapa: {ROTULO_ESTADO[laudo.estadoFluxo]}
          </span>
          <span className="laudo-veredito-cor" style={{ background: corSeveridade(laudo.maiorSeveridade ?? "observacao") }} />
        </footer>
      </div>

    </main>
  );
}
