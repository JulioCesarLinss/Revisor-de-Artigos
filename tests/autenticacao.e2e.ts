import { expect, test } from "@playwright/test";
import { DADOS_TESTE } from "./support/apoio";

/**
 * Autenticação — /login. Cobre as duas abas (Entrar / Criar conta), o
 * formulário (campos obrigatórios, mostrar senha, "lembrar de mim") e o
 * encerramento da sessão.
 */
test.describe("Autenticação", () => {
  test("rota protegida sem sessão redireciona para o login", async ({ page }) => {
    await page.goto("/revisar");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /Rigor acadêmico/ })).toBeVisible();
  });

  test("formulário exige e-mail e senha antes de enviar", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Entrar no NormaReview" }).click();
    // A validação nativa barra o envio: continua no login, sem entrar.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("navigation", { name: "Navegação do sistema" })).toHaveCount(0);
  });

  test("botão mostrar/ocultar senha alterna o tipo do campo", async ({ page }) => {
    await page.goto("/login");
    const senha = page.getByLabel("Senha de acesso");
    await senha.fill(DADOS_TESTE.senha);
    await expect(senha).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "mostrar" }).click();
    await expect(senha).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "ocultar" }).click();
    await expect(senha).toHaveAttribute("type", "password");
  });

  test("login com dados de teste abre a revisão", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail institucional ou pessoal").fill(DADOS_TESTE.email);
    await page.getByLabel("Senha de acesso").fill(DADOS_TESTE.senha);
    await page.getByRole("button", { name: "Entrar no NormaReview" }).click();

    await expect(page).toHaveURL(/\/revisar$/);
    await expect(page.getByRole("navigation", { name: "Navegação do sistema" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Revisar", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("lembrar de mim persiste a sessão no dispositivo; sem marcar, só na aba", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail institucional ou pessoal").fill(DADOS_TESTE.email);
    await page.getByLabel("Senha de acesso").fill(DADOS_TESTE.senha);
    await page.getByRole("button", { name: "Entrar no NormaReview" }).click();
    await expect(page).toHaveURL(/\/revisar$/);

    const semLembrar = await page.evaluate(() => ({
      local: localStorage.getItem("normareview.sessao"),
      aba: sessionStorage.getItem("normareview.sessao"),
    }));
    expect(semLembrar.local).toBeNull();
    expect(semLembrar.aba).toBe("1");

    // Agora com "lembrar de mim": a marcação vai para o localStorage.
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("E-mail institucional ou pessoal").fill(DADOS_TESTE.email);
    await page.getByLabel("Senha de acesso").fill(DADOS_TESTE.senha);
    await page.getByLabel("Lembrar de mim neste dispositivo").check();
    await page.getByRole("button", { name: "Entrar no NormaReview" }).click();
    await expect(page).toHaveURL(/\/revisar$/);

    expect(await page.evaluate(() => localStorage.getItem("normareview.sessao"))).toBe("1");
  });

  test("cadastro barra senha fora das regras e mostra o que falta", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: "Criar conta" }).click();

    await page.getByLabel("Nome completo do autor(a) ou revisor(a)").fill(DADOS_TESTE.nome);
    await page.getByLabel("E-mail institucional ou pessoal").fill("novo.teste@usp.br");
    await page.getByLabel("Criar senha").fill("abc");
    await page.getByLabel("Confirmar senha").fill("abc");
    await page.getByRole("button", { name: "Cadastrar gratuitamente" }).click();

    const erro = page.getByRole("alert");
    await expect(erro).toBeVisible();
    await expect(erro).toContainText("A senha ainda não atende às regras");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("cadastro com senha válida cria a sessão e entra na revisão", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: "Criar conta" }).click();

    await page.getByLabel("Nome completo do autor(a) ou revisor(a)").fill(DADOS_TESTE.nome);
    await page.getByLabel("E-mail institucional ou pessoal").fill("novo.teste@usp.br");
    await page.getByLabel("Criar senha").fill(DADOS_TESTE.senha);
    await page.getByLabel("Confirmar senha").fill(DADOS_TESTE.senha);

    // O checklist acende as cinco regras quando a senha fica válida.
    await expect(page.locator(".login-regra.ok")).toHaveCount(5);

    await page.getByRole("button", { name: "Cadastrar gratuitamente" }).click();
    await expect(page).toHaveURL(/\/revisar$/);
  });

  test("sair encerra a sessão e limpa o dispositivo", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail institucional ou pessoal").fill(DADOS_TESTE.email);
    await page.getByLabel("Senha de acesso").fill(DADOS_TESTE.senha);
    await page.getByLabel("Lembrar de mim neste dispositivo").check();
    await page.getByRole("button", { name: "Entrar no NormaReview" }).click();
    await expect(page).toHaveURL(/\/revisar$/);

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem("normareview.sessao"))).toBeNull();

    // A rota protegida volta a barrar o acesso.
    await page.goto("/revisar");
    await expect(page).toHaveURL(/\/login$/);
  });
});
