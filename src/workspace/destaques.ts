import type { Intervalo } from "../rules/types.js";

/**
 * Marcas de erro no editor, em posições do texto bruto. Cada marca é
 * independente: mexer em um erro apaga só a marca dele, e as demais seguem
 * no lugar certo mesmo com o texto mudando de tamanho.
 */

/** Ordena e junta as marcas sobrepostas (dois avisos sobre o mesmo trecho). */
export function unirTrechos(trechos: Intervalo[]): Intervalo[] {
  const ordenados = trechos.filter((t) => t.fim > t.inicio).sort((a, b) => a.inicio - b.inicio);
  const unidos: Intervalo[] = [];
  for (const t of ordenados) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && t.inicio < ultimo.fim) ultimo.fim = Math.max(ultimo.fim, t.fim);
    else unidos.push({ ...t });
  }
  return unidos;
}

/** Onde dois textos diferem: de `inicio` até `fimAntes` em um, até `fimDepois` no outro. */
export function faixaAlterada(antes: string, depois: string): { inicio: number; fimAntes: number; fimDepois: number } {
  const limite = Math.min(antes.length, depois.length);
  let inicio = 0;
  while (inicio < limite && antes[inicio] === depois[inicio]) inicio++;
  let sufixo = 0;
  while (sufixo < limite - inicio && antes[antes.length - 1 - sufixo] === depois[depois.length - 1 - sufixo]) sufixo++;
  return { inicio, fimAntes: antes.length - sufixo, fimDepois: depois.length - sufixo };
}

/**
 * Atualiza as marcas depois de uma alteração do texto: a marca tocada pela
 * alteração some; as que vêm depois dela acompanham o deslocamento.
 */
export function ajustarTrechos(trechos: Intervalo[], antes: string, depois: string): Intervalo[] {
  const { inicio, fimAntes: fimAlterado } = faixaAlterada(antes, depois);
  const deslocamento = depois.length - antes.length;
  const ajustados: Intervalo[] = [];
  for (const t of trechos) {
    if (t.fim < inicio) ajustados.push(t); // antes da alteração
    else if (t.inicio >= fimAlterado) ajustados.push({ inicio: t.inicio + deslocamento, fim: t.fim + deslocamento });
    // Nos demais casos a alteração toca a marca, inclusive logo depois dela (o
    // ponto final que faltava): ela some. Logo antes da marca não conta: ao
    // digitar um espaço antes de um espaço, a comparação acusa a mudança no
    // fim da sequência, encostada na marca, sem o usuário ter mexido nela.
  }
  return ajustados;
}

/**
 * Acha um trecho citado pela IA dentro do parágrafo. Só confia no que está
 * mesmo no texto: tolera espaços e maiúsculas diferentes; se não achar, devolve null.
 */
export function localizarTrecho(paragrafo: string, trecho: string | undefined): Intervalo | null {
  if (typeof trecho !== "string" || trecho.trim().length === 0) return null;
  const padrao = trecho
    .trim()
    .split(/\s+/)
    .map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const achado = new RegExp(padrao, "i").exec(paragrafo);
  return achado ? { inicio: achado.index, fim: achado.index + achado[0].length } : null;
}

/** Abaixo disso, parecido demais com outras palavras para aproximar ("para"/"pra"). */
const MINIMO_APROXIMADO = 5;
/** Diferença aceita na busca aproximada: 1 letra a cada 5. */
const DIFERENCA_ACEITA = 0.2;

function distancia(a: string, b: string): number {
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      const troca = anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, troca);
    }
    anterior = atual;
  }
  return anterior[b.length];
}

/**
 * Procura uma sequência de palavras quase igual ao trecho: a IA às vezes cita
 * a palavra já corrigida ("problemas", com "problmas" no texto) ou completa a
 * frase ("princípios da mecânica", com "princípios mecânica" no texto).
 */
export function localizarAproximado(paragrafo: string, trecho: string): Intervalo | null {
  const alvo = trecho.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/\s+/g, " ").toLowerCase();
  if (alvo.length < MINIMO_APROXIMADO) return null;
  const limite = Math.floor(alvo.length * DIFERENCA_ACEITA);
  const palavras = [...paragrafo.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)].map((m) => ({
    inicio: m.index ?? 0,
    fim: (m.index ?? 0) + m[0].length,
  }));
  const tamanho = alvo.split(" ").length;

  let melhor: { intervalo: Intervalo; diferenca: number } | null = null;
  for (let n = Math.max(tamanho - 1, 1); n <= tamanho + 1; n++) {
    for (let i = 0; i + n <= palavras.length; i++) {
      const intervalo = { inicio: palavras[i].inicio, fim: palavras[i + n - 1].fim };
      const candidato = paragrafo.slice(intervalo.inicio, intervalo.fim).replace(/\s+/g, " ").toLowerCase();
      if (Math.abs(candidato.length - alvo.length) > limite) continue;
      const diferenca = distancia(candidato, alvo);
      if (diferenca <= limite && (!melhor || diferenca < melhor.diferenca)) melhor = { intervalo, diferenca };
    }
  }
  return melhor?.intervalo ?? null;
}

/** Até onde procurar além do parágrafo citado, quando a citação é menos confiável. */
const VIZINHOS = 1;

/** Termos entre aspas no texto do apontamento, ex.: "Erro na palavra 'problemas'". */
function termosCitados(texto: string): string[] {
  return [...texto.matchAll(/['"“‘]([^'"”’]{5,})['"”’]/g)].map((m) => m[1]);
}

/** Procura do parágrafo citado para os vizinhos; o número dado pela IA pode estar errado. */
function procurar(
  paragrafos: string[],
  citado: number,
  termo: string,
  alcanceExato: number,
): { paragrafo: number; posicao: Intervalo } | null {
  for (let distanciaAtual = 0; distanciaAtual <= alcanceExato; distanciaAtual++) {
    for (const numero of distanciaAtual === 0 ? [citado] : [citado - distanciaAtual, citado + distanciaAtual]) {
      const texto = paragrafos[numero - 1];
      if (texto === undefined) continue;
      const posicao =
        localizarTrecho(texto, termo) ?? (distanciaAtual <= VIZINHOS ? localizarAproximado(texto, termo) : null);
      if (posicao) return { paragrafo: numero, posicao };
    }
  }
  return null;
}

/**
 * Onde está o erro de um apontamento da IA, em `paragrafos` (o de número n na
 * posição n - 1). Primeiro pelo trecho, em qualquer parágrafo; sem ele, pelos
 * termos citados na descrição e na sugestão, só no parágrafo e nos vizinhos.
 * Nada confiável encontrado: null (a tela marca o parágrafo inteiro).
 */
export function localizarApontamento(
  paragrafos: string[],
  apontamento: { paragrafo: number; trecho?: string; descricao: string; sugestao: string },
): { paragrafo: number; posicao: Intervalo } | null {
  const { paragrafo, trecho, descricao, sugestao } = apontamento;
  if (typeof trecho === "string" && trecho.trim().length > 0) {
    const achado = procurar(paragrafos, paragrafo, trecho, paragrafos.length);
    if (achado) return achado;
  }
  for (const termo of [...termosCitados(descricao), ...termosCitados(sugestao)]) {
    const achado = procurar(paragrafos, paragrafo, termo, VIZINHOS);
    if (achado) return achado;
  }
  return null;
}
