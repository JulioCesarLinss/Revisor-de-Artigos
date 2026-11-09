#!/usr/bin/env bun
/**
 * Detector de test smells para a suíte do NormaReview AI.
 *
 * Percorre os arquivos *.test.ts com a AST do TypeScript (já disponível no
 * projeto) e aplica o catálogo do testsmells.org adaptado a bun:test.
 *
 * Uso:
 *   bun run smells            # relatório, sempre sai com código 0
 *   bun run smells --strict   # sai com código 1 se houver cheiro de severidade alta
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

type Severidade = "alta" | "media" | "baixa";

interface Achado {
  arquivo: string;
  linha: number;
  teste: string;
  cheiro: string;
  severidade: Severidade;
  detalhe: string;
}

const RAIZ = process.cwd();
const DIRETORIOS = ["src", "server", "api"];
const LIMITE_LINHAS_TESTE = 25;
const LIMITE_ASSERCOES = 8;
const LIMITE_FUNCOES_IMPORTADAS = 4;
const NUMEROS_TRIVIAIS = new Set(["0", "1", "2", "-1"]);

function listarTestes(diretorio: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
    if (entrada.name === "node_modules" || entrada.name.startsWith(".")) continue;
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...listarTestes(caminho));
    else if (entrada.name.endsWith(".test.ts")) encontrados.push(caminho);
  }
  return encontrados;
}

function textoDoNo(no: ts.Node, arquivo: ts.SourceFile): string {
  return no.getText(arquivo).replace(/\s+/g, " ");
}

function nomeDaChamada(no: ts.CallExpression, arquivo: ts.SourceFile): string {
  return textoDoNo(no.expression, arquivo);
}

function ehChamadaDeTeste(no: ts.CallExpression, arquivo: ts.SourceFile): boolean {
  return /^(test|it)(\.(skip|only|todo|each|concurrent|failing))?$/.test(nomeDaChamada(no, arquivo));
}

function nomeDoTeste(no: ts.CallExpression): string {
  const primeiro = no.arguments[0];
  if (primeiro && (ts.isStringLiteral(primeiro) || ts.isNoSubstitutionTemplateLiteral(primeiro))) {
    return primeiro.text;
  }
  return "(nome dinâmico)";
}

function corpoDoTeste(no: ts.CallExpression): ts.ConciseBody | undefined {
  const ultimo = no.arguments[no.arguments.length - 1];
  if (!ultimo) return undefined;
  if (ts.isArrowFunction(ultimo) || ts.isFunctionExpression(ultimo)) return ultimo.body;
  return undefined;
}

/** Todos os nós do corpo, sem descer em funções aninhadas (helpers). */
function percorrerCorpo(corpo: ts.Node, visitar: (no: ts.Node) => void): void {
  const visitarFilho = (no: ts.Node) => {
    if (ts.isFunctionDeclaration(no) || ts.isFunctionExpression(no) || ts.isArrowFunction(no)) return;
    visitar(no);
    ts.forEachChild(no, visitarFilho);
  };
  visitar(corpo);
  ts.forEachChild(corpo, visitarFilho);
}

function nomesImportados(arquivo: ts.SourceFile): Map<string, string> {
  const nomes = new Map<string, string>();
  for (const sentenca of arquivo.statements) {
    if (!ts.isImportDeclaration(sentenca) || !ts.isStringLiteral(sentenca.moduleSpecifier)) continue;
    const modulo = sentenca.moduleSpecifier.text;
    if (modulo === "bun:test") continue;
    const ligacoes = sentenca.importClause?.namedBindings;
    if (!ligacoes || !ts.isNamedImports(ligacoes)) continue;
    for (const elemento of ligacoes.elements) nomes.set((elemento.name ?? elemento.propertyName).text, modulo);
  }
  return nomes;
}

