import { expect, test } from "@playwright/test";
import { analisarTexto, cartaoDaRegra, editorDeTexto, entrar, TEXTO_EXEMPLO } from "./support/apoio";

/**
 * Editor de revisão — entrada do manuscrito, análise pelas regras
 * normativas, resumo, localização do trecho, correção com confirmação,
 * formatação e menu de exportação.
 */
test.describe("Revisão", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("com o editor vazio, analisar e exportar ficam bloqueados", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Analisar" })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Exportar/ })).toBeDisabled();
    await expect(page.getByText("0 parágrafos")).toBeVisible();
  });

  test("analisar lista os problemas e preenche o resumo", async ({ page }) => {
    const problemas = await analisarTexto(page);
    expect(problemas).toBe(3);

    // Sem Gemini, o total do resumo é exatamente o número de cartões exibidos.
    await expect(page.locator(".resumo-item.total strong")).toHaveText(String(problemas));
    await expect(cartaoDaRegra(page, "Espaço em excesso antes da pontuação")).toBeVisible();
    await expect(cartaoDaRegra(page, "Aspas desbalanceadas")).toBeVisible();
    await expect(cartaoDaRegra(page, "Espaço duplo entre palavras")).toBeVisible();
    await expect(page.locator(".avisos-restantes")).toContainText("avisos restantes");

    // O resumo é um quadro só, sem divisão por origem nem legenda.
    await expect(page.locator(".resumo-card").first()).not.toContainText("Regras normativas");
    await expect(page.locator(".resumo-card").first()).not.toContainText("¶ = parágrafo");
    // O histórico de alterações não aparece mais na tela de revisão (fica na aba Histórico).
    await expect(page.getByRole("heading", { name: "Histórico de alterações" })).toHaveCount(0);
  });

  test("com diagnóstico do Gemini, o total soma regras e Gemini; localizar funciona depois de editar", async ({ page }) => {
    // Diagnóstico salvo (como após um pedido real), feito sobre uma versão anterior do texto.
    const textoAntigo = "INTRODUCAO\n\nOs dados foi coletados em campo ontem.\n\nOutro paragrafo sem erro nenhum aqui.";
    const textoAtual = `${textoAntigo}\n\nParagrafo novo escrito depois do diagnostico.`;
    // A tela grava o artigo vazio ao abrir: espera ela abrir antes de trocar o que está salvo.
    await expect(editorDeTexto(page)).toBeVisible();
    await page.evaluate(
      ([bruto, diagnosticado]) => {
        localStorage.setItem(
          "normareview.workspace",
          JSON.stringify({
            bruto,
            textoOriginal: null,
            historico: [],
            textoDiagnosticado: diagnosticado,
            diagnostico: {
              ok: true,
              resumo: "Um ponto de concordância.",
              truncado: false,
              diagnosticos: [
                { paragrafo: 2, trecho: "dados foi coletados", categoria: "Gramática", descricao: "Concordância.", sugestao: "os dados foram", severidade: "alta" },
              ],
            },
          }),
        );
      },
      [textoAtual, textoAntigo],
    );
    await page.goto("/revisar");

    // Regras: 0 avisos neste texto; Gemini: 1 apontamento de severidade alta → entra em Críticos.
    await expect(page.locator(".resumo-item.total strong")).toHaveText("1");
    await expect(page.locator(".resumo-item.critico strong")).toHaveText("1");

    // O texto mudou depois do diagnóstico: sem aviso laranja, e o Localizar continua disponível.
    await expect(page.getByText("O texto mudou depois deste diagnóstico")).toHaveCount(0);
    await page.locator(".gemini-item").getByRole("button", { name: "Localizar no manuscrito" }).click();
    await expect(page.locator("mark.folha-destaque")).toHaveText("dados foi coletados");
  });

  test("diagnóstico do Gemini: erros de linguagem somem ao corrigir; os do artigo ficam com Conferir e Já resolvi", async ({ page }) => {
    const texto = ["INTRODUCAO", "Os dados foi coletados em campo ontem.", "O resultado mostra que o problmas existe."].join("\n\n");
    // O servidor de teste não tem a chave do Gemini: a tela passa a vê-lo como ativo.
    await page.route("**/api/gemini", (rota) =>
      rota.request().method() === "GET" ? rota.fulfill({ json: { configurado: true } }) : rota.continue(),
    );
    // A tela grava o artigo vazio ao abrir: espera ela abrir antes de trocar o que está salvo.
    await expect(editorDeTexto(page)).toBeVisible();
    await page.evaluate((bruto) => {
      localStorage.setItem(
        "normareview.workspace",
        JSON.stringify({
          bruto,
          textoOriginal: null,
          historico: [],
          textoDiagnosticado: bruto,
          diagnostico: {
            ok: true,
            resumo: "Texto curto, sem metodologia.",
            truncado: false,
            avaliacao: { nivel: "insuficiente", faltando: ["Metodologia", "Conclusão"] },
            diagnosticos: [
              { paragrafo: 0, trecho: "", tipo: "conteudo", categoria: "Estrutura", descricao: "Falta a seção de metodologia.", sugestao: "Descreva como os dados foram coletados.", severidade: "alta" },
              { paragrafo: 2, trecho: "dados foi coletados", tipo: "linguagem", categoria: "Gramática", descricao: "Concordância.", sugestao: "os dados foram", severidade: "alta" },
              { paragrafo: 3, trecho: "problmas", tipo: "linguagem", categoria: "Ortografia", descricao: "Erro de grafia.", sugestao: "problema", severidade: "baixa" },
              { paragrafo: 3, trecho: "O resultado mostra", tipo: "conteudo", categoria: "Coerência", descricao: "O resultado não se liga ao objetivo.", sugestao: "Retome o objetivo.", severidade: "media" },
            ],
          },
        }),
      );
    }, texto);
    await page.goto("/revisar");

    const avaliacao = page.locator(".gemini-avaliacao");
    await expect(avaliacao).toContainText("Avaliação geral do manuscrito");
    await expect(avaliacao).toContainText("Necessita de desenvolvimento");
    await expect(avaliacao).toContainText("Elementos ausentes: Metodologia, Conclusão");
    const itens = page.locator(".gemini-item");
    await expect(itens).toHaveCount(4);
    await expect(page.locator(".resumo-item.total strong")).toHaveText("4");

    // Erro de linguagem: só Localizar (sem Conferir nem Já resolvi).
    const grafia = itens.filter({ hasText: "Erro de grafia." });
    await expect(grafia.getByRole("button", { name: "Localizar no manuscrito" })).toBeVisible();
    await expect(grafia.getByRole("button", { name: "Conferir" })).toHaveCount(0);
    await expect(grafia.getByRole("button", { name: "Já resolvi" })).toHaveCount(0);

    // Corrigir a grafia no editor tira só aquele apontamento (e do resumo).
    await editorDeTexto(page).fill(texto.replace("problmas", "problema"));
    await expect(itens).toHaveCount(3);
    await expect(grafia).toHaveCount(0);
    await expect(page.locator(".resumo-item.total strong")).toHaveText("3");

    // Mexer no trecho de um apontamento sobre o artigo não o tira da lista.
    const coerencia = itens.filter({ hasText: "O resultado não se liga ao objetivo." });
    await editorDeTexto(page).fill(texto.replace("problmas", "problema").replace("O resultado mostra", "Como esperado, o resultado mostra"));
    await expect(coerencia).toHaveCount(1);
    await expect(coerencia.getByRole("button", { name: "Conferir" })).toBeVisible();
    await expect(coerencia.getByRole("button", { name: "Já resolvi" })).toBeVisible();
    await coerencia.getByRole("button", { name: "Localizar no manuscrito" }).click();
    await expect(page.locator("mark.folha-destaque")).toHaveText("Como esperado, o resultado mostra");

    // Conferir sem sessão do Firebase (ambiente de teste): o motivo aparece no próprio apontamento.
    await coerencia.getByRole("button", { name: "Conferir" }).click();
    await expect(coerencia.locator(".gemini-conferencia")).toContainText("Não foi possível conferir.");
    await expect(coerencia).toHaveCount(1);

    // O apontamento do artigo inteiro sai com "Já resolvi".
    await itens.filter({ hasText: "Falta a seção de metodologia." }).getByRole("button", { name: "Já resolvi" }).click();
    await expect(itens).toHaveCount(2);
    await expect(page.locator(".resumo-item.total strong")).toHaveText("2");

    // O que saiu da lista foi para o histórico.
    await page.getByRole("link", { name: "Histórico" }).click();
    const lista = page.getByRole("region", { name: "Alterações registradas" });
    await expect(lista).toContainText("Parágrafo 3 — Gemini — Ortografia: Erro de grafia.");
    await expect(lista).toContainText("Artigo inteiro — Marcado como resolvido — Estrutura: Falta a seção de metodologia.");
  });

  test("assistente com a chave do usuário gera a mesma análise do diagnóstico; o resumo conta só a mais recente", async ({ page }) => {
    const texto = ["INTRODUCAO", "Os dados foi coletados em campo ontem.", "Outro paragrafo sem erro nenhum aqui."].join("\n\n");
    // Diagnóstico da plataforma já salvo (mais antigo), com 1 apontamento.
    await expect(editorDeTexto(page)).toBeVisible();
    await page.evaluate((bruto) => {
      localStorage.setItem(
        "normareview.workspace",
        JSON.stringify({
          bruto,
          textoOriginal: null,
          historico: [],
          textoDiagnosticado: bruto,
          diagnostico: {
            ok: true,
            resumo: "Diagnóstico antigo.",
            truncado: false,
            geradoEm: 1,
            diagnosticos: [{ paragrafo: 2, trecho: "dados foi coletados", tipo: "linguagem", categoria: "Gramática", descricao: "Concordância.", sugestao: "os dados foram", severidade: "alta" }],
          },
        }),
      );
    }, texto);

    // O Gemini (chamado direto do navegador com a chave do usuário) é simulado.
    let pedidos = 0;
    await page.route("**/generativelanguage.googleapis.com/**", async (rota) => {
      pedidos += 1;
      expect(rota.request().headers()["x-goog-api-key"]).toBe("AIzaChaveDoUsuario");
      const conteudo = JSON.stringify({
        avaliacao: { nivel: "insuficiente", faltando: ["Metodologia"] },
        resumo: "Faltam seções.",
        diagnosticos: [
          { paragrafo: 0, trecho: "", tipo: "conteudo", categoria: "Estrutura", descricao: "Falta a metodologia.", sugestao: "Inclua a seção.", severidade: "alta" },
          { paragrafo: 2, trecho: "dados foi coletados", tipo: "linguagem", categoria: "Gramática", descricao: "Concordância verbal.", sugestao: "os dados foram", severidade: "alta" },
        ],
      });
      await rota.fulfill({ json: { candidates: [{ content: { parts: [{ text: conteudo }] } }] } });
    });

    // A chave é informada no Perfil.
    await page.goto("/revisar");
    await page.getByRole("link", { name: "Ativar assistente de IA" }).click();
    await page.getByLabel("Chave da API (Gemini ou OpenAI)").fill("AIzaChaveDoUsuario");
    await page.getByRole("button", { name: "Salvar chave" }).click();
    await page.getByRole("navigation", { name: "Navegação do sistema" }).getByRole("link", { name: "Revisar" }).click();

    // Antes: o resumo conta o diagnóstico salvo (1 apontamento).
    await expect(page.locator(".resumo-item.total strong")).toHaveText("1");

    await page.getByRole("button", { name: "Gerar análise com IA" }).click();
    const lista = page.getByRole("list", { name: "Apontamentos do assistente" });
    await expect(lista.getByRole("listitem")).toHaveCount(2);
    await expect(page.locator(".gemini-avaliacao").first()).toContainText("Necessita de desenvolvimento");
    expect(pedidos).toBe(1);

    // O diagnóstico da plataforma continua no quadro dele, mas o resumo conta só a análise mais recente.
    await expect(page.getByRole("list", { name: "Diagnósticos do Gemini" }).getByRole("listitem")).toHaveCount(1);
    await expect(page.locator(".resumo-item.total strong")).toHaveText("2");

    // Mesmo comportamento: o apontamento de linguagem sai ao corrigir; o do artigo tem Conferir e Já resolvi.
    await editorDeTexto(page).fill(texto.replace("dados foi coletados", "dados foram coletados"));
    await expect(lista.getByRole("listitem")).toHaveCount(1);
    await expect(lista.getByRole("button", { name: "Conferir" })).toBeVisible();
    await lista.getByRole("button", { name: "Já resolvi" }).click();
    await expect(page.getByText("Nenhum apontamento pendente.").first()).toBeVisible();
  });

  test("localizar destaca o trecho no manuscrito", async ({ page }) => {
    await analisarTexto(page);
    await cartaoDaRegra(page, "Aspas desbalanceadas")
      .getByRole("button", { name: "Localizar no manuscrito" })
      .click();

    await expect(page.locator("mark.folha-destaque").first()).toBeVisible();
  });

  test("corrigir um problema pede confirmação e reduz os avisos", async ({ page }) => {
    const antes = await analisarTexto(page);
    const cartao = cartaoDaRegra(page, "Espaço em excesso antes da pontuação");

    await cartao.getByRole("button", { name: "Aplicar correção" }).click();
    const confirmacao = page.getByRole("group", { name: /Confirmar correção em Parágrafo 1/ });
    await expect(confirmacao).toBeVisible();

    await confirmacao.getByRole("button", { name: "Confirmar" }).click();

    // O espaço antes da pontuação sai do texto e o aviso correspondente some.
    await expect(editorDeTexto(page)).not.toHaveValue(/editorial \./);
    await expect(cartaoDaRegra(page, "Espaço em excesso antes da pontuação")).toHaveCount(0);
    await expect(page.locator(".problema-card")).toHaveCount(antes - 1);
  });

  test("cancelar a correção mantém o texto intacto", async ({ page }) => {
    await analisarTexto(page);
    const cartao = cartaoDaRegra(page, "Espaço em excesso antes da pontuação");

    await cartao.getByRole("button", { name: "Aplicar correção" }).click();
    await cartao.getByRole("button", { name: "Cancelar" }).click();

    await expect(editorDeTexto(page)).toHaveValue(TEXTO_EXEMPLO);
    await expect(page.locator(".problema-card")).toHaveCount(3);
  });

  test("formatação alterna negrito/itálico/sublinhado", async ({ page }) => {
    const negrito = page.getByRole("button", { name: "Negrito" });
    await expect(negrito).toHaveAttribute("aria-pressed", "false");
    await negrito.click();
    await expect(negrito).toHaveAttribute("aria-pressed", "true");
    await negrito.click();
    await expect(negrito).toHaveAttribute("aria-pressed", "false");

    const italico = page.getByRole("button", { name: "Itálico" });
    await italico.click();
    await expect(italico).toHaveAttribute("aria-pressed", "true");
  });

  test("menu de exportação abre com as duas opções", async ({ page }) => {
    await analisarTexto(page);
    await page.getByRole("button", { name: /Exportar/ }).click();

    const menu = page.getByRole("menu", { name: "Exportar o texto revisado" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Baixar \.docx/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Copiar texto/ })).toBeVisible();
  });
});
