import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ORIGEM = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const ENTRADA = process.env.E2E_JSON ?? ".resultados-e2e.json";
const SAIDA = "relatorio-testes-e2e.pdf";

const dados = JSON.parse(readFileSync(ENTRADA, "utf8"));

/** Percorre a árvore de suites e devolve os casos no formato plano. */
function coletar(suites, arquivo = "") {
  const casos = [];
  for (const suite of suites ?? []) {
    const nomeArquivo = suite.file ?? arquivo;
    for (const spec of suite.specs ?? []) {
      const teste = spec.tests?.[0];
      const resultado = teste?.results?.[0];
      const status = spec.ok ? "passed" : resultado?.status === "skipped" ? "skipped" : "failed";
      casos.push({
        arquivo: nomeArquivo,
        grupo: suite.title === nomeArquivo ? "" : suite.title,
        titulo: spec.title,
        status,
        duracao: resultado?.duration ?? 0,
        erro: resultado?.error?.message ?? "",
      });
    }
    casos.push(...coletar(suite.suites, nomeArquivo));
  }
  return casos;
}

const casos = coletar(dados.suites);
const passaram = casos.filter((c) => c.status === "passed").length;
const falharam = casos.filter((c) => c.status === "failed").length;
const total = casos.length;
const segundos = (ms) => `${(ms / 1000).toFixed(1)}s`;
const duracaoTotal = segundos(dados.stats.duration);
const inicio = new Date(dados.stats.startTime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

const arquivos = [...new Set(casos.map((c) => c.arquivo))];

const linhas = arquivos
  .map((arquivo) => {
    const doArquivo = casos.filter((c) => c.arquivo === arquivo);
    const corpo = doArquivo
      .map(
        (c) => `
        <tr>
          <td class="status ${c.status}">${c.status === "passed" ? "Passou" : c.status === "failed" ? "Falhou" : "Ignorado"}</td>
          <td>${c.grupo ? `<span class="grupo">${c.grupo}</span> ` : ""}${escapar(c.titulo)}</td>
          <td class="num">${segundos(c.duracao)}</td>
        </tr>`,
      )
      .join("");
    return `
      <section>
        <h2>${escapar(arquivo.replace(/^tests\//, ""))} <span class="contagem">${doArquivo.length} teste(s)</span></h2>
        <table>
          <thead><tr><th>Situação</th><th>Cenário</th><th class="num">Duração</th></tr></thead>
          <tbody>${corpo}</tbody>
        </table>
      </section>`;
  })
  .join("");

function escapar(texto) {
  return String(texto).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório dos testes E2E</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "DejaVu Sans", Arial, sans-serif; color: #1f2933; margin: 0; font-size: 11px; }
  header { border-bottom: 3px solid #2f5f80; padding-bottom: 14px; margin-bottom: 20px; }
  h1 { font-size: 22px; margin: 0 0 6px; color: #17394d; letter-spacing: -0.2px; }
  .sub { color: #5c6b78; font-size: 11px; }
  .meta { display: flex; gap: 26px; margin-top: 12px; }
  .meta div { font-size: 10px; color: #5c6b78; }
  .meta strong { display: block; font-size: 11px; color: #1f2933; font-weight: 600; margin-top: 2px; word-break: break-all; }
  .placar { display: flex; gap: 10px; margin-bottom: 22px; }
  .cartao { flex: 1; border: 1px solid #dbe3ea; border-radius: 6px; padding: 12px 14px; background: #f7fafc; }
  .cartao .valor { font-size: 24px; font-weight: 700; color: #17394d; line-height: 1.1; }
  .cartao .rotulo { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #5c6b78; margin-top: 4px; }
  .cartao.ok { background: #eef8f1; border-color: #bfe3cb; }
  .cartao.ok .valor { color: #1c7a44; }
  .cartao.ruim { background: #fdf1f1; border-color: #f0c8c8; }
  .cartao.ruim .valor { color: #b02a2a; }
  section { margin-bottom: 16px; break-inside: avoid; }
  h2 { font-size: 12.5px; color: #17394d; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e4ebf1; }
  .contagem { font-weight: 400; color: #7b8a97; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #7b8a97; padding: 4px 6px; border-bottom: 1px solid #e4ebf1; }
  td { padding: 5px 6px; border-bottom: 1px solid #f0f4f7; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; color: #5c6b78; }
  td.status { width: 62px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
  td.passed { color: #1c7a44; }
  td.failed { color: #b02a2a; }
  td.skipped { color: #8a6d1f; }
  .grupo { color: #2f5f80; font-weight: 600; }
  footer { margin-top: 18px; border-top: 1px solid #e4ebf1; padding-top: 10px; font-size: 9px; color: #7b8a97; }
</style></head>
<body>
  <header>
    <h1>Relatório de testes E2E — Playwright</h1>
    <div class="sub">Suíte automatizada executada contra o preview da aplicação.</div>
    <div class="meta">
      <div>Execução<strong>${inicio}</strong></div>
      <div>Ambiente<strong>${escapar(ORIGEM)}</strong></div>
      <div>Navegador<strong>Chromium (headless)</strong></div>
    </div>
  </header>

  <div class="placar">
    <div class="cartao ok"><div class="valor">${passaram}/${total}</div><div class="rotulo">Testes aprovados</div></div>
    <div class="cartao ${falharam ? "ruim" : ""}"><div class="valor">${falharam}</div><div class="rotulo">Falhas</div></div>
    <div class="cartao"><div class="valor">${arquivos.length}</div><div class="rotulo">Arquivos de teste</div></div>
    <div class="cartao"><div class="valor">${duracaoTotal}</div><div class="rotulo">Duração total</div></div>
  </div>

  ${linhas}

  <footer>
    Gerado a partir da saída JSON do Playwright (${ENTRADA}). Cada cenário abre a aplicação real, interage com a interface e valida o comportamento observado.
  </footer>
</body></html>`;

const navegador = await chromium.launch({ channel: "chromium" });
const pagina = await navegador.newPage();
await pagina.setContent(html, { waitUntil: "load" });

if (process.env.E2E_VERIFICAR === "1") {
  await pagina.setViewportSize({ width: 794, height: 1123 });
  await pagina.screenshot({ path: "test-results/relatorio-e2e.png", fullPage: true });
}
await pagina.pdf({
  path: SAIDA,
  format: "A4",
  printBackground: true,
  margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#8b98a4;padding:0 14mm;text-align:right;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
});
await navegador.close();

console.log(`PDF gerado: ${SAIDA} — ${passaram}/${total} aprovados, ${falharam} falha(s), ${duracaoTotal}`);
