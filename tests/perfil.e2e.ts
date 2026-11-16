import { expect, test } from "@playwright/test";
import { entrar } from "./support/apoio";

/**
 * Perfil — dados de identificação e sessão.
 * No modo local (sem Firebase) o e-mail vem da conta, então o formulário
 * recusa salvar só com o nome: é esse o caminho exercitado aqui.
 */
test.describe("Perfil", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
    await page.getByRole("link", { name: "Perfil" }).click();
    await expect(page).toHaveURL(/\/perfil$/);
  });

  test("formulário não salva sem os dados obrigatórios", async ({ page }) => {
    await page.getByLabel("Nome completo").fill("Ana Costa");
    await page.getByRole("button", { name: "Salvar perfil" }).click();

    await expect(page.getByRole("status")).toContainText("Preencha ao menos nome e e-mail para salvar.");
  });

  test("perfil de utilização é selecionável", async ({ page }) => {
    const select = page.getByLabel("Perfil de utilização principal");
    await expect(select).toHaveValue("graduacao");

    await select.selectOption({ label: "Docente / Orientador Acadêmico" });
    await expect(select).toHaveValue("docente");
  });

  test("sair da conta pela tela de perfil volta ao login", async ({ page }) => {
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
