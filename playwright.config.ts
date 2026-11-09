import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta (E2E) do NormaReview AI.
 *
 * Os cenários ficam em `tests/` com o sufixo `.e2e.ts` para não colidirem com
 * os testes unitários de `src/` (sufixo `.test.ts`, executados por `bun test`).
 *
 * O app NÃO é iniciado por este arquivo: rode o preview (`bun run dev`) e/ou a
 * API (`bun run api`) antes, e aponte a URL com a variável E2E_BASE_URL.
 * Padrão: http://localhost:5173 (porta do Vite em `vite.config.ts`).
 */
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",

  // Cenários de fluxo de revisão são independentes: rodar em paralelo é seguro.
  fullyParallel: true,
  // No CI não se deixa `test.only` passar e uma instabilidade merece retentativa.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    // Rastro e mídia só quando algo falha: evita artefatos a cada execução.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: "chromium",
      // `channel: "chromium"` usa o Chromium completo (headless moderno) em vez
      // do binário "headless shell", que é um download extra de ~270 MB.
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
});
