import { expect, test } from "@playwright/test";
import { analisarTexto, cartaoDaRegra, editorDeTexto, entrar, TEXTO_EXEMPLO } from "./support/apoio";

/** Histórico — estado vazio, registro da correção, filtros e limpeza. */
test.describe("Histórico", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
    await page.getByRole("link", { name: "Histórico" }).click();
    await expect(page).toHaveURL(/\/historico$/);
  });

  test("sem revisão registrada mostra o estado vazio", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Nenhuma revisão registrada ainda" })).toBeVisible();
    // Sem arquivo anexado não há original para restaurar; sem alterações, não
    // há histórico para limpar (o botão só existe quando há o que limpar).
    await expect(page.getByRole("button", { name: "Voltar ao original" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Limpar histórico" })).toHaveCount(0);
  });

  test("estado vazio leva ao editor", async ({ page }) => {
    await page.getByRole("link", { name: "Ir para Revisar →" }).click();
    await expect(page).toHaveURL(/\/revisar$/);
  });

  test("registra o nome do erro corrigido numa lista só", async ({ page }) => {
    await page.goto("/revisar");
    await analisarTexto(page);
    const cartao = cartaoDaRegra(page, "Espaço em excesso antes da pontuação");
    await cartao.getByRole("button", { name: "Aplicar correção" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();

    await page.getByRole("link", { name: "Histórico" }).click();
    await expect(page).toHaveURL(/\/historico$/);

    await expect(page.locator(".historico-stat").filter({ hasText: "Alterações" })).toContainText("1");

    const lista = page.getByRole("region", { name: "Alterações registradas" });
    await expect(lista.getByRole("listitem")).toHaveCount(1);

    // A linha diz qual erro foi corrigido, não o texto digitado.
    await expect(lista.getByRole("listitem")).toContainText("Parágrafo 1 — Espaço em excesso antes da pontuação");
    // Uma lista só: sem filtros por origem.
    await expect(page.getByRole("group", { name: "Filtrar por origem" })).toHaveCount(0);
  });

  test("erro corrigido digitando entra como correção manual", async ({ page }) => {
    await page.goto("/revisar");
    await analisarTexto(page);
    const cartao = cartaoDaRegra(page, "Espaço em excesso antes da pontuação");
    await expect(cartao).toHaveCount(1);
    // Avisos que somem em menos de 4 s são da própria digitação e não contam.
    await page.waitForTimeout(4_200);
    await editorDeTexto(page).fill(TEXTO_EXEMPLO.replace("editorial .", "editorial."));
    await expect(cartao).toHaveCount(0);

    await page.getByRole("link", { name: "Histórico" }).click();
    await expect(page.locator(".historico-stat").filter({ hasText: "Correções manuais" })).toContainText("1");
    const linha = page.getByRole("region", { name: "Alterações registradas" }).getByRole("listitem");
    await expect(linha).toHaveCount(1);
    await expect(linha).toContainText("Correção manual");
    await expect(linha).toContainText("Parágrafo 1 — Espaço em excesso antes da pontuação");
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
