import { expect, test } from "@playwright/test";
import { entrar } from "./support/apoio";

/**
 * Perfil — dados de identificação, assistente IA (BYO-key) e sessão.
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

  test("salva e remove a chave do assistente IA", async ({ page }) => {
    const chave = page.getByLabel("Chave da API (Gemini ou OpenAI)");
    await chave.fill("sk-teste-local");
    await page.getByRole("button", { name: "Salvar chave" }).click();

    await expect(page.getByRole("status")).toContainText("Assistente IA configurado");
    await expect(page.getByText(/Configurado/)).toBeVisible();

    await page.getByRole("button", { name: "Remover chave" }).click();
    await expect(page.getByRole("status")).toContainText("Assistente IA desativado");
    await expect(page.getByLabel("Chave da API (Gemini ou OpenAI)")).toBeVisible();
  });

  test("sair da conta pela tela de perfil volta ao login", async ({ page }) => {
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Chave da IA não fica guardada", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("vale enquanto a aba está aberta e some ao sair da conta", async ({ page }) => {
    // Chave antiga, de antes desta versão, guardada sem prazo: é apagada.
    await page.evaluate(() => localStorage.setItem("normareview.ia", JSON.stringify({ apiKey: "sk-antiga" })));

    await page.getByLabel("Chave da API (Gemini ou OpenAI)").fill("AIzaChaveDeTeste");
    await page.getByRole("button", { name: "Ativar assistente" }).click();
    await expect(page.getByText("Assistente configurado com Gemini")).toBeVisible();

    // Não vai para o armazenamento permanente; continua ao trocar de tela e ao recarregar.
    expect(await page.evaluate(() => localStorage.getItem("normareview.ia"))).toBeNull();
    await page.getByRole("navigation", { name: "Navegação do sistema" }).getByRole("link", { name: "Histórico" }).click();
    await page.getByRole("navigation", { name: "Navegação do sistema" }).getByRole("link", { name: "Revisar" }).click();
    await page.reload();
    await expect(page.getByText("Assistente configurado com Gemini")).toBeVisible();

    // Sair apaga a chave: entrando de novo, é preciso colar outra vez.
    await page.getByRole("button", { name: "Sair" }).click();
    expect(await page.evaluate(() => sessionStorage.getItem("normareview.ia"))).toBeNull();
    await entrar(page);
    await expect(page.getByLabel("Chave da API (Gemini ou OpenAI)")).toBeVisible();
  });

  test("fechar a aba e abrir outra exige colar a chave de novo", async ({ page, context }) => {
    await page.getByLabel("Chave da API (Gemini ou OpenAI)").fill("AIzaChaveDeTeste");
    await page.getByRole("button", { name: "Ativar assistente" }).click();
    await expect(page.getByText("Assistente configurado com Gemini")).toBeVisible();

    const outraAba = await context.newPage();
    await entrar(outraAba);
    await expect(outraAba.getByLabel("Chave da API (Gemini ou OpenAI)")).toBeVisible();
  });
});
