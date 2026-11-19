import { expect, test, type Page } from "@playwright/test";
import { editorDeTexto, entrar } from "./support/apoio";

/**
 * Artigos — aba própria com as folhas em miniatura (até três): criar pela
 * folha em branco, abrir no editor, limite com aviso e exclusão.
 */
async function irParaArtigos(page: Page): Promise<void> {
  await page.getByRole("navigation", { name: "Navegação do sistema" }).getByRole("link", { name: "Artigos" }).click();
  await expect(page).toHaveURL(/\/artigos$/);
}

/** Cria um artigo pela folha em branco e escreve nele no editor. */
async function novoArtigoCom(page: Page, texto: string): Promise<void> {
  await irParaArtigos(page);
  await page.getByRole("button", { name: "Novo artigo" }).click();
  await expect(page).toHaveURL(/\/revisar$/);
  await expect(editorDeTexto(page)).toHaveValue("");
  await editorDeTexto(page).fill(texto);
}

test.describe("Artigos", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("a revisão não tem mais o seletor de artigo", async ({ page }) => {
    await expect(page.getByLabel("Artigo", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Novo artigo/ })).toHaveCount(0);
  });

  test("cria até três artigos e abre qualquer um pela folha", async ({ page }) => {
    await editorDeTexto(page).fill("PRIMEIRO ARTIGO\n\nTexto do primeiro.");
    await novoArtigoCom(page, "SEGUNDO ARTIGO\n\nTexto do segundo.");
    await novoArtigoCom(page, "TERCEIRO ARTIGO\n\nTexto do terceiro.");

    await irParaArtigos(page);
    await expect(page.locator(".artigos-contagem")).toHaveText("3 de 3");
    await expect(page.getByRole("button", { name: /^Abrir o artigo/ })).toHaveCount(3);
    // O título fica embaixo da folha.
    await expect(page.locator(".recente-titulo")).toContainText(["Novo artigo", "TERCEIRO ARTIGO", "SEGUNDO ARTIGO", "PRIMEIRO ARTIGO"]);

    await page.getByRole("button", { name: "Abrir o artigo PRIMEIRO ARTIGO" }).click();
    await expect(page).toHaveURL(/\/revisar$/);
    await expect(editorDeTexto(page)).toHaveValue("PRIMEIRO ARTIGO\n\nTexto do primeiro.");
  });

  test("com três artigos, a folha em branco avisa o limite e nada é apagado", async ({ page }) => {
    await editorDeTexto(page).fill("UM\n\nTexto um.");
    await novoArtigoCom(page, "DOIS\n\nTexto dois.");
    await novoArtigoCom(page, "TRES\n\nTexto três.");

    await irParaArtigos(page);
    const novo = page.getByRole("button", { name: "Novo artigo" });
    await expect(novo).toHaveAttribute("aria-disabled", "true");
    // Marcada como indisponível, mas o clique ainda explica o motivo.
    await novo.click({ force: true });
    await expect(page.getByRole("status")).toContainText("Você já tem 3 artigos salvos");
    await expect(page).toHaveURL(/\/artigos$/);
    await expect(page.getByRole("button", { name: /^Abrir o artigo/ })).toHaveCount(3);
  });

  test("o lápis renomeia o artigo; Esc cancela; vazio volta ao nome automático", async ({ page }) => {
    await editorDeTexto(page).fill("INTRODUÇÃO\n\nTexto qualquer.");
    await irParaArtigos(page);

    await page.getByRole("button", { name: "Renomear o artigo INTRODUÇÃO" }).click();
    const campo = page.getByRole("textbox", { name: /Novo nome do artigo/ });
    await campo.fill("Artigo da disciplina");
    await campo.press("Enter");
    await expect(page.locator(".recente-titulo").nth(1)).toHaveText("Artigo da disciplina");

    // Continua com o nome depois de recarregar a página.
    await page.reload();
    await expect(page.getByRole("button", { name: "Abrir o artigo Artigo da disciplina" })).toBeVisible();

    // Esc não salva o que foi digitado.
    await page.getByRole("button", { name: "Renomear o artigo Artigo da disciplina" }).click();
    await page.getByRole("textbox", { name: /Novo nome do artigo/ }).fill("Nome descartado");
    await page.getByRole("textbox", { name: /Novo nome do artigo/ }).press("Escape");
    await expect(page.locator(".recente-titulo").nth(1)).toHaveText("Artigo da disciplina");

    // Apagar o nome volta à primeira linha do texto.
    await page.getByRole("button", { name: "Renomear o artigo Artigo da disciplina" }).click();
    await page.getByRole("textbox", { name: /Novo nome do artigo/ }).fill("");
    await page.getByRole("textbox", { name: /Novo nome do artigo/ }).press("Enter");
    await expect(page.locator(".recente-titulo").nth(1)).toHaveText("INTRODUÇÃO");
  });

  test("o nome dado sobrevive à edição no editor e dá nome ao .docx", async ({ page }) => {
    await editorDeTexto(page).fill("INTRODUÇÃO\n\nTexto qualquer.");
    await irParaArtigos(page);
    await page.getByRole("button", { name: "Renomear o artigo INTRODUÇÃO" }).click();
    await page.getByRole("textbox", { name: /Novo nome do artigo/ }).fill("Meu artigo");
    await page.getByRole("textbox", { name: /Novo nome do artigo/ }).press("Enter");

    await page.getByRole("button", { name: "Abrir o artigo Meu artigo" }).click();
    await editorDeTexto(page).fill("INTRODUÇÃO\n\nTexto alterado no editor.");
    await page.getByRole("button", { name: /Exportar/ }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: /Baixar \.docx/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("Meu artigo-revisado.docx");

    await irParaArtigos(page);
    await expect(page.getByRole("button", { name: "Abrir o artigo Meu artigo" })).toBeVisible();
  });

  test("excluir pede confirmação e tira a folha", async ({ page }) => {
    await editorDeTexto(page).fill("ARTIGO A\n\nTexto A.");
    await novoArtigoCom(page, "ARTIGO B\n\nTexto B.");

    await irParaArtigos(page);
    await expect(page.locator(".recente.aberto")).toContainText("ARTIGO B");
    await page.getByRole("button", { name: "Excluir o artigo ARTIGO B" }).click();
    await page.getByRole("group", { name: "Confirmar ação" }).getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByRole("button", { name: /^Abrir o artigo/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Abrir o artigo ARTIGO A" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText('Artigo "ARTIGO B" excluído.');
  });
});
