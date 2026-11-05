import { expect, test } from "@playwright/test";
import { analisarTexto, entrar } from "./support/apoio";

/** Laudo — estado vazio, apuração do manuscrito analisado e volta ao editor. */
test.describe("Laudo", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("sem manuscrito, oferece o caminho para a revisão", async ({ page }) => {
    await page.getByRole("link", { name: "Laudo" }).click();
    await expect(page).toHaveURL(/\/laudo$/);
    await expect(page.getByRole("heading", { name: "Nenhum manuscrito para apurar" })).toBeVisible();

    await page.getByRole("link", { name: "Ir para Revisar →" }).click();
    await expect(page).toHaveURL(/\/revisar$/);
  });

  test("apura o manuscrito analisado com os mesmos números do resumo", async ({ page }) => {
    const problemas = await analisarTexto(page);
    const totalNoResumo = await page.locator(".resumo-item.total strong").textContent();

    await page.getByRole("link", { name: "Laudo" }).click();
    await expect(page).toHaveURL(/\/laudo$/);

    const resumo = page.getByRole("region", { name: "Resumo por severidade" });
    await expect(resumo).toBeVisible();
    await expect(resumo.locator(".laudo-stat.total strong")).toHaveText(String(totalNoResumo));
    await expect(resumo.locator(".laudo-stat.total strong")).toHaveText(String(problemas));

    await expect(page.getByRole("region", { name: "Métricas do documento" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Conformidade por seção" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copiar laudo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimir / PDF" })).toBeVisible();
  });

  test("volta ao editor pelo botão do laudo", async ({ page }) => {
    await analisarTexto(page);
    await page.getByRole("link", { name: "Laudo" }).click();
    await page.getByRole("button", { name: "Abrir no editor" }).click();
    await expect(page).toHaveURL(/\/revisar$/);
  });
});
