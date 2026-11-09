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

    // O resumo das regras acompanha exatamente os cartões exibidos.
    await expect(page.locator(".resumo-subtitulo")).toHaveText("Regras normativas");
    await expect(page.locator(".resumo-item.total strong")).toHaveText(String(problemas));
    await expect(cartaoDaRegra(page, "Espaço em excesso antes da pontuação")).toBeVisible();
    await expect(cartaoDaRegra(page, "Aspas desbalanceadas")).toBeVisible();
    await expect(cartaoDaRegra(page, "Espaço duplo entre palavras")).toBeVisible();
    await expect(page.locator(".avisos-restantes")).toContainText("avisos restantes");

    // Diagnóstico do Gemini é opcional: sem pedir, o bloco não aparece no resumo.
    await expect(page.locator(".resumo-gemini")).toHaveCount(0);
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

  test("menu de exportação abre com as duas opções", async ({ page }) => {
    await analisarTexto(page);
    await page.getByRole("button", { name: /Exportar/ }).click();

    const menu = page.getByRole("menu", { name: "Exportar o texto revisado" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Baixar \.docx/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Copiar texto/ })).toBeVisible();
  });
});