/** Detecta `expect(...)` e encadeamentos como `expect(x).toBe(y)`. */
function ehExpect(no: ts.Node, arquivo: ts.SourceFile): no is ts.CallExpression {
  if (!ts.isCallExpression(no)) return false;
  const alvo = no.expression;
  if (ts.isIdentifier(alvo)) return alvo.text === "expect";
  if (ts.isPropertyAccessExpression(alvo)) return textoDoNo(alvo.expression, arquivo).startsWith("expect");
  return false;
}

/** Sobe até a expressão completa da asserção, mesmo com `.not`, `await` etc. */
function raizDaAssercao(no: ts.Node, arquivo: ts.SourceFile): ts.Node {
  let atual = no;
  while (
    atual.parent &&
    (ts.isCallExpression(atual.parent) || ts.isPropertyAccessExpression(atual.parent) || ts.isAwaitExpression(atual.parent))
  ) {
    if (ts.isCallExpression(atual.parent) && !ehExpect(atual.parent, arquivo)) break;
    atual = atual.parent;
  }
  return atual;
}

function estaDentroDeLaco(no: ts.Node): boolean {
  for (let atual = no.parent; atual; atual = atual.parent) {
    if (
      ts.isForStatement(atual) ||
      ts.isForOfStatement(atual) ||
      ts.isForInStatement(atual) ||
      ts.isWhileStatement(atual) ||
      ts.isDoStatement(atual)
    ) {
      return true;
    }
    if (ts.isArrowFunction(atual) || ts.isFunctionExpression(atual) || ts.isFunctionDeclaration(atual)) return false;
  }
  return false;
}

function estaDentroDeCondicional(no: ts.Node): boolean {
  for (let atual = no.parent; atual; atual = atual.parent) {
    if (
      ts.isIfStatement(atual) ||
      ts.isWhileStatement(atual) ||
      ts.isDoStatement(atual) ||
      ts.isSwitchStatement(atual) ||
      ts.isConditionalExpression(atual)
    ) {
      return true;
    }
    if (ts.isArrowFunction(atual) || ts.isFunctionExpression(atual) || ts.isFunctionDeclaration(atual)) return false;
  }
  return false;
}

