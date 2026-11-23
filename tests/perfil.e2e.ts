import { expect, test, type Page } from "@playwright/test";
import { entrar } from "./support/apoio";

/**
 * Perfil — dados de identificação e assistente IA (BYO-key, só informada aqui).
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

  test("sem quadro de sessão: o Sair fica só no cabeçalho", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Sair da conta" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sair", exact: true })).toBeVisible();
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
});

test.describe("Assistente IA na revisão", () => {
  test("a revisão não pede a chave: 'Ativar assistente de IA' leva ao campo do Perfil", async ({ page }) => {
    await entrar(page);
    // Na revisão não há campo de chave nem o ⓘ do tutorial.
    await expect(page.getByLabel("Chave da API (Gemini ou OpenAI)")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Como funciona e como conseguir a chave da API" })).toHaveCount(0);

    await page.getByRole("link", { name: "Ativar assistente de IA" }).click();
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByLabel("Chave da API (Gemini ou OpenAI)")).toBeFocused();
  });
});

/** Informa a chave no Perfil (o único lugar onde ela é pedida) e volta à revisão. */
async function ativarComChave(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Ativar assistente de IA" }).click();
  await page.getByLabel("Chave da API (Gemini ou OpenAI)").fill("AIzaChaveDeTeste");
  await page.getByRole("button", { name: "Salvar chave" }).click();
  await page.getByRole("navigation", { name: "Navegação do sistema" }).getByRole("link", { name: "Revisar" }).click();
  await expect(page.getByText("Assistente configurado com Gemini")).toBeVisible();
}

test.describe("Chave da IA não fica guardada", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("vale enquanto a aba está aberta e some ao sair da conta", async ({ page }) => {
    // Chave antiga, de antes desta versão, guardada sem prazo: é apagada.
    await page.evaluate(() => localStorage.setItem("normareview.ia", JSON.stringify({ apiKey: "sk-antiga" })));

    await ativarComChave(page);

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
    await expect(page.getByRole("link", { name: "Ativar assistente de IA" })).toBeVisible();
  });

  test("fechar a aba e abrir outra exige colar a chave de novo", async ({ page, context }) => {
    await ativarComChave(page);

    const outraAba = await context.newPage();
    await entrar(outraAba);
    await expect(outraAba.getByRole("link", { name: "Ativar assistente de IA" })).toBeVisible();
  });
});
