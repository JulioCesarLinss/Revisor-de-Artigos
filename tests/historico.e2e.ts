import { expect, test } from "@playwright/test";
import { analisarTexto, cartaoDaRegra, entrar } from "./support/apoio";

/** Histórico — estado vazio, registro da correção, filtros e limpeza. */
test.describe("Histórico", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
    await page.getByRole("link", { name: "Histórico" }).click();
    await expect(page).toHaveURL(/\/historico$/);
  });

  test("sem revisão registrada mostra o estado vazio", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Nenhuma revisão registrada ainda" })).toBeVisible();
    // O editor já salvou um workspace vazio ao abrir: zero alterações registradas.
    await expect(page.getByRole("status")).toContainText("0 alteração(ões) registrada(s).");
    // Sem arquivo anexado não há original para restaurar; sem alterações, não
    // há histórico para limpar (o botão só existe quando há o que limpar).
    await expect(page.getByRole("button", { name: "Voltar ao original" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Limpar histórico" })).toHaveCount(0);
  });

  test("estado vazio leva ao editor", async ({ page }) => {
    await page.getByRole("link", { name: "Ir para Revisar →" }).click();
    await expect(page).toHaveURL(/\/revisar$/);
  });

  test("registra a correção aplicada e filtra por origem", async ({ page }) => {
    await page.goto("/revisar");
    await analisarTexto(page);
    const cartao = cartaoDaRegra(page, "Espaço em excesso antes da pontuação");
    await cartao.getByRole("button", { name: "Aplicar correção" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();

    await page.getByRole("link", { name: "Histórico" }).click();
    await expect(page).toHaveURL(/\/historico$/);

    await expect(page.getByText("1 alteração(ões) registrada(s).")).toBeVisible();
    await expect(page.locator(".historico-stat").filter({ hasText: "Alterações" })).toContainText("1");

    const lista = page.getByRole("region", { name: "Alterações registradas" });
    await expect(lista.getByRole("listitem")).toHaveCount(1);

    // Filtro por origem: só sugestões de IA não há nada registrado.
    await page.getByRole("button", { name: "Sugestões de IA" }).click();
    await expect(page.getByText("Nenhuma alteração com esta origem.")).toBeVisible();

    await page.getByRole("button", { name: "Correções manuais", exact: true }).click();
    await expect(lista.getByRole("listitem")).toHaveCount(1);
  });

  test("limpar histórico pede confirmação e esvazia a lista", async ({ page }) => {
    await page.goto("/revisar");
    await analisarTexto(page);
    const cartao = cartaoDaRegra(page, "Espaço em excesso antes da pontuação");
    await cartao.getByRole("button", { name: "Aplicar correção" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();

    await page.getByRole("link", { name: "Histórico" }).click();
    await page.getByRole("button", { name: "Limpar histórico" }).click();

    const confirmacao = page.getByRole("group", { name: "Confirmar ação" });
    await expect(confirmacao).toBeVisible();
    await confirmacao.getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByRole("heading", { name: "Nenhuma revisão registrada ainda" })).toBeVisible();
  });
});