function achadosDeUmTeste(
  no: ts.CallExpression,
  arquivo: ts.SourceFile,
  caminho: string,
  importados: Map<string, string>,
): Achado[] {
  const achados: Achado[] = [];
  const nome = nomeDoTeste(no);
  const chamada = nomeDaChamada(no, arquivo);
  const inicio = arquivo.getLineAndCharacterOfPosition(no.getStart(arquivo)).line + 1;
  const adicionar = (cheiro: string, severidade: Severidade, detalhe: string) =>
    achados.push({ arquivo: caminho, linha: inicio, teste: nome, cheiro, severidade, detalhe });

  if (chamada.endsWith(".only")) {
    adicionar("Teste focado", "alta", "`.only` desliga o resto da suíte em execuções locais.");
  }
  if (chamada.endsWith(".skip") || chamada.endsWith(".todo")) {
    adicionar("Teste ignorado", "media", `\`${chamada}\` deixa comportamento sem cobertura.`);
  }

  const corpo = corpoDoTeste(no);
  if (!corpo) return achados;

  const assercoes: string[] = [];
  const raizesDeAssercao = new Set<ts.Node>();
  const assercoesCondicionais = new Set<ts.Node>();
  const assercoesEmLaco = new Set<ts.Node>();
  let temCondicional = false;
  let temTry = false;
  let temEspera = false;
  let acessaAmbiente = false;
  let igualdadeSensivel = false;
  const funcoesDeProducao = new Set<string>();
  const numerosMagicos: string[] = [];

  percorrerCorpo(corpo, (atual) => {
    if (
      ts.isIfStatement(atual) ||
      ts.isWhileStatement(atual) ||
      ts.isDoStatement(atual) ||
      ts.isSwitchStatement(atual) ||
      ts.isConditionalExpression(atual)
    ) {
      temCondicional = true;
    }
    if (ts.isTryStatement(atual)) temTry = true;
    if (ehExpect(atual, arquivo)) {
      const raiz = raizDaAssercao(atual, arquivo);
      const texto = textoDoNo(raiz, arquivo);
      if (!raizesDeAssercao.has(raiz)) {
        raizesDeAssercao.add(raiz);
        assercoes.push(texto);
      }
      if (/\.toString\(\)|JSON\.stringify/.test(texto)) igualdadeSensivel = true;
      numerosMagicos.push(...numerosNaoTriviais(raiz, arquivo));
      if (estaDentroDeCondicional(raiz)) assercoesCondicionais.add(raiz);
      if (estaDentroDeLaco(raiz)) assercoesEmLaco.add(raiz);
    }
    if (ts.isCallExpression(atual)) {
      const alvo = nomeDaChamada(atual, arquivo);
      if (/^(setTimeout|Bun\.sleep|sleep|delay)$/.test(alvo)) temEspera = true;
      if (/FileSync$|File$|existsSync$|readdirSync$|statSync$/.test(alvo)) acessaAmbiente = true;
      const raiz = alvo.split(".")[0];
      if (importados.has(raiz)) funcoesDeProducao.add(raiz);
    }
  });

  if (assercoes.length === 0) {
    adicionar("Teste sem asserção", "alta", "O corpo não verifica nenhum resultado: pode passar sem testar nada.");
  }
  if (temCondicional && assercoesCondicionais.size > 0) {
    adicionar(
      "Asserção dentro de lógica condicional",
      "media",
      `${assercoesCondicionais.size} asserção(ões) só rodam em um ramo; a falha fica ambígua.`,
    );
  }
  if (temTry) {
    adicionar("Tratamento de exceção no teste", "media", "try/catch pode engolir uma falha real; use `toThrow`.");
  }
  if (temEspera) {
    adicionar("Espera artificial (Sleepy Test)", "alta", "Esperas fixas deixam o teste lento e instável.");
  }
  if (acessaAmbiente) {
    adicionar("Convidado misterioso (Mystery Guest)", "media", "Acesso a arquivo real do sistema fora do teste.");
  }
  if (igualdadeSensivel) {
    adicionar("Igualdade sensível", "baixa", "Comparação via `toString()`/`JSON.stringify` quebra com mudança de formato.");
  }
  if (assercoes.length >= LIMITE_ASSERCOES) {
    adicionar("Teste verboso", "baixa", `${assercoes.length} asserções no mesmo teste; divida por comportamento.`);
  }
  if (funcoesDeProducao.size >= LIMITE_FUNCOES_IMPORTADAS && assercoes.length > 1) {
    adicionar("Teste ansioso (Eager Test)", "baixa", `Exercita ${funcoesDeProducao.size} funções de produção diferentes.`);
  }

  const assercoesForaDeLaco = [...assercoesEmLaco].length === 0;
  const repetidas = assercoesForaDeLaco ? assercoes.filter((texto, indice) => assercoes.indexOf(texto) !== indice) : [];
  if (repetidas.length > 0) {
    adicionar("Asserção duplicada", "media", `Repete: ${[...new Set(repetidas)][0]}`);
  }
  const redundantes = assercoes.filter((texto) => /^expect\(([^)]+)\)\.toBe\(\1\)$/.test(texto) || /^expect\(true\)\.toBe\(true\)$/.test(texto));
  if (redundantes.length > 0) {
    adicionar("Asserção redundante", "media", "Comparação sempre verdadeira não protege contra regressão.");
  }
  if (numerosMagicos.length > 0) {
    adicionar("Número mágico", "baixa", `Literal numérico sem nome: ${[...new Set(numerosMagicos)].join(", ")}.`);
  }

  const linhas = arquivo.getLineAndCharacterOfPosition(corpo.getEnd()).line - (inicio - 1);
  if (linhas > LIMITE_LINHAS_TESTE) {
    adicionar("Teste longo", "baixa", `${linhas} linhas em um único teste; extraia cenários.`);
  }

  return achados;
}

