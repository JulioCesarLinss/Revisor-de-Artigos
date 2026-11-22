import { expect, test } from "@playwright/test";
import { analisarTexto, cartaoDaRegra, editorDeTexto, entrar, TEXTO_EXEMPLO } from "./support/apoio";

/**
 * Editor de revisão — entrada do manuscrito, análise pelas regras
 * normativas, resumo, localização do trecho, correção com confirmação,
 * formatação e menu de exportação.
 */
test.describe("Revisão", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("com o editor vazio, analisar e exportar ficam bloqueados", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Analisar" })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Exportar/ })).toBeDisabled();
    await expect(page.getByText("0 parágrafos")).toBeVisible();
  });

  test("analisar lista os problemas e preenche o resumo", async ({ page }) => {
    const problemas = await analisarTexto(page);
    expect(problemas).toBe(3);

    // Sem Gemini, o total do resumo é exatamente o número de cartões exibidos.
    await expect(page.locator(".resumo-item.total strong")).toHaveText(String(problemas));
    await expect(cartaoDaRegra(page, "Espaço em excesso antes da pontuação")).toBeVisible();
    await expect(cartaoDaRegra(page, "Aspas desbalanceadas")).toBeVisible();
    await expect(cartaoDaRegra(page, "Espaço duplo entre palavras")).toBeVisible();
    await expect(page.locator(".avisos-restantes")).toContainText("avisos restantes");

    // O resumo é um quadro só, sem divisão por origem nem legenda.
    await expect(page.locator(".resumo-card").first()).not.toContainText("Regras normativas");
    await expect(page.locator(".resumo-card").first()).not.toContainText("¶ = parágrafo");
    // O histórico de alterações não aparece mais na tela de revisão (fica na aba Histórico).
    await expect(page.getByRole("heading", { name: "Histórico de alterações" })).toHaveCount(0);
  });

  test("com diagnóstico do Gemini, o total soma regras e Gemini; localizar funciona depois de editar", async ({ page }) => {
    // Diagnóstico salvo (como após um pedido real), feito sobre uma versão anterior do texto.
    const textoAntigo = "INTRODUCAO\n\nOs dados foi coletados em campo ontem.\n\nOutro paragrafo sem erro nenhum aqui.";
    const textoAtual = `${textoAntigo}\n\nParagrafo novo escrito depois do diagnostico.`;
    await page.evaluate(
      ([bruto, diagnosticado]) => {
        localStorage.setItem(
          "normareview.workspace",
          JSON.stringify({
            bruto,
            textoOriginal: null,
            historico: [],
            textoDiagnosticado: diagnosticado,
            diagnostico: {
              ok: true,
              resumo: "Um ponto de concordância.",
              truncado: false,
              diagnosticos: [
                { paragrafo: 2, trecho: "dados foi coletados", categoria: "Gramática", descricao: "Concordância.", sugestao: "os dados foram", severidade: "alta" },
              ],
            },
          }),
        );
      },
      [textoAtual, textoAntigo],
    );
    await page.goto("/revisar");

    // Regras: 0 avisos neste texto; Gemini: 1 apontamento de severidade alta → entra em Críticos.
    await expect(page.locator(".resumo-item.total strong")).toHaveText("1");
    await expect(page.locator(".resumo-item.critico strong")).toHaveText("1");

    // O texto mudou depois do diagnóstico: sem aviso laranja, e o Localizar continua disponível.
    await expect(page.getByText("O texto mudou depois deste diagnóstico")).toHaveCount(0);
    await page.locator(".gemini-item").getByRole("button", { name: "Localizar no manuscrito" }).click();
    await expect(page.locator("mark.folha-destaque")).toHaveText("dados foi coletados");
  });

  test("localizar destaca o trecho no manuscrito", async ({ page }) => {
    await analisarTexto(page);
    await cartaoDaRegra(page, "Aspas desbalanceadas")
      .getByRole("button", { name: "Localizar no manuscrito" })
      .click();

    await expect(page.locator("mark.folha-destaque").first()).toBeVisible();
  });

  test("corrigir um problema pede confirmação e reduz os avisos", async ({ page }) => {
    const antes = await analisarTexto(page);
    const cartao = cartaoDaRegra(page, "Espaço em excesso antes da pontuação");

    await cartao.getByRole("button", { name: "Aplicar correção" }).click();
    const confirmacao = page.getByRole("group", { name: /Confirmar correção em Parágrafo 1/ });
    await expect(confirmacao).toBeVisible();

    await confirmacao.getByRole("button", { name: "Confirmar" }).click();

    // O espaço antes da pontuação sai do texto e o aviso correspondente some.
    await expect(editorDeTexto(page)).not.toHaveValue(/editorial \./);
    await expect(cartaoDaRegra(page, "Espaço em excesso antes da pontuação")).toHaveCount(0);
    await expect(page.locator(".problema-card")).toHaveCount(antes - 1);
  });

  test("cancelar a correção mantém o texto intacto", async ({ page }) => {
    await analisarTexto(page);
    const cartao = cartaoDaRegra(page, "Espaço em excesso antes da pontuação");

    await cartao.getByRole("button", { name: "Aplicar correção" }).click();
    await cartao.getByRole("button", { name: "Cancelar" }).click();

    await expect(editorDeTexto(page)).toHaveValue(TEXTO_EXEMPLO);
    await expect(page.locator(".problema-card")).toHaveCount(3);
  });

  test("formatação alterna negrito/itálico/sublinhado", async ({ page }) => {
    const negrito = page.getByRole("button", { name: "Negrito" });
    await expect(negrito).toHaveAttribute("aria-pressed", "false");
    await negrito.click();
    await expect(negrito).toHaveAttribute("aria-pressed", "true");
    await negrito.click();
    await expect(negrito).toHaveAttribute("aria-pressed", "false");

    const italico = page.getByRole("button", { name: "Itálico" });
    await italico.click();
    await expect(italico).toHaveAttribute("aria-pressed", "true");
  });

  test("o ⓘ do assistente explica como funciona e como conseguir a chave", async ({ page }) => {
    const info = page.getByRole("button", { name: "Como funciona e como conseguir a chave da API" });
    await expect(info).toHaveAttribute("aria-expanded", "false");
    await info.click();

    const caixa = page.getByRole("region", { name: "Sobre a chave da API" });
    // Duas opções: Gemini (grátis para começar) e OpenAI (paga), cada uma com o link para criar a chave.
    await expect(caixa).toContainText("grátis para começar");
    await expect(caixa.getByRole("link", { name: "aistudio.google.com/apikey" })).toHaveAttribute(
      "href",
      "https://aistudio.google.com/apikey",
    );
    await expect(caixa.getByRole("link", { name: "platform.openai.com/api-keys" })).toHaveAttribute(
      "href",
      "https://platform.openai.com/api-keys",
    );

    await info.click();
    await expect(caixa).toHaveCount(0);
  });

  test("menu de exportação abre com as duas opções", async ({ page }) => {
    await analisarTexto(page);
    await page.getByRole("button", { name: /Exportar/ }).click();

    const menu = page.getByRole("menu", { name: "Exportar o texto revisado" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Baixar \.docx/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Copiar texto/ })).toBeVisible();
  });
});
