import { expect, test, type Page } from "@playwright/test";
import { analisarTexto, cartaoDaRegra, editorDeTexto, entrar } from "./support/apoio";

/**
 * Estados de carregamento — Heurística 1 (visibilidade do status do sistema).
 *
 * Cobre os dois carregamentos que o usuário pode observar e controlar:
 * - leitura de um arquivo anexado ("Lendo …");
 * - pedido de sugestão à IA ("Pedindo sugestão à IA…").
 *
 * As respostas são seguradas com `page.route`/atraso no `arrayBuffer`, para que
 * o estado intermediário fique observável em vez de depender de sorte de tempo.
 */

/** Resposta válida do serviço de IA no formato que o app interpreta. */
const RESPOSTA_IA = {
  choices: [
    {
      message: {
        content:
          "SUGESTAO: A revisão de artigos científicos é uma etapa essencial do processo editorial.\n" +
          "EXPLICACAO: Remove o espaço antes do ponto final.",
      },
    },
  ],
};

/** Configura o assistente IA pela própria tela (chave fictícia: o fetch é interceptado). */
async function ativarAssistente(page: Page): Promise<void> {
  await page.getByPlaceholder("Chave da API (OpenAI ou compatível)").fill("chave-de-teste");
  await page.getByRole("button", { name: "Ativar assistente" }).click();
  await expect(page.getByText("Assistente configurado", { exact: false })).toBeVisible();
}

test.describe("Carregamento", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("sugestão da IA mostra o carregamento e libera os controles ao responder", async ({ page }) => {
    await ativarAssistente(page);
    await analisarTexto(page);

    // A resposta só chega quando o teste liberar: o carregamento fica visível.
    let liberar!: () => void;
    const espera = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    await page.route("**/chat/completions", async (route) => {
      await espera;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(RESPOSTA_IA),
      });
    });

    const cartao = cartaoDaRegra(page, "Espaço em excesso antes da pontuação");
    await cartao.getByRole("button", { name: "Sugerir com IA" }).click();

    // H1: o status do sistema diz o que está acontecendo, com spinner decorativo.
    const status = page.locator(".status-sistema");
    await expect(status).toHaveAttribute("role", "status");
    await expect(status).toHaveAttribute("aria-live", "polite");
    await expect(status).toContainText("Pedindo sugestão à IA…");
    await expect(status.locator(".status-spinner")).toBeVisible();
    await expect(status.locator(".status-spinner")).toHaveAttribute("aria-hidden", "true");

    // Enquanto espera, o app fica ocupado: o botão vira "Pedindo sugestão…" e
    // as ações que alterariam o manuscrito ficam bloqueadas.
    const botaoSugerir = cartao.getByRole("button", { name: /Pedindo sugestão/ });
    await expect(botaoSugerir).toBeVisible();
    await expect(botaoSugerir).toBeDisabled();
    await expect(botaoSugerir).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("button", { name: "Analisar" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Analisar" })).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("button", { name: "Anexar" })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Desfazer/ })).toBeDisabled();

    liberar();

    // Terminado o pedido, o carregamento some e o resultado aparece.
    await expect(page.locator(".sugestao-card")).toBeVisible();
    await expect(page.locator(".sugestao-card")).toContainText("Sugestão IA");
    await expect(page.locator(".sugestao-card")).toContainText(
      "A revisão de artigos científicos é uma etapa essencial do processo editorial.",
    );
    await expect(page.locator(".status-sistema")).toContainText("Sugestão recebida da IA");
    await expect(page.locator(".status-sistema .status-spinner")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Analisar" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Anexar" })).toBeEnabled();
  });

  test("falha no pedido encerra o carregamento e mostra o erro", async ({ page }) => {
    await ativarAssistente(page);
    await analisarTexto(page);

    let liberar!: () => void;
    const espera = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    await page.route("**/chat/completions", async (route) => {
      await espera;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({}) });
    });

    const cartao = cartaoDaRegra(page, "Espaço em excesso antes da pontuação");
    await cartao.getByRole("button", { name: "Sugerir com IA" }).click();
    await expect(page.locator(".status-sistema")).toContainText("Pedindo sugestão à IA…");

    liberar();

    // H9: o erro diz o quê e por quê; o carregamento não fica preso na tela.
    const erro = page.getByRole("alert");
    await expect(erro).toContainText("Ocorreu um erro ao pedir a sugestão");
    await expect(erro).toContainText("Serviço de IA respondeu 500");
    await expect(erro.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
    await expect(page.locator(".status-sistema")).toHaveCount(0);
    await expect(cartao.getByRole("button", { name: "Sugerir com IA" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Analisar" })).toBeEnabled();
  });

  test("leitura de arquivo anexado mostra o carregamento até o texto entrar no editor", async ({ page }) => {
    // Segura a leitura do arquivo para o estado "Lendo …" ficar observável.
    await page.addInitScript(() => {
      const original = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = function (this: Blob) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          setTimeout(() => {
            original.call(this).then(resolve, reject);
          }, 800);
        });
      };
    });
    await page.reload();
    await expect(page).toHaveURL(/\/revisar$/);

    await page.locator('input[type="file"]').setInputFiles({
      name: "artigo.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "A revisão de artigos científicos é uma etapa essencial do processo editorial.\n\n" +
          "O impacto da norma ABNT no texto acadêmico é grande e visível.",
      ),
    });

    // H1: status com o nome do arquivo e spinner; o app bloqueia novas ações.
    const status = page.locator(".status-sistema");
    await expect(status).toContainText('Lendo "artigo.txt"…');
    await expect(status.locator(".status-spinner")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anexar" })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Desfazer/ })).toBeDisabled();

    // Terminada a leitura: spinner nenhum, texto no editor e ações liberadas.
    await expect(status).toContainText('Arquivo "artigo.txt" carregado');
    await expect(status.locator(".status-spinner")).toHaveCount(0);
    await expect(editorDeTexto(page)).toHaveValue(/A revisão de artigos científicos/);
    await expect(page.getByRole("button", { name: "Anexar" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Analisar" })).toBeEnabled();
  });
});