function numerosNaoTriviais(no: ts.Node, arquivo: ts.SourceFile): string[] {
  const numeros: string[] = [];
  const visitar = (atual: ts.Node) => {
    if (ts.isNumericLiteral(atual) && !NUMEROS_TRIVIAIS.has(atual.text)) {
      const valor = Number(atual.text);
      // Códigos HTTP (100–599) são vocabulário do domínio, não número mágico.
      if (!(valor >= 100 && valor <= 599)) numeros.push(atual.text);
    }
    ts.forEachChild(atual, visitar);
  };
  visitar(no);
  void arquivo;
  return numeros;
}

function analisarArquivo(caminho: string): Achado[] {
  const fonte = readFileSync(caminho, "utf8");
  const arquivo = ts.createSourceFile(caminho, fonte, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const importados = nomesImportados(arquivo);
  const achados: Achado[] = [];
  const nomes: string[] = [];

  const visitar = (no: ts.Node) => {
    if (ts.isCallExpression(no) && ehChamadaDeTeste(no, arquivo)) {
      achados.push(...achadosDeUmTeste(no, arquivo, caminho, importados));
      nomes.push(nomeDoTeste(no));
    }
    ts.forEachChild(no, visitar);
  };
  visitar(arquivo);

  const duplicados = nomes.filter((nome, indice) => nomes.indexOf(nome) !== indice);
  for (const nome of new Set(duplicados)) {
    const linha = arquivo.getLineAndCharacterOfPosition(arquivo.getStart(arquivo)).line + 1;
    achados.push({
      arquivo: caminho,
      linha,
      teste: nome,
      cheiro: "Nome de teste duplicado",
      severidade: "baixa",
      detalhe: "Dois testes com o mesmo nome confundem o relatório de falhas.",
    });
  }

  return achados;
}

function main(): void {
  const arquivos = DIRETORIOS.flatMap((diretorio) => {
    try {
      return listarTestes(join(RAIZ, diretorio));
    } catch {
      return [];
    }
  }).sort();

  const achados = arquivos.flatMap(analisarArquivo);
  const porSeveridade: Record<Severidade, number> = { alta: 0, media: 0, baixa: 0 };
  for (const achado of achados) porSeveridade[achado.severidade]++;

  console.log(`\nDetector de test smells — ${arquivos.length} arquivos de teste analisados\n`);

  if (achados.length === 0) {
    console.log("Nenhum test smell encontrado.");
    return;
  }

  const porArquivo = new Map<string, Achado[]>();
  for (const achado of achados) {
    const lista = porArquivo.get(achado.arquivo) ?? [];
    lista.push(achado);
    porArquivo.set(achado.arquivo, lista);
  }

  for (const [arquivo, lista] of [...porArquivo.entries()].sort()) {
    console.log(relative(RAIZ, arquivo));
    for (const achado of lista.sort((a, b) => a.linha - b.linha)) {
      console.log(`  ${String(achado.linha).padStart(4)}  [${achado.severidade}] ${achado.cheiro} — ${achado.teste}`);
      console.log(`        ${achado.detalhe}`);
    }
    console.log();
  }

  const porCheiro = new Map<string, number>();
  for (const achado of achados) porCheiro.set(achado.cheiro, (porCheiro.get(achado.cheiro) ?? 0) + 1);

  console.log("Resumo por cheiro");
  for (const [cheiro, total] of [...porCheiro.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(total).padStart(3)}  ${cheiro}`);
  }
  console.log(
    `\nTotal: ${achados.length} achados (${porSeveridade.alta} alta, ${porSeveridade.media} media, ${porSeveridade.baixa} baixa)\n`,
  );

  if (process.argv.includes("--strict") && porSeveridade.alta > 0) process.exit(1);
}

main();
