import { expect, type Page } from "@playwright/test";

/**
 * Apoio compartilhado dos testes E2E.
 *
 * Dados de teste: o app roda com autenticação local simulada quando o Firebase
 * não está configurado (é o caso deste ambiente), então as credenciais abaixo
 * funcionam como um usuário de teste — nenhuma conta real é criada.
 */
export const DADOS_TESTE = {
  email: "revisor.teste@ufrj.br",
  senha: "SenhaValida1!",
  nome: "Dr. Marcelo da Silva Junior",
} as const;

/**
 * Manuscrito de teste com violações conhecidas do catálogo normativo:
 * espaço antes da pontuação (R001), aspas desbalanceadas (R003) e espaço
 * duplo (R010). Mantido curto para caber numa única folha A4.
 */
export const TEXTO_EXEMPLO = [
  "A revisão de artigos científicos é uma etapa essencial do processo editorial .",
  "",
  '"Este trecho abre aspas mas não fecha.',
  "",
  "O impacto da norma ABNT no texto acadêmico segundo Silva 2019 é grande  e  visível.",
].join("\n");

/** Faz login com os dados de teste e confirma que a área protegida abriu. */
export async function entrar(page: Page, opcoes: { lembrar?: boolean } = {}): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail institucional ou pessoal").fill(DADOS_TESTE.email);
  await page.getByLabel("Senha de acesso").fill(DADOS_TESTE.senha);
  if (opcoes.lembrar) await page.getByLabel("Lembrar de mim neste dispositivo").check();
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await expect(page).toHaveURL(/\/revisar$/);
}

/** Editor de manuscrito (a folha 1 é a única enquanto o texto é curto). */
export function editorDeTexto(page: Page) {
  return page.getByLabel(/Manuscrito — folha 1 de/);
}

/**
 * Escreve o texto no editor, clica em Analisar e devolve quantos cartões de
 * problema apareceram — usado para conferir os números do resumo depois.
 */
export async function analisarTexto(page: Page, texto: string = TEXTO_EXEMPLO): Promise<number> {
  await editorDeTexto(page).fill(texto);
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.locator(".problema-card").first()).toBeVisible();
  return page.locator(".problema-card").count();
}

/** Cartão de problema de uma regra específica (título legível no chip). */
export function cartaoDaRegra(page: Page, titulo: string) {
  return page.locator(".problema-card").filter({ hasText: titulo });
}
