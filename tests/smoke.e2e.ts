import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { cartaoDaRegra, DADOS_TESTE, editorDeTexto, TEXTO_EXEMPLO } from "./support/apoio";

/**
 * Smoke test — caminho crítico de uma versão nova, em menos de um minuto.
 * Roda antes dos E2E completos: se falhar, a versão não está de pé.
 *
 * Local: `bun run api` e `bun run dev`, depois `bun run test:smoke`.
 * Publicado: E2E_BASE_URL com a URL do app, e SMOKE_EMAIL/SMOKE_SENHA de uma
 * conta de teste do Firebase — o trabalho salvo dessa conta é sobrescrito.
 * O Gemini não é chamado (gastaria cota): só se confere se está configurado.
 */
const CONTA = {
  email: process.env.SMOKE_EMAIL ?? DADOS_TESTE.email,
  senha: process.env.SMOKE_SENHA ?? DADOS_TESTE.senha,
};

/** TEXTO_EXEMPLO tem três violações conhecidas (R001, R003 e R010). */
const AVISOS_DO_EXEMPLO = 3;
const PARAGRAFOS_DO_EXEMPLO = 3;

test.describe("Smoke", () => {
  test("API: health, revisão e estado do Gemini respondem", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);

    const revisar = await request.post("/api/revisar", { data: { texto: TEXTO_EXEMPLO } });
    expect(revisar.status()).toBe(200);
    expect((await revisar.json()).problemas).toHaveLength(AVISOS_DO_EXEMPLO);

    // Só expõe se está ligado — nunca a chave nem detalhes do servidor.
    const gemini = await request.get("/api/gemini");
    expect(gemini.status()).toBe(200);
    expect(Object.keys(await gemini.json())).toEqual(["configurado"]);
  });

  test("caminho crítico: entrar, analisar, corrigir, exportar, histórico, laudo e sair", async ({ page }, info) => {
    await test.step("rota protegida pede login e o login abre a revisão", async () => {
      await page.goto("/revisar");
      await expect(page).toHaveURL(/\/login$/);
      await page.getByLabel("E-mail institucional ou pessoal").fill(CONTA.email);
      await page.getByLabel("Senha de acesso").fill(CONTA.senha);
      await page.getByRole("button", { name: "Entrar na conta" }).click();
      await expect(page).toHaveURL(/\/revisar$/);
    });

    await test.step("analisar lista os avisos e os contadores", async () => {
      await editorDeTexto(page).fill(TEXTO_EXEMPLO);
      await expect(page.locator(".canvas-toolbar .stat").first()).toContainText(String(PARAGRAFOS_DO_EXEMPLO));
      await page.getByRole("button", { name: "Analisar" }).click();
      await expect(page.locator(".problema-card")).toHaveCount(AVISOS_DO_EXEMPLO);
      await expect(page.locator(".resumo-item.total strong")).toHaveText(String(AVISOS_DO_EXEMPLO));
    });

    await test.step("localizar destaca o erro no editor", async () => {
      await cartaoDaRegra(page, "Aspas desbalanceadas").getByRole("button", { name: "Localizar no manuscrito" }).click();
      await expect(page.locator("mark.folha-destaque").first()).toBeVisible();
    });

    await test.step("aplicar correção reduz os avisos; desfazer devolve o texto", async () => {
      await cartaoDaRegra(page, "Espaço em excesso antes da pontuação")
        .getByRole("button", { name: "Aplicar correção" })
        .click();
      await page.getByRole("button", { name: "Confirmar" }).click();
      await expect(editorDeTexto(page)).not.toHaveValue(/editorial \./);
      await expect(page.locator(".problema-card")).toHaveCount(AVISOS_DO_EXEMPLO - 1);

      await page.getByRole("button", { name: "Desfazer" }).click();
      await expect(editorDeTexto(page)).toHaveValue(TEXTO_EXEMPLO);
      await expect(page.locator(".problema-card")).toHaveCount(AVISOS_DO_EXEMPLO);
    });

    await test.step("negrito aplica no trecho selecionado", async () => {
      await editorDeTexto(page).focus();
      await page.keyboard.press("Control+Home");
      await page.keyboard.press("Shift+End");
      await page.getByRole("button", { name: "Negrito" }).click();
      await expect(page.getByRole("button", { name: "Negrito" })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".folha-destaque-camada .texto-negrito").first()).toContainText("A revisão de artigos");
    });

    await test.step("exportar baixa um .docx válido", async () => {
      await page.getByRole("button", { name: /Exportar/ }).click();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("menuitem", { name: /Baixar \.docx/ }).click(),
      ]);
      expect(download.suggestedFilename()).toBe("manuscrito-revisado.docx");

      const caminho = info.outputPath("smoke.docx");
      await download.saveAs(caminho);
      const arquivo = await readFile(caminho);
      expect(arquivo.subarray(0, 2).toString()).toBe("PK"); // .docx é um ZIP
      expect(arquivo.includes("word/document.xml")).toBe(true);
    });

    await test.step("histórico registra a correção", async () => {
      await page.getByRole("link", { name: "Histórico" }).click();
      await expect(page).toHaveURL(/\/historico$/);
      await expect(page.getByText("1 alteração(ões) registrada(s).")).toBeVisible();
    });

    await test.step("laudo apura os mesmos números da análise", async () => {
      await page.getByRole("link", { name: "Laudo" }).click();
      await expect(page).toHaveURL(/\/laudo$/);
      const resumo = page.getByRole("region", { name: "Resumo por severidade" });
      await expect(resumo.locator(".laudo-stat.total strong")).toHaveText(String(AVISOS_DO_EXEMPLO));
    });

    await test.step("sair encerra a sessão e a rota protegida volta a barrar", async () => {
      await page.getByRole("button", { name: "Sair" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.goto("/revisar");
      await expect(page).toHaveURL(/\/login$/);
    });
  });
});
