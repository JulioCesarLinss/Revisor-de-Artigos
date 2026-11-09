import { expect, test } from "@playwright/test";
import { entrar } from "./support/apoio";

/** Navegação — menu principal, rotas protegidas, atalho de conteúdo e ajuda. */
test.describe("Navegação", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("percorre as quatro telas pelo menu, marcando a atual", async ({ page }) => {
    const navegacao = page.getByRole("navigation", { name: "Navegação do sistema" });

    await navegacao.getByRole("link", { name: "Histórico" }).click();
    await expect(page).toHaveURL(/\/historico$/);
    await expect(page.getByRole("heading", { name: "Histórico de revisões" })).toBeVisible();
    await expect(navegacao.getByRole("link", { name: "Histórico" })).toHaveAttribute("aria-current", "page");

    await navegacao.getByRole("link", { name: "Laudo" }).click();
    await expect(page).toHaveURL(/\/laudo$/);
    await expect(page.getByRole("heading", { name: "Laudo ABNT" })).toBeVisible();
    await expect(navegacao.getByRole("link", { name: "Laudo" })).toHaveAttribute("aria-current", "page");

    await navegacao.getByRole("link", { name: "Perfil" }).click();
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByRole("heading", { name: /Seu perfil|Dr\./ })).toBeVisible();
    await expect(navegacao.getByRole("link", { name: "Perfil" })).toHaveAttribute("aria-current", "page");

    await navegacao.getByRole("link", { name: "Revisar" }).click();
    await expect(page).toHaveURL(/\/revisar$/);
    await expect(page.getByLabel(/Manuscrito — folha 1 de/)).toBeVisible();
  });

  test("a marca do topo volta para a revisão", async ({ page }) => {
    await page.getByRole("link", { name: "Histórico" }).click();
    await expect(page).toHaveURL(/\/historico$/);

    await page.getByRole("link", { name: /^NormaReview/ }).click();
    await expect(page).toHaveURL(/\/revisar$/);
  });

  test("rota desconhecida cai na revisão", async ({ page }) => {
    await page.goto("/rota-que-nao-existe");
    await expect(page).toHaveURL(/\/revisar$/);
  });

  test("já autenticado, /login leva direto para a revisão", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/revisar$/);
  });

  test("atalho de conteúdo aponta para o conteúdo principal", async ({ page }) => {
    const atalho = page.getByRole("link", { name: "Ir para o conteúdo" });
    await expect(atalho).toHaveAttribute("href", "#conteudo");
    await expect(page.locator("#conteudo")).toHaveCount(1);
  });

  test("ajuda abre sobre a tela e fecha com Esc", async ({ page }) => {
    await page.getByRole("button", { name: "Ajuda" }).click();
    const ajuda = page.getByRole("dialog");
    await expect(ajuda).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(ajuda).toHaveCount(0);
  });
});
